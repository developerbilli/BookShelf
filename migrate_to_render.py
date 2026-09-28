#!/usr/bin/env python3
"""
Database Migration Script: Local PostgreSQL -> Render Cloud PostgreSQL

Usage:
    python migrate_to_render.py "postgresql://user:password@dpg-xxx-a.singapore-postgres.render.com/library_db"
"""

import sys
import os
import psycopg2
from psycopg2.extras import execute_values, RealDictCursor

# Local DB Config
LOCAL_PG_CONFIG = {
    'dbname': os.getenv('DB_NAME', 'library'),
    'user': os.getenv('DB_USER', 'anusurya'),
    'password': os.getenv('DB_PASSWORD', 'password'),
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', '5432'))
}

def migrate(render_conn_string: str):
    print("=" * 60)
    print("🚀 MIGRATING LOCAL POSTGRESQL -> RENDER CLOUD POSTGRESQL 🚀")
    print("=" * 60)

    print("\n[1/3] Connecting to Local PostgreSQL...")
    local_conn = psycopg2.connect(**LOCAL_PG_CONFIG)
    local_cur = local_conn.cursor(cursor_factory=RealDictCursor)

    print("[2/3] Connecting to Render Cloud PostgreSQL...")
    try:
        render_conn = psycopg2.connect(render_conn_string)
        render_cur = render_conn.cursor()
    except Exception as e:
        print(f"❌ Failed to connect to Render PostgreSQL: {e}")
        print("\nTip: Make sure you pass your Render 'External Database URL' in quotes.")
        sys.exit(1)

    print("\n[3/3] Creating Database Tables on Render...")
    render_cur.execute("""
    CREATE TABLE IF NOT EXISTS oceanofpdf_books (
        id SERIAL PRIMARY KEY,
        book_link TEXT UNIQUE NOT NULL,
        book_name TEXT,
        author TEXT,
        released_date TEXT,
        language TEXT,
        genre TEXT,
        book_cover TEXT,
        pdf_filename TEXT,
        pdf_path TEXT,
        scrape_status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS genre_links (
        id SERIAL PRIMARY KEY,
        genre_name TEXT UNIQUE NOT NULL,
        genre_url TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS recommendations (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        recommended_by TEXT,
        note TEXT,
        cover_url TEXT,
        year INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_oceanofpdf_pdf_cover ON oceanofpdf_books (pdf_path, book_cover);
    CREATE INDEX IF NOT EXISTS idx_oceanofpdf_genre ON oceanofpdf_books (genre);
    """)
    render_conn.commit()

    # 1. Migrate genre_links
    print("\n📦 Syncing table `genre_links`...")
    local_cur.execute("SELECT genre_name, genre_url, status FROM genre_links")
    g_rows = local_cur.fetchall()
    if g_rows:
        records = [(r["genre_name"], r["genre_url"], r["status"]) for r in g_rows]
        execute_values(
            render_cur,
            """
            INSERT INTO genre_links (genre_name, genre_url, status)
            VALUES %s
            ON CONFLICT (genre_name) DO UPDATE SET
                genre_url = EXCLUDED.genre_url,
                status = EXCLUDED.status
            """,
            records,
            page_size=1000
        )
        render_conn.commit()
        print(f"   ✓ Synced {len(records)} genres.")

    # 2. Migrate oceanofpdf_books
    print("\n📚 Syncing table `oceanofpdf_books` (36,740 volumes)...")
    local_cur.execute("""
    SELECT book_link, book_name, author, released_date, language, genre, book_cover, pdf_filename, pdf_path, scrape_status
    FROM oceanofpdf_books
    """)
    b_rows = local_cur.fetchall()
    if b_rows:
        b_records = [
            (
                r["book_link"], r["book_name"], r["author"], r["released_date"],
                r["language"], r["genre"], r["book_cover"], r["pdf_filename"],
                r["pdf_path"], r["scrape_status"]
            )
            for r in b_rows
        ]
        
        batch_size = 2000
        total_synced = 0
        for i in range(0, len(b_records), batch_size):
            batch = b_records[i:i + batch_size]
            execute_values(
                render_cur,
                """
                INSERT INTO oceanofpdf_books 
                (book_link, book_name, author, released_date, language, genre, book_cover, pdf_filename, pdf_path, scrape_status)
                VALUES %s
                ON CONFLICT (book_link) DO UPDATE SET
                    book_name = EXCLUDED.book_name,
                    author = EXCLUDED.author,
                    released_date = EXCLUDED.released_date,
                    genre = EXCLUDED.genre,
                    book_cover = EXCLUDED.book_cover,
                    pdf_filename = EXCLUDED.pdf_filename,
                    pdf_path = EXCLUDED.pdf_path
                """,
                batch,
                page_size=1000
            )
            render_conn.commit()
            total_synced += len(batch)
            print(f"   ↳ Synced {total_synced} / {len(b_records)} volumes...")

    local_conn.close()
    render_conn.close()
    print("\n" + "=" * 60)
    print("✨ SUCCESS! All database tables synced to Render Cloud! ✨")
    print("=" * 60)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python migrate_to_render.py \"postgresql://user:password@host/dbname\"")
        sys.exit(1)
    
    conn_url = sys.argv[1]
    migrate(conn_url)
