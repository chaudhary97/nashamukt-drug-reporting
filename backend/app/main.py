
'''

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.routes import router

from app.config import settings
from app.database import get_db

# Initialize FastAPI
app = FastAPI(
    title=settings.APP_NAME,
    description="Anonymous Drug Reporting and Government Action Platform",
    version="1.0.0"
)

# Allow Next.js frontend to communicate with FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)


# Home endpoint
@app.get("/")
def home():
    return {
        "message": "Welcome to NashaMukt API",
        "project": "Anonymous Drug Reporting Platform",
        "status": "Running"
    }


# Backend health check
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "backend": "running"
    }


# Database connection check
@app.get("/health/database")
def database_health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "database": "connected"
        }
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Database connection failed"
        )

        '''



from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.routes import router
from app.config import settings
from app.database import get_db

app = FastAPI(
    title=settings.APP_NAME,
    description="Anonymous Drug Reporting and Government Action Platform",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
def home():
    return {
        "message": "Welcome to NashaMukt API",
        "project": "Anonymous Drug Reporting Platform",
        "status": "Running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "backend": "running"
    }


@app.get("/health/database")
def database_health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "database": "connected"
        }
    except Exception as error:
        print(f"Database health check failed: {error}")
        raise HTTPException(
            status_code=503,
            detail="Database connection failed"
        )
