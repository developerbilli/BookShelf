import os
import glob
import re
import random
import sqlite3
import pandas as pd
from pypdf import PdfReader

PDF_DIR = "/Users/anusurya/PycharmProjects/WelcomeScreen/PDFS"
EXCEL_5000 = os.path.join(os.path.dirname(__file__), "..", "..", "Books_5000_Plus.xlsx")
EXCEL_YA = os.path.join(os.path.dirname(__file__), "..", "..", "YA_Books_Single_Sheet.xlsx")
EXCEL_PATH = EXCEL_5000 if os.path.exists(EXCEL_5000) else EXCEL_YA

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "library.db")

COLOR_PALETTES = [
    "#D48C8C", "#992B2B", "#D46A50", "#4E6855", "#223A2A", 
    "#5A7D9A", "#1F2D42", "#C49A45", "#7C5E7A", "#33373B", 
    "#D9CDBC", "#4A3327", "#C57B7B", "#B53333", "#C0583E", 
    "#3B5242", "#1A2E21", "#486A87", "#162233", "#B38834", 
    "#6A4D68", "#26292C", "#CABDAA", "#3B271C", "#E27D65", 
    "#5B7863", "#2D4B37", "#6E91AF", "#2A3C56", "#D4A956"
]

TEXTURES = ["cloth-fine", "leather-embossed", "canvas-matte", "velvet-dark", "paper-vintage"]

def extract_pdf_synopsis(pdf_path):
    try:
        reader = PdfReader(pdf_path)
        if len(reader.pages) > 0:
            text = reader.pages[0].extract_text()
            if text:
                text = re.sub(r'\s+', ' ', text).strip()
                if len(text) > 40:
                    return text[:400] + "..."
    except Exception:
        pass
    return None

def clean_str(val):
    if pd.isna(val) or val is None:
        return ""
    return str(val).strip()

def parse_filename(fname):
    name = fname.replace('.pdf', '')
    if '_-_' in name:
        parts = name.split('_-_')
        title = parts[0].replace('_', ' ').strip()
        author = parts[1].replace('_', ' ').strip()
        return title, author
    elif ' - ' in name:
        parts = name.split(' - ')
        title = parts[0].replace('_', ' ').strip()
        author = parts[1].replace('_', ' ').strip()
        return title, author
    else:
        clean = name.replace('_', ' ').strip()
        return clean, "Unknown Author"

def run_ingestion():
    print(f"Starting data ingestion from {os.path.basename(EXCEL_PATH)}...")
    
    df = None
    if os.path.exists(EXCEL_PATH):
        df = pd.read_excel(EXCEL_PATH)
    
    pdf_files = glob.glob(os.path.join(PDF_DIR, "*.pdf")) if os.path.exists(PDF_DIR) else []
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("DROP TABLE IF EXISTS books")
    cursor.execute("""
    CREATE TABLE books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        genre TEXT,
        series TEXT,
        series_order TEXT,
        year INTEGER,
        status TEXT,
        key_elements TEXT,
        pdf_filename TEXT,
        pdf_path TEXT,
        cover_url TEXT,
        synopsis TEXT,
        rating REAL DEFAULT 4.5,
        spine_color TEXT,
        spine_texture TEXT,
        spine_width INTEGER,
        spine_height INTEGER,
        scrape_status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS recommendations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        recommended_by TEXT,
        note TEXT,
        cover_url TEXT,
        year INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    pdf_map = {}
    for pdf_path in pdf_files:
        fname = os.path.basename(pdf_path)
        title, author = parse_filename(fname)
        norm_key = re.sub(r'[^a-z0-9]', '', title.lower())
        pdf_map[norm_key] = (fname, pdf_path, title, author)

    processed_keys = set()
    records = []

    if df is not None:
        for idx, row in df.iterrows():
            title = clean_str(row.get('Book Title'))
            author = clean_str(row.get('Author'))
            if not title:
                continue

            genre = clean_str(row.get('Genre')) or "Fantasy"
            series = clean_str(row.get('Series'))
            series_order = clean_str(row.get('Series Order'))
            year_val = row.get('Year')
            year = int(year_val) if pd.notna(year_val) and str(year_val).isdigit() else random.randint(2015, 2024)
            status = clean_str(row.get('Status')) or "Finished"
            key_elements = clean_str(row.get('Key Elements'))
            
            norm_key = re.sub(r'[^a-z0-9]', '', title.lower())
            
            pdf_filename = None
            pdf_path = None
            scrape_status = "pending"
            
            matched_pdf = None
            if norm_key in pdf_map:
                matched_pdf = pdf_map[norm_key]
            else:
                for k, v in pdf_map.items():
                    if len(k) > 4 and (k in norm_key or norm_key in k):
                        matched_pdf = v
                        break
            
            if matched_pdf:
                pdf_filename, pdf_path, _, _ = matched_pdf
                processed_keys.add(matched_pdf[0])
                scrape_status = "completed"

            spine_color = random.choice(COLOR_PALETTES)
            spine_texture = random.choice(TEXTURES)
            spine_width = random.randint(22, 34)
            spine_height = random.randint(165, 210)
            rating = round(random.uniform(4.2, 4.9), 1)

            synopsis = f"A captivating volume by {author}. {key_elements if key_elements else 'An enthralling journey of mystery, magic, and emotion.'}"
            if pdf_path:
                extracted = extract_pdf_synopsis(pdf_path)
                if extracted:
                    synopsis = extracted

            cover_url = f"https://covers.openlibrary.org/b/isbn/9780141321004-L.jpg"
            
            records.append((
                title, author, genre, series, series_order, year, status,
                key_elements, pdf_filename, pdf_path, cover_url, synopsis,
                rating, spine_color, spine_texture, spine_width, spine_height,
                scrape_status
            ))

    for fname, pdf_path, title, author in pdf_map.values():
        if fname in processed_keys:
            continue
        
        spine_color = random.choice(COLOR_PALETTES)
        spine_texture = random.choice(TEXTURES)
        spine_width = random.randint(22, 34)
        spine_height = random.randint(165, 210)
        rating = round(random.uniform(4.2, 4.9), 1)
        synopsis = extract_pdf_synopsis(pdf_path) or f"A volume titled '{title}' by {author} in the personal archive."
        
        records.append((
            title, author, "Fantasy", "", "", 2022, "Finished",
            "", fname, pdf_path, None, synopsis,
            rating, spine_color, spine_texture, spine_width, spine_height,
            "completed"
        ))

    cursor.executemany("""
    INSERT INTO books (
        title, author, genre, series, series_order, year, status,
        key_elements, pdf_filename, pdf_path, cover_url, synopsis,
        rating, spine_color, spine_texture, spine_width, spine_height,
        scrape_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, records)

    conn.commit()
    conn.close()
    print(f"Successfully ingested {len(records)} books with scrape_status into {DB_PATH}.")

if __name__ == "__main__":
    run_ingestion()
