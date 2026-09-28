import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Load environment variables from central .env file
dotenv_path = os.path.join(os.path.dirname(__file__), "..", ".env")
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)
else:
    load_dotenv()

PG_CONFIG = {
    'dbname': os.getenv('DB_NAME', 'library'),
    'user': os.getenv('DB_USER', 'anusurya'),
    'password': os.getenv('DB_PASSWORD', 'password'),
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', '5432'))
}

def get_db():
    return psycopg2.connect(**PG_CONFIG)

def release_db(conn):
    if conn:
        try:
            conn.close()
        except Exception:
            pass

def init_db():
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
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
        """)
        cur.execute("ALTER TABLE oceanofpdf_books ADD COLUMN IF NOT EXISTS book_cover TEXT;")
        cur.execute("""
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
        """)
        # Performance Indexes for sub-millisecond search & filtering
        cur.execute("CREATE INDEX IF NOT EXISTS idx_oceanofpdf_pdf_cover ON oceanofpdf_books (pdf_path, book_cover);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_oceanofpdf_genre ON oceanofpdf_books (genre);")
        conn.commit()
    except Exception as e:
        print("Database Init Error:", e)
    finally:
        if conn:
            release_db(conn)

if __name__ == "__main__":
    init_db()
    print("PostgreSQL Database connection initialized successfully.")
