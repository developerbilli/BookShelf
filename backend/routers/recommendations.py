from fastapi import APIRouter, HTTPException
from database import get_db
from models import RecommendationCreate

router = APIRouter(prefix="/api/recommendations", tags=["Recommendations"])

@router.post("/")
def create_recommendation(rec: RecommendationCreate):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO recommendations (title, author, recommended_by, note, cover_url, year)
    VALUES (?, ?, ?, ?, ?, ?)
    """, (rec.title, rec.author, rec.recommended_by, rec.note, rec.cover_url, rec.year))
    conn.commit()
    rec_id = cursor.lastrowid
    conn.close()
    
    return {"status": "success", "id": rec_id, "message": "Book recommended successfully"}

@router.get("/")
def list_recommendations():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM recommendations ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(r) for r in rows]
