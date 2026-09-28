import os
import sys

# Ensure backend directory is in python path
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from routers import books, recommendations

# Production Security Settings: Disable public API docs unless ENABLE_DOCS=true
enable_docs = os.getenv("ENABLE_DOCS", "false").lower() == "true"

app = FastAPI(
    title="Whimsicalwhiner's Library API",
    description="Backend API for Whimsicalwhiner's Library Personal Archive",
    version="1.0.0",
    docs_url="/docs" if enable_docs else None,
    redoc_url="/redoc" if enable_docs else None,
    openapi_url="/openapi.json" if enable_docs else None
)

# CORS Security Settings
allowed_origins_str = os.getenv("ALLOWED_ORIGINS", "*")
allowed_origins = [o.strip() for o in allowed_origins_str.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(books.router)
app.include_router(recommendations.router)

@app.on_event("startup")
def startup_event():
    init_db()

@app.get("/")
def root():
    return {
        "name": "Whimsicalwhiner's Library API",
        "status": "online"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
