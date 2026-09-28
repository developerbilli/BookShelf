from pydantic import BaseModel
from typing import Optional, List

class BookSchema(BaseModel):
    id: int
    title: str
    author: str
    genre: Optional[str] = "Fiction"
    series: Optional[str] = None
    series_order: Optional[str] = None
    year: Optional[int] = 2023
    status: Optional[str] = "Finished"
    key_elements: Optional[str] = None
    pdf_filename: Optional[str] = None
    has_pdf: bool = False
    cover_url: Optional[str] = None
    synopsis: Optional[str] = None
    rating: float = 4.5
    spine_color: str = "#8B4513"
    spine_texture: str = "leather-1"
    spine_width: int = 32
    spine_height: int = 240

class RecommendationCreate(BaseModel):
    title: str
    author: str
    recommended_by: Optional[str] = "Anonymous"
    note: Optional[str] = ""
    cover_url: Optional[str] = None
    year: Optional[int] = None

class RecommendationSchema(RecommendationCreate):
    id: int
    created_at: str
