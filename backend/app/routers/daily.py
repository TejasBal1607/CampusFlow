import os
import json
import shutil
from pathlib import Path
from datetime import datetime
from typing import List, Optional

import httpx
from bs4 import BeautifulSoup
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from pydantic import BaseModel
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session
import google.generativeai as genai

from app import models
from app.database import get_db
from app.routers.auth import get_current_user

# Configure Gemini
genai.configure(api_key=os.environ.get("GEMINI_API_KEY", "YOUR_API_KEY_HERE"))

router = APIRouter(prefix="/daily", tags=["Daily HUD"])

# ==========================================
# SCHEMAS
# ==========================================
class BroadcastCreate(BaseModel):
    tag: str
    text: str
    urgent: bool = False
    target_batch: Optional[str] = None
    target_hostel: Optional[str] = None
    target_stream: Optional[str] = None
    target_year: Optional[int] = None

class BroadcastOut(BaseModel):
    id: int
    tag: str
    text: str
    urgent: bool
    created_at: datetime
    class Config:
        from_attributes = True

class BunkSubjectCreate(BaseModel):
    subject: str

class BunkAction(BaseModel):
    action: str # 'attend', 'bunk', 'cancel', 'reset'

class BunkTrackOut(BaseModel):
    id: int
    subject: str
    attended: int
    bunked: int
    cancelled: int
    class Config:
        from_attributes = True

# ==========================================
# TIMETABLE SYNC ROUTES
# ==========================================
@router.get("/timetable")
async def get_timetable(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    batch = current_user.batch
    if not batch:
        raise HTTPException(status_code=400, detail="User batch not set.")

    # Check Database Cache
    cached_schedule = db.query(models.TimetableCache).filter(models.TimetableCache.batch == batch).first()
    
    if cached_schedule and cached_schedule.schedule_data:
        return cached_schedule.schedule_data

    # If it's not in the database, return a 404 to tell React to show the "Upload" button
    raise HTTPException(status_code=404, detail="Timetable not synced yet.")

@router.post("/timetable/sync")
async def sync_timetable(
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    batch = current_user.batch
    if not batch:
        raise HTTPException(status_code=400, detail="User batch not set.")
        
    img_data = await image.read()
    
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        prompt = """
        You are an expert data extractor. Convert this college timetable image into a strict JSON format. 
        The JSON MUST be a list of objects, where each object represents a day of the week (Monday to Friday).
        
        Each day must have a 'day' string, and a 'classes' array.
        Each class inside the array must have:
        - "name": The subject name (abbreviations are fine).
        - "faculty": The teacher's name (if missing, put "TBA").
        - "time": The time slot (e.g., "08:50 AM - 10:30 AM").
        - "venue": The room/lab number.
        - "type": Classify as exactly "Lecture", "Lab", or "Tutorial" based on context.
        
        Return ONLY valid JSON. No markdown backticks.
        """
        
        response = model.generate_content([
            {'mime_type': image.content_type, 'data': img_data},
            prompt
        ])
        
        # FIXED: Clean the response to ensure pure JSON
        raw_text = response.text.strip()
        if raw_text.startswith('```json'):
            raw_text = raw_text[7:]
        if raw_text.endswith('```'):
            raw_text = raw_text[:-3]
            
        structured_data = json.loads(raw_text.strip())
        
        # Save it to the Vault so the rest of the batch gets it instantly!
        new_cache = models.TimetableCache(batch=batch, schedule_data=structured_data)
        db.add(new_cache)
        db.commit()
        
        return structured_data
        
    except Exception as e:
        print(f"Gemini parsing failed: {e}")
        raise HTTPException(status_code=500, detail="AI failed to parse the timetable image.")


# ==========================================
# COMMS RADAR ROUTES
# ==========================================
@router.post("/comms", response_model=BroadcastOut)
def create_broadcast(
    payload: BroadcastCreate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    # SECURITY: Only your specific email can broadcast
    if current_user.email != "tejas1607.best@gmail.com":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Only Admins can transmit on the Comms Radar."
        )
        
    new_comm = models.Broadcast(
        tag=payload.tag,
        text=payload.text,
        urgent=payload.urgent,
        target_batch=payload.target_batch,
        target_hostel=payload.target_hostel,
        target_stream=payload.target_stream,
        target_year=payload.target_year,
        creator_id=current_user.id
    )
    db.add(new_comm)
    db.commit()
    db.refresh(new_comm)
    return new_comm

@router.get("/comms", response_model=List[BroadcastOut])
def get_comms(
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    # Calculate user's year for targeting (e.g. 2025)
    import re
    match = re.search(r'_be(\d{2})@thapar\.edu', current_user.email)
    user_year = int("20" + match.group(1)) if match else None

    # Fetch broadcasts that are either Global (all targets null) OR match the user's specific identity
    comms = db.query(models.Broadcast).filter(
        and_(
            or_(models.Broadcast.target_batch == None, models.Broadcast.target_batch == current_user.batch),
            or_(models.Broadcast.target_hostel == None, models.Broadcast.target_hostel == current_user.hostel),
            or_(models.Broadcast.target_stream == None, models.Broadcast.target_stream == current_user.stream),
            or_(models.Broadcast.target_year == None, models.Broadcast.target_year == user_year),
        )
    ).order_by(models.Broadcast.created_at.desc()).limit(20).all()
    
    return comms


# ==========================================
# BUNK METER ROUTES
# ==========================================
@router.get("/bunk", response_model=List[BunkTrackOut])
def get_bunk_stats(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.BunkTrack).filter(models.BunkTrack.user_id == current_user.id).all()

@router.post("/bunk", response_model=BunkTrackOut)
def add_bunk_subject(payload: BunkSubjectCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    existing = db.query(models.BunkTrack).filter(
        models.BunkTrack.user_id == current_user.id, 
        models.BunkTrack.subject == payload.subject
    ).first()
    
    if existing:
        return existing
        
    new_tracker = models.BunkTrack(user_id=current_user.id, subject=payload.subject)
    db.add(new_tracker)
    db.commit()
    db.refresh(new_tracker)
    return new_tracker

@router.put("/bunk/{track_id}")
def update_bunk_stat(track_id: int, action_data: BunkAction, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    tracker = db.query(models.BunkTrack).filter(models.BunkTrack.id == track_id, models.BunkTrack.user_id == current_user.id).first()
    if not tracker:
        raise HTTPException(status_code=404, detail="Tracker not found")
        
    if action_data.action == 'attend': tracker.attended += 1
    elif action_data.action == 'bunk': tracker.bunked += 1
    elif action_data.action == 'cancel': tracker.cancelled += 1
    elif action_data.action == 'reset': 
        tracker.attended = 0
        tracker.bunked = 0
        tracker.cancelled = 0
        
    db.commit()
    db.refresh(tracker)
    return tracker

@router.delete("/bunk/{track_id}")
def delete_bunk_subject(track_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    tracker = db.query(models.BunkTrack).filter(models.BunkTrack.id == track_id, models.BunkTrack.user_id == current_user.id).first()
    if tracker:
        db.delete(tracker)
        db.commit()
    return {"status": "deleted"}


# ==========================================
# MESS MENU ROUTES
# ==========================================
UPLOAD_DIR = Path("uploads/menus")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

@router.get("/mess-menu")
def get_mess_menu(hostel: str, db: Session = Depends(get_db)):
    menu = db.query(models.MessMenu).filter(models.MessMenu.hostel == hostel).first()
    if not menu:
        raise HTTPException(status_code=404, detail="No menu uploaded yet")
        
    return {
        "image_url": menu.image_url,
        "uploader_name": menu.uploader.name if menu.uploader else "Unknown",
        "updated_at": menu.updated_at
    }

@router.post("/mess-menu")
def upload_mess_menu(
    hostel: str = Form(...), 
    image: UploadFile = File(...), 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    file_extension = image.filename.split(".")[-1]
    file_name = f"{hostel.replace(' ', '_')}_{datetime.utcnow().timestamp()}.{file_extension}"
    file_path = UPLOAD_DIR / file_name
    
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(image.file, buffer)
        
    image_url = f"/uploads/menus/{file_name}"

    menu = db.query(models.MessMenu).filter(models.MessMenu.hostel == hostel).first()
    if menu:
        menu.image_url = image_url
        menu.uploader_id = current_user.id
    else:
        menu = models.MessMenu(hostel=hostel, image_url=image_url, uploader_id=current_user.id)
        db.add(menu)
        
    db.commit()
    db.refresh(menu)
    
    return {
        "image_url": menu.image_url,
        "uploader_name": current_user.name
    }