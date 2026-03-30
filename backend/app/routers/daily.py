import os
import json
import shutil
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Optional
import base64

import httpx
from bs4 import BeautifulSoup
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from pydantic import BaseModel
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session
from google import genai
from google.genai import types

from app import models
from app.database import get_db
from app.routers.auth import get_current_user

# Configure Gemini
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY", "YOUR_API_KEY_HERE"))

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

class BunkManualUpdate(BaseModel):
    attended: int
    bunked: int

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

    cache = db.query(models.TimetableCache).filter(models.TimetableCache.batch == batch).first()
    
    if cache:
        # Check if the last sync was within 24 hours
        time_since_update = datetime.utcnow() - cache.updated_at
        if time_since_update < timedelta(hours=24):
            hours_left = 24 - (time_since_update.total_seconds() / 3600)
            raise HTTPException(
                status_code=429, 
                detail=f"Timetable for {batch} was already synced recently. Please wait {hours_left:.1f} hours before syncing again."
            )
    
    try:
        # 1. Initialize the new Client (ensure this is using the new google.genai)
        # Note: You can also move the client initialization to the top of the file
        client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
        
        # 2. Updated Prompt
        prompt = """
        STEP 1: Verify if this image is a college class timetable. 
        If it is NOT a timetable, return exactly: {"error": "not_a_timetable"}
        
        STEP 2: If it IS a timetable, extract the schedule into a strict JSON format for exactly 5 days (Monday-Friday).
        
        CRITICAL INSTRUCTIONS:
        - The text inside the Orange/Yellow badges says "Practical". Treat this as "Lab".
        - There are timetable where some days are almost empty or their are classes in multiple slots with long breaks. Pay attention and extract each class properly.
        - JSON format: [{"day": "Monday", "classes": [{"name": "...", "time": "...", "venue": "...", "type": "..."}]}, ...]
        
        Return ONLY valid JSON.
        """
        
        # 3. Use the new response syntax
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_bytes(data=img_data, mime_type=image.content_type),
                prompt
            ]
        )
        
        raw_text = response.text.strip().replace('```json', '').replace('```', '')
        structured_data = json.loads(raw_text)
        
        # --- THE AI NORMALIZER ---
        if isinstance(structured_data, list):
            for day in structured_data:
                for c in day.get('classes', []):
                    if 'start_time' in c:
                        c['time'] = f"{c['start_time']} - {c.get('end_time', '')}".strip(" -")
                    if c.get('type') == 'Practical':
                        c['type'] = 'Lab'

        # --- SANITY CHECK ---
        if isinstance(structured_data, dict) and structured_data.get("error") == "not_a_timetable":
            raise HTTPException(status_code=400, detail="Nice try, but that's not a timetable. Upload the real deal!")

        all_classes = [c for day in structured_data for c in day.get('classes', [])]
        if len(all_classes) < 3:
            raise HTTPException(status_code=400, detail="This timetable looks empty or invalid.")
        
        # --- DB CACHE LOGIC ---
        existing_cache = db.query(models.TimetableCache).filter(models.TimetableCache.batch == batch).first()
        if existing_cache:
            existing_cache.schedule_data = structured_data
        else:
            db.add(models.TimetableCache(batch=batch, schedule_data=structured_data))
            
        db.commit()
        return structured_data
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail="The AI got confused. Try a clearer screenshot.")
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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


@router.delete("/comms/{comm_id}")
def delete_broadcast(comm_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.email != "tejas1607.best@gmail.com":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Admins can delete.")
        
    comm = db.query(models.Broadcast).filter(models.Broadcast.id == comm_id).first()
    if comm:
        db.delete(comm)
        db.commit()
    return {"status": "deleted"}


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

@router.put("/bunk/{track_id}/manual")
def update_bunk_manual(
    track_id: int, 
    data: BunkManualUpdate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    tracker = db.query(models.BunkTrack).filter(models.BunkTrack.id == track_id, models.BunkTrack.user_id == current_user.id).first()
    if not tracker:
        raise HTTPException(status_code=404, detail="Tracker not found")
        
    tracker.attended = data.attended
    tracker.bunked = data.bunked
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
async def upload_mess_menu(
    hostel: str = Form(...), 
    image: UploadFile = File(...), 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    try:
        # FAST & EASY FIX: Convert the image to a Base64 string
        img_data = await image.read()
        base64_encoded = base64.b64encode(img_data).decode("utf-8")
        
        # Create a Data URI that React can use directly in the <img src="..." />
        mime_type = image.content_type
        image_url = f"data:{mime_type};base64,{base64_encoded}"

        # Save this giant string directly into the database!
        menu = db.query(models.MessMenu).filter(models.MessMenu.hostel == hostel).first()
        if menu:
            menu.image_url = image_url
            menu.uploader_id = current_user.id
        else:
            menu = models.MessMenu(hostel=hostel, image_url=image_url, uploader_id=current_user.id)
            db.add(menu)
            
        db.commit()
        return {
            "image_url": image_url,
            "uploader_name": current_user.name
        }
    except Exception as e:
        print(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail="Failed to process image.")
    

from datetime import datetime, timedelta

@router.post("/mess-menu/{menu_id}/report")
def report_mess_menu(menu_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    menu = db.query(models.MessMenu).filter(models.MessMenu.id == menu_id).first()
    if not menu:
        raise HTTPException(status_code=404, detail="Menu not found.")
        
    # Safely initialize if the column is null
    if menu.report_count is None:
        menu.report_count = 0
        
    menu.report_count += 1
    
    if menu.report_count >= 3:
        # Safely try to find the uploader_id or user_id depending on your model schema
        owner_id = getattr(menu, 'uploader_id', getattr(menu, 'user_id', None))
        
        if owner_id:
            uploader = db.query(models.User).filter(models.User.id == owner_id).first()
            if uploader:
                uploader.banned_until = datetime.utcnow() + timedelta(days=7)
        
        db.delete(menu)
        db.commit()
        return {"message": "Menu received 3 strikes and was automatically removed. The uploader has been banned."}
        
    db.commit()
    return {"message": f"Menu reported successfully. Current strikes: {menu.report_count}/3"}