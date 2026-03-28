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

# Security Configuration
SECRET_KEY = "MARZI@MERI?"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 7 Days

GOOGLE_CLIENT_ID = "372265007546-l79uh0fiofspf15rrtc1q71f0ihr40nt.apps.googleusercontent.com"

router = APIRouter(prefix="/auth", tags=["Authentication"])

# --- SCHEMAS ---
class GoogleAuthRequest(BaseModel):
    token: str 

# FIX: Added stream and roll_number
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

# FIX: Added stream and roll_number (Made them Optional to prevent 500 crashes)
class UserOut(BaseModel):
    id: int
    name: str
    email: str
    phone: str | None
    university: str
    batch: str
    semester: int
    hostel: str
    stream: str | None
    roll_number: str | None
    class Config:
        from_attributes = True

# --- DEPENDENCY: GET CURRENT USER ---
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

# --- ROUTES ---
@router.post("/google", response_model=TokenOut)
def google_auth(req: GoogleAuthRequest, db: Session = Depends(get_db)):
    try:
        idinfo = id_token.verify_oauth2_token(req.token, requests.Request(), GOOGLE_CLIENT_ID)
        
        email = idinfo['email']
        name = idinfo.get('name', 'Student')

        if not email.endswith('@thapar.edu') and email != 'tejas1607.best@gmail.com':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="Access Denied. You must use a @thapar.edu email to join."
            )

        user = db.query(models.User).filter(models.User.email == email).first()
        
        if not user:
            user = models.User(
                name=name, 
                email=email, 
                university="Thapar Institute of Engineering & Technology",
            )
            db.add(user)
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
    
    if payload.name: user.name = payload.name
    if payload.phone: user.phone = payload.phone
    if payload.batch: user.batch = payload.batch
    if payload.semester: user.semester = payload.semester
    if payload.hostel: user.hostel = payload.hostel
    if payload.stream: user.stream = payload.stream
    if payload.roll_number: user.roll_number = payload.roll_number

    db.commit()
    db.refresh(user)
    return user