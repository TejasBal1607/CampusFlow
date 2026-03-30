from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.routers.auth import get_current_user 
from app import models
from app.database import get_db

router = APIRouter(prefix="/users", tags=["Users"])

class UserCreate(BaseModel):
    roll_number: str
    stream: str = "COE"
    batch: str = "1A84"
    semester: int = 1
    hostel: str = "Day Scholar"
    university: str = "Thapar Institute of Engineering & Technology"
    name: str
    phone : Optional[str] = None
    email: EmailStr

class UserOut(BaseModel):
    id: int
    name: str
    email: str
    phone: Optional[str] = None
    batch: str
    stream: Optional[str] = None      # FIX: Made Optional
    semester: int
    hostel: str
    roll_number: Optional[str] = None # FIX: Made Optional
    
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
    if len(query) < 3:
        return [] 

    results = db.query(models.User).filter(
        or_(
            models.User.phone.ilike(f"%{query}%"),
            models.User.name.ilike(f"%{query}%")
        ),
        models.User.id != current_user.id,
        models.User.role != "super_admin"
    ).limit(5).all()
    
    return results