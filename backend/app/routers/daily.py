import os
import json
import re
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
    action: str

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
MASTER_TIMETABLE = {}
TIMETABLE_FILE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "master_timetable.json")
if os.path.exists(TIMETABLE_FILE_PATH):
    with open(TIMETABLE_FILE_PATH, "r") as f:
        MASTER_TIMETABLE = json.load(f)

def normalize_request_batch(batch_str: str):
    """Converts user input '2E1A' into '2E11' to match JSON keys."""
    batch_str = re.sub(r'\s+', '', str(batch_str).upper())
    mapping = {'A': '1', 'B': '2', 'C': '3', 'D': '4', 'E': '5', 'F': '6', 'G': '7', 'H': '8'}
    if not batch_str: return batch_str
    
    if len(batch_str) >= 4 and batch_str[-1].isalpha() and batch_str[-1] in mapping and batch_str[-2].isdigit():
        return batch_str[:-1] + mapping[batch_str[-1]]
    return batch_str

@router.get("/timetable")
async def get_timetable(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    batch = current_user.batch
    if not batch or batch == "Unassigned":
        raise HTTPException(status_code=400, detail="User batch not set.")

    batch_key = normalize_request_batch(batch)
    main_group_key = batch_key[:-1] if len(batch_key) >= 4 else batch_key

    user_schedule = [{"day": d, "classes": []} for d in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']]
    found_data = False

    # Grab Lectures
    if main_group_key in MASTER_TIMETABLE:
        found_data = True
        for i, day in enumerate(MASTER_TIMETABLE[main_group_key]):
            user_schedule[i]["classes"].extend(day["classes"])

    # Grab Labs/Tutorials
    if batch_key in MASTER_TIMETABLE:
        found_data = True
        for i, day in enumerate(MASTER_TIMETABLE[batch_key]):
            user_schedule[i]["classes"].extend(day["classes"])

    if not found_data:
        raise HTTPException(status_code=404, detail="Timetable not found for your batch.")

    # Chronological sort
    def time_to_mins(time_str):
        try:
            hm, period = time_str.split(' ')
            h, m = map(int, hm.split(':'))
            if period == 'PM' and h != 12: h += 12
            if period == 'AM' and h == 12: h = 0
            return h * 60 + m
        except: return 0

    for day in user_schedule:
        day["classes"] = sorted(day["classes"], key=lambda c: time_to_mins(c["time"]))

    return user_schedule

@router.post("/timetable/sync")
async def sync_timetable():
    raise HTTPException(status_code=400, detail="Timetables are centrally automated now!")


# ==========================================
# COMMS RADAR ROUTES
# ==========================================
@router.post("/comms", response_model=BroadcastOut)
def create_broadcast(
    payload: BroadcastCreate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
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
    import re
    match = re.search(r'_be(\d{2})@thapar\.edu', current_user.email)
    user_year = int("20" + match.group(1)) if match else None

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


@router.delete("/bunk/reset")
def reset_bunk_meter(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role == "guest":
        raise HTTPException(status_code=403, detail="Guests cannot reset bunk data.")
        
    db.query(models.BunkTrack).filter(models.BunkTrack.user_id == current_user.id).delete()
    db.commit()
    return {"message": "Bunk meter wiped clean."}


# FIX: MOVED THIS UP SO IT CATCHES BEFORE THE DYNAMIC ID ROUTE
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
@router.get("/mess-menu")
def get_mess_menu(hostel: str, db: Session = Depends(get_db)):
    menu = db.query(models.MessMenu).filter(models.MessMenu.hostel == hostel).first()
    if not menu:
        raise HTTPException(status_code=404, detail="No menu uploaded yet")
        
    return {
        "id": menu.id,
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
        img_data = await image.read()
        base64_encoded = base64.b64encode(img_data).decode("utf-8")
        mime_type = image.content_type
        image_url = f"data:{mime_type};base64,{base64_encoded}"

        menu = db.query(models.MessMenu).filter(models.MessMenu.hostel == hostel).first()
        if menu:
            menu.image_url = image_url
            menu.uploader_id = current_user.id
            menu.report_count = 0  # Reset reports on new upload
            if hasattr(menu, 'reporters'):
                menu.reporters = ""
        else:
            menu = models.MessMenu(hostel=hostel, image_url=image_url, uploader_id=current_user.id)
            db.add(menu)
            
        db.commit()
        db.refresh(menu)
        
        return {
            "id": menu.id,
            "image_url": image_url,
            "uploader_name": current_user.name
        }
    except Exception as e:
        print(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail="Failed to process image.")
    
@router.post("/mess-menu/{menu_id}/report")
def report_mess_menu(menu_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    menu = db.query(models.MessMenu).filter(models.MessMenu.id == menu_id).first()
    if not menu:
        raise HTTPException(status_code=404, detail="Menu not found.")
        
    # --- GOAL 2: Admin Immunity ---
    owner_id = getattr(menu, 'uploader_id', getattr(menu, 'user_id', None))
    owner = None
    if owner_id:
        owner = db.query(models.User).filter(models.User.id == owner_id).first()
        if owner and owner.role == "super_admin":
            raise HTTPException(status_code=403, detail="You cannot report an official Admin menu.")

    # --- GOAL 1: Prevent Duplicate Spam ---
    reporters = []
    if hasattr(menu, 'reporters') and menu.reporters:
        reporters = menu.reporters.split(",")
        
    if str(current_user.id) in reporters:
        raise HTTPException(status_code=400, detail="You have already flagged this menu. The community will review it.")
        
    if menu.report_count is None:
        menu.report_count = 0
        
    menu.report_count += 1
    reporters.append(str(current_user.id))
    
    if hasattr(menu, 'reporters'):
        menu.reporters = ",".join(reporters)
    
    if menu.report_count >= 3:
        if owner and owner.role != "super_admin":
            owner.banned_until = datetime.utcnow() + timedelta(days=7)
            
        db.delete(menu)
        db.commit()
        return {"message": "Menu received 3 strikes and was automatically removed. The uploader has been banned."}
        
    db.commit()
    return {"message": f"Menu flagged successfully. Current strikes: {menu.report_count}/3"}