import os
import re
import threading
import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response, FileResponse
from typing import Optional, List
import fitz  # PyMuPDF
from database import get_db

router = APIRouter(prefix="/api/books", tags=["Books"])

# PDF Cache Directory (checks library-app/pdf_cache or root pdf_cache)
PRIMARY_CACHE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "pdf_cache"))
APP_CACHE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "pdf_cache"))
CACHE_DIR = PRIMARY_CACHE_DIR if os.path.exists(PRIMARY_CACHE_DIR) else APP_CACHE_DIR
os.makedirs(CACHE_DIR, exist_ok=True)

# Thread synchronization locks to prevent concurrent duplicate Google Drive downloads
DOWNLOAD_LOCKS = {}
LOCKS_LOCK = threading.Lock()

# In-memory document handle cache for instant <1ms page rendering
DOC_CACHE = {}
DOC_CACHE_LOCK = threading.Lock()
MAX_DOC_CACHE = 30

def get_file_lock(file_id: str) -> threading.Lock:
    with LOCKS_LOCK:
        if file_id not in DOWNLOAD_LOCKS:
            DOWNLOAD_LOCKS[file_id] = threading.Lock()
        return DOWNLOAD_LOCKS[file_id]


def get_pdf_file_path(book_id: int) -> str:
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT pdf_path FROM oceanofpdf_books WHERE id = %s", (book_id,))
    row = cursor.fetchone()
    conn.close()

    if not row or not row["pdf_path"]:
        raise HTTPException(status_code=404, detail="Book PDF not found")

    raw_path = row["pdf_path"]
    if os.path.exists(raw_path):
        return raw_path

    # Extract Google Drive File ID
    match = re.search(r'/file/d/([^/#\?]+)', raw_path) or re.search(r'/d/([^/#\?]+)', raw_path)
    if not match:
        raise HTTPException(status_code=404, detail="Invalid storage path")

    file_id = match.group(1)
    local_cached = os.path.join(CACHE_DIR, f"{file_id}.pdf")
    
    # Fast path: already downloaded and cached
    if os.path.exists(local_cached) and os.path.getsize(local_cached) > 0:
        return local_cached

    # Thread-safe download lock: prevents duplicate requests from triggering parallel Google Drive downloads
    file_lock = get_file_lock(file_id)
    with file_lock:
        if os.path.exists(local_cached) and os.path.getsize(local_cached) > 0:
            return local_cached

        tmp_path = os.path.join(CACHE_DIR, f"{file_id}.pdf.tmp")
        try:
            try:
                from gdrive_service import get_drive_service
            except ImportError:
                import sys
                backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
                if backend_dir not in sys.path:
                    sys.path.append(backend_dir)
                from gdrive_service import get_drive_service

            service = get_drive_service()
            if not service:
                raise Exception("Drive service unavailable")

            pdf_bytes = service.files().get_media(fileId=file_id).execute()
            with open(tmp_path, "wb") as f:
                f.write(pdf_bytes)

            os.replace(tmp_path, local_cached)
            return local_cached
        except Exception as e:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass
            raise HTTPException(status_code=500, detail=f"Failed to load cloud document: {str(e)}")


def get_fitz_doc(pdf_file_path: str):
    """Retrieves cached PyMuPDF document handle for ultra-fast page rendering."""
    with DOC_CACHE_LOCK:
        if pdf_file_path in DOC_CACHE:
            return DOC_CACHE[pdf_file_path]

    doc = fitz.open(pdf_file_path)
    with DOC_CACHE_LOCK:
        if len(DOC_CACHE) >= MAX_DOC_CACHE:
            oldest_key = next(iter(DOC_CACHE))
            try:
                DOC_CACHE[oldest_key].close()
            except Exception:
                pass
            del DOC_CACHE[oldest_key]
        DOC_CACHE[pdf_file_path] = doc
        return doc


def sanitize_pdf_page(page):
    """Detect and redact any oceanofpdf text, watermarks, or branding from the page image."""
    terms = ["oceanofpdf", "oceanofpdf.com", "OceanofPDF", "OceanofPDF.com", "OceanOfPDF", "ocean of pdf"]
    for term in terms:
        rects = page.search_for(term)
        for r in rects:
            page.add_redact_annot(r, fill=(1, 1, 1))
    page.apply_redactions()


@router.get("", response_model=None)
@router.get("/")
def get_books(
    search: Optional[str] = None,
    genre: Optional[str] = None,
    limit: int = 500,
    offset: int = 0
):
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    query = "SELECT * FROM oceanofpdf_books WHERE pdf_path IS NOT NULL AND pdf_path != ''"
    params = []

    # Default Browse Mode: Only show volumes with cover art when user is NOT searching
    if not search or not search.strip():
        query += " AND (book_cover IS NOT NULL AND book_cover != '')"

    if genre and genre.upper() != "ALL":
        query += " AND (LOWER(genre) LIKE %s)"
        params.append(f"%{genre.lower()}%")

    if search and search.strip():
        words = [w.strip() for w in search.lower().split() if w.strip()]
        for w in words:
            term = f"%{w}%"
            query += " AND (LOWER(book_name) LIKE %s OR LOWER(author) LIKE %s OR LOWER(genre) LIKE %s)"
            params.extend([term, term, term])

    query += " ORDER BY id ASC LIMIT %s OFFSET %s"
    params.extend([limit, offset])

    cursor.execute(query, params)
    rows = cursor.fetchall()

    books = []
    for r in rows:
        book_dict = dict(r)
        book_dict["title"] = book_dict.get("book_name") or "Untitled Volume"
        book_dict["cover_url"] = book_dict.get("book_cover")
        book_dict["year"] = book_dict.get("released_date")
        book_dict["has_pdf"] = True
        book_dict["rating"] = 4.7
        book_dict["spine_color"] = "#8C3A27"
        book_dict["spine_texture"] = "leather"
        book_dict["spine_width"] = 40
        book_dict["spine_height"] = 280
        # STRICT PRIVACY: Strip raw pdf_path and book_link from API payloads
        book_dict.pop("pdf_path", None)
        book_dict.pop("book_link", None)
        books.append(book_dict)

    conn.close()
    return books


@router.get("/categories")
def get_categories():
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    # Fetch all 451 genres from genre_links table
    cursor.execute("SELECT genre_name FROM genre_links WHERE genre_name IS NOT NULL ORDER BY genre_name ASC")
    g_rows = cursor.fetchall()
    all_genres = set()
    for g in g_rows:
        name = g.get("genre_name")
        if name:
            all_genres.add(name.strip().title())

    # Count occurrences from oceanofpdf_books table for PDF volumes with covers only
    cursor.execute("SELECT genre FROM oceanofpdf_books WHERE pdf_path IS NOT NULL AND pdf_path != '' AND book_cover IS NOT NULL AND book_cover != '' AND genre IS NOT NULL AND genre != ''")
    rows = cursor.fetchall()

    category_counts = {"ALL": 0}
    for genre_name in sorted(all_genres):
        category_counts[genre_name] = 0

    for r in rows:
        g_raw = r["genre"]
        parts = [p.strip().title() for p in g_raw.split(",") if p.strip()]
        for p in parts:
            category_counts[p] = category_counts.get(p, 0) + 1

    cursor.execute("SELECT COUNT(*) as count FROM oceanofpdf_books WHERE pdf_path IS NOT NULL AND pdf_path != '' AND book_cover IS NOT NULL AND book_cover != ''")
    total = cursor.fetchone()["count"]
    category_counts["ALL"] = total

    conn.close()
    return category_counts


@router.get("/{book_id}/pdf-info")
def get_pdf_info(book_id: int):
    pdf_file = get_pdf_file_path(book_id)
    doc = get_fitz_doc(pdf_file)

    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT book_name, author, genre, book_cover, pdf_filename FROM oceanofpdf_books WHERE id = %s", (book_id,))
    row = cursor.fetchone()
    conn.close()

    file_size_mb = os.path.getsize(pdf_file) / (1024 * 1024)

    return {
        "book_id": book_id,
        "title": row["book_name"] if row else "Untitled Volume",
        "author": row["author"] if row else "Unknown Author",
        "genre": row["genre"] if row else None,
        "cover_url": row["book_cover"] if row else None,
        "pdf_filename": (row["pdf_filename"] if row else None) or "volume.pdf",
        "file_size": f"{file_size_mb:.1f} MB",
        "page_count": len(doc),
    }


@router.get("/{book_id}/page/{page_num}")
def get_pdf_page(book_id: int, page_num: int):
    pdf_file = get_pdf_file_path(book_id)
    doc = get_fitz_doc(pdf_file)

    if page_num < 1 or page_num > len(doc):
        raise HTTPException(status_code=404, detail=f"Page {page_num} out of bounds")

    page = doc.load_page(page_num - 1)
    
    # Redact oceanofpdf text / watermarks before rendering
    sanitize_pdf_page(page)

    pix = page.get_pixmap(dpi=150)
    img_bytes = pix.tobytes("jpeg")

    return Response(
        content=img_bytes, 
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=31536000, immutable"}
    )


@router.get("/{book_id}/page/{page_num}/links")
def get_pdf_page_links(book_id: int, page_num: int):
    pdf_file = get_pdf_file_path(book_id)
    doc = get_fitz_doc(pdf_file)

    if page_num < 1 or page_num > len(doc):
        return []

    page = doc.load_page(page_num - 1)
    links = page.get_links()
    page_rect = page.rect
    p_width = page_rect.width
    p_height = page_rect.height

    results = []
    for link in links:
        rect = link.get("from")
        if not rect or p_width == 0 or p_height == 0:
            continue

        left_pct = (rect.x0 / p_width) * 100
        top_pct = (rect.y0 / p_height) * 100
        width_pct = ((rect.x1 - rect.x0) / p_width) * 100
        height_pct = ((rect.y1 - rect.y0) / p_height) * 100

        link_type = link.get("kind")
        if link_type == fitz.LINK_GOTO:
            target_page = link.get("page", 0) + 1
            results.append({
                "kind": "goto",
                "page": target_page,
                "bbox": [left_pct, top_pct, width_pct, height_pct]
            })
        elif link_type == fitz.LINK_URI:
            uri = link.get("uri")
            if uri and "oceanofpdf" not in uri.lower():
                results.append({
                    "kind": "uri",
                    "uri": uri,
                    "bbox": [left_pct, top_pct, width_pct, height_pct]
                })

    return results


@router.get("/{book_id}/page/{page_num}/words")
def get_pdf_page_words(book_id: int, page_num: int):
    pdf_file = get_pdf_file_path(book_id)
    doc = get_fitz_doc(pdf_file)

    if page_num < 1 or page_num > len(doc):
        return []

    page = doc.load_page(page_num - 1)
    words = page.get_text("words")
    page_rect = page.rect
    pw, ph = page_rect.width, page_rect.height
    if pw == 0 or ph == 0:
        return []

    results = []
    for w in words:
        x0, y0, x1, y1, word_text = w[0], w[1], w[2], w[3], w[4]
        left_pct = (x0 / pw) * 100
        top_pct = (y0 / ph) * 100
        width_pct = ((x1 - x0) / pw) * 100
        height_pct = ((y1 - y0) / ph) * 100
        results.append({
            "text": word_text,
            "bbox": [round(left_pct, 2), round(top_pct, 2), round(width_pct, 2), round(height_pct, 2)]
        })

    return results


@router.get("/{book_id}/pdf")
def stream_pdf(book_id: int):
    pdf_file = get_pdf_file_path(book_id)
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT book_name FROM oceanofpdf_books WHERE id = %s", (book_id,))
    row = cursor.fetchone()
    conn.close()

    filename = f"{row['book_name']}.pdf" if row and row.get("book_name") else "volume.pdf"
    return FileResponse(pdf_file, media_type="application/pdf", filename=filename)


@router.get("/{book_id}")
def get_book_detail(book_id: int):
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT * FROM oceanofpdf_books WHERE id = %s", (book_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Book not found")

    book_dict = dict(row)
    book_dict["title"] = book_dict.get("book_name") or "Untitled Volume"
    book_dict["cover_url"] = book_dict.get("book_cover")
    book_dict["year"] = book_dict.get("released_date")
    book_dict["has_pdf"] = bool(book_dict.get("pdf_path"))
    book_dict["rating"] = 4.7
    book_dict["spine_color"] = "#8C3A27"
    book_dict["spine_texture"] = "leather"
    book_dict["spine_width"] = 40
    book_dict["spine_height"] = 280
    # STRICT PRIVACY: Strip raw pdf_path and book_link from API payloads
    book_dict.pop("pdf_path", None)
    book_dict.pop("book_link", None)
    return book_dict
