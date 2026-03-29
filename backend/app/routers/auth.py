import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from google.oauth2 import id_token
from google.auth.transport import requests

from app import models
from app.database import get_db

SECRET_KEY = "MARZI@MERI?"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 

GOOGLE_CLIENT_ID = "372265007546-l79uh0fiofspf15rrtc1q71f0ihr40nt.apps.googleusercontent.com"

router = APIRouter(prefix="/auth", tags=["Authentication"])

class GoogleAuthRequest(BaseModel):
    token: str 

class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    batch: Optional[str] = None
    semester: Optional[int] = None
    hostel: Optional[str] = None
    stream: Optional[str] = None
    roll_number: Optional[str] = None

class TokenOut(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    name: str

class UserOut(BaseModel):
    id: int
    name: str
    email: str
    phone: str | None
    university: str
    role: str
    is_verified: bool
    batch: str | None
    semester: int
    hostel: str | None
    stream: str | None
    roll_number: str | None
    class Config:
        from_attributes = True

def get_current_user(token: str, db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    return user

@router.post("/google", response_model=TokenOut)
def google_auth(req: GoogleAuthRequest, db: Session = Depends(get_db)):
    try:
        idinfo = id_token.verify_oauth2_token(req.token, requests.Request(), GOOGLE_CLIENT_ID)
        
        email = idinfo['email']
        name = idinfo.get('name', 'Student')

        is_thapar_email = email.endswith("@thapar.edu")
        is_tejas = email == "tejas1607.best@gmail.com"

        if is_tejas:
            assigned_role = "super_admin"
            name = "ADMIN"
        elif is_thapar_email:
            assigned_role = "student"
        else:
            assigned_role = "guest"

        user = db.query(models.User).filter(models.User.email == email).first()

        if not user:
            user = models.User(
                email=email,
                name=name,
                role=assigned_role,
                is_verified=True if is_tejas else is_thapar_email,
                batch="1A84" if assigned_role == "student" else "Unassigned",
                hostel="Day Scholar" if assigned_role == "student" else "Unassigned",
                stream=None if is_tejas else "COE"
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        elif user.role != assigned_role or (is_tejas and user.name != "ADMIN"):
            user.role = assigned_role
            user.is_verified = True if is_tejas else is_thapar_email
            if is_tejas:
                user.name = "ADMIN"
            db.commit()
            db.refresh(user)

        access_token = jwt.encode(
            {"sub": str(user.id), "exp": datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)}, 
            SECRET_KEY, algorithm=ALGORITHM
        )
        return {"access_token": access_token, "token_type": "bearer", "user_id": user.id, "name": user.name}

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid Google Authentication Token")

@router.get("/me", response_model=UserOut)
def get_me(token: str, db: Session = Depends(get_db)):
    return get_current_user(token, db)

@router.put("/me", response_model=UserOut)
def update_me(payload: UserUpdate, token: str, db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    
    # We use 'is not None' so that empty strings or "Unassigned" are properly saved!
    if payload.name is not None: user.name = payload.name
    if payload.phone is not None: user.phone = payload.phone
    if payload.batch is not None: user.batch = payload.batch
    if payload.hostel is not None: user.hostel = payload.hostel
    if payload.stream is not None: user.stream = payload.stream
    if payload.roll_number is not None: user.roll_number = payload.roll_number
    
    if user.role == "guest":
        user.semester = 1
    elif payload.semester is not None: 
        user.semester = payload.semester

    db.commit()
    db.refresh(user)
    return user

@router.post("/migrate")
def migrate_to_thapar(req: GoogleAuthRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "guest":
        raise HTTPException(status_code=400, detail="Only guests can migrate accounts.")
    
    try:
        idinfo = id_token.verify_oauth2_token(req.token, requests.Request(), GOOGLE_CLIENT_ID)
        new_email = idinfo['email']
        
        if not new_email.endswith("@thapar.edu"):
            raise HTTPException(status_code=400, detail="You must link an official @thapar.edu email.")
            
        existing = db.query(models.User).filter(models.User.email == new_email).first()
        if existing:
            raise HTTPException(status_code=400, detail="This Thapar ID is already registered.")
            
        current_user.email = new_email
        current_user.role = "student"
        current_user.is_verified = True
        db.commit()
        
        return {"message": "Migration successful. Welcome officially to CampusFLOW."}
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid Google Token.")