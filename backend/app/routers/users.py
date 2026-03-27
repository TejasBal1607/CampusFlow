from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import or_
from sqlalchemy.orm import Session

# Make sure this import path matches your project structure
from app.routers.auth import get_current_user 
from app import models
from app.database import get_db

router = APIRouter(prefix="/users", tags=["Users"])

class UserCreate(BaseModel):
    university: str = "Thapar Institute of Engineering & Technology"
    name: str
    phone : Optional[str] = None
    email: EmailStr

class UserOut(BaseModel):
    id: int
    name: str
    email: str
    # FIX: Made phone optional so it doesn't crash if a user hasn't set one yet
    phone: Optional[str] = None
    batch: str
    
    class Config:
        from_attributes = True

@router.post("/", response_model=UserOut)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = models.User(
        university=payload.university,
        name=payload.name,
        email=payload.email,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.get("/", response_model=List[UserOut])
def get_all_users(
    query: str, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    """
    Search for friends by exact phone number or partial name.
    Limits to 5 results for privacy.
    """
    if len(query) < 3:
        return [] # Don't search if they only typed 1 or 2 letters

    # Search logic: matches phone or a partial name match (case-insensitive)
    results = db.query(models.User).filter(
        or_(
            models.User.phone.ilike(f"%{query}%"),
            models.User.name.ilike(f"%{query}%")
        ),
        models.User.id != current_user.id # Don't return the user searching
    ).limit(5).all()
    
    return results