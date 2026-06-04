from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import json
import requests
import os


from app.database import get_db
from app import models

router = APIRouter(prefix="/bazaar", tags=["Bazaar"])

# --- SCHEMAS ---
class MarketItemCreate(BaseModel):
    user_id: int
    title: str
    price: float
    description: str
    tags: List[str]
    image_url: str

class EventCreate(BaseModel):
    user_id: int
    title: str
    venue: str
    start_time: datetime
    end_time: datetime
    description: str
    poster_url: str
    registration_link: Optional[str] = None
    info_link: Optional[str] = None

# --- MARKETPLACE ENDPOINTS ---
@router.get("/market")
def get_market_items(db: Session = Depends(get_db)):
    items = db.query(models.MarketListing).filter(models.MarketListing.is_sold == False).order_by(models.MarketListing.created_at.desc()).all()
    results = []
    
    for item in items:
        raw_tags = item.tags
        parsed_tags = []
        if isinstance(raw_tags, list):
            parsed_tags = raw_tags
        elif isinstance(raw_tags, str):
            try: parsed_tags = json.loads(raw_tags)
            except: parsed_tags = [raw_tags]

        seller = db.query(models.User).filter(models.User.id == item.seller_id).first()
        phone = seller.phone if (seller and seller.phone) else "0000000000"
        time_str = item.created_at.isoformat() + "Z" if item.created_at else None

        results.append({
            "id": item.id,
            "seller_id": item.seller_id, 
            "title": item.title or "Untitled",
            "price": item.price or 0.0,
            "description": item.description or "",
            "tags": parsed_tags, 
            "image_url": item.image_url or "https://via.placeholder.com/400",
            "time_posted": time_str,
            "whatsapp": phone
        })
    return results

@router.post("/market")
def create_market_item(payload: MarketItemCreate, db: Session = Depends(get_db)):
    new_item = models.MarketListing(
        seller_id=payload.user_id,
        title=payload.title,
        price=payload.price,
        description=payload.description,
        tags=payload.tags,
        image_url=payload.image_url,
        is_sold=False
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return {"status": "success", "id": new_item.id}

@router.put("/market/{item_id}")
def update_market_item(item_id: int, payload: MarketItemCreate, db: Session = Depends(get_db)):
    item = db.query(models.MarketListing).filter(models.MarketListing.id == item_id).first()
    if not item: raise HTTPException(status_code=404, detail="Item not found")
    if item.seller_id != payload.user_id: raise HTTPException(status_code=403, detail="Not authorized")
    
    item.title = payload.title
    item.price = payload.price
    item.description = payload.description
    item.tags = payload.tags
    if payload.image_url:
        item.image_url = payload.image_url
        
    db.commit()
    return {"status": "updated"}

@router.delete("/market/{item_id}")
def delete_market_item(item_id: int, user_id: int, db: Session = Depends(get_db)):
    item = db.query(models.MarketListing).filter(models.MarketListing.id == item_id).first()
    if not item: raise HTTPException(status_code=404, detail="Item not found")
    if item.seller_id != user_id: raise HTTPException(status_code=403, detail="Not authorized")
    
    db.delete(item)
    db.commit()
    return {"status": "deleted"}

@router.put("/market/{item_id}/sold")
def mark_item_sold(item_id: int, user_id: int, db: Session = Depends(get_db)):
    item = db.query(models.MarketListing).filter(models.MarketListing.id == item_id).first()
    if not item: raise HTTPException(status_code=404, detail="Item not found")
    if item.seller_id != user_id: raise HTTPException(status_code=403, detail="Not authorized")
    
    item.is_sold = True 
    db.commit()
    return {"status": "marked_as_sold"}

# --- EVENTS ENDPOINTS ---
@router.get("/events")
def get_events(db: Session = Depends(get_db)):
    now = datetime.utcnow()
    events = db.query(models.Event).filter(
        models.Event.status != "rejected",
        models.Event.end_time >= now
    ).order_by(models.Event.start_time.asc()).all()
    
    results = []
    for e in events:
        org = db.query(models.User).filter(models.User.id == e.organizer_id).first()
        org_name = org.name if (org and org.name) else "CampusFLOW"
        date_str = e.start_time.strftime("%b %d, %I:%M %p") if e.start_time else "TBA"

        liked_by = e.liked_by_users
        if isinstance(liked_by, str):
            try: liked_by = json.loads(liked_by)
            except: liked_by = []
        elif not isinstance(liked_by, list):
            liked_by = []

        results.append({
            "id": e.id,
            "organizer": org_name,
            "title": e.title or "Untitled",
            "venue": e.venue or "TBA",
            "date": date_str,
            "desc": e.description or "",
            "poster_url": e.poster_url or "https://via.placeholder.com/800",
            "registration_link": e.registration_link,
            "info_link": e.info_link,
            "likes": len(liked_by), # Length of the array is the true like count
            "liked_by": liked_by
        })
    return results

@router.post("/events")
def create_event(payload: EventCreate, db: Session = Depends(get_db)):
    new_event = models.Event(
        organizer_id=payload.user_id,
        title=payload.title,
        venue=payload.venue,
        start_time=payload.start_time,
        end_time=payload.end_time,
        description=payload.description,
        poster_url=payload.poster_url,
        registration_link=payload.registration_link,
        info_link=payload.info_link,
        status="approved" 
    )
    db.add(new_event)
    db.commit()
    db.refresh(new_event)
    return {"status": "success", "id": new_event.id}

@router.put("/events/{event_id}/like")
def toggle_like(event_id: int, user_id: int, db: Session = Depends(get_db)):
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event: raise HTTPException(404, detail="Event not found")
    
    liked_by = event.liked_by_users
    if isinstance(liked_by, str):
        try: liked_by = json.loads(liked_by)
        except: liked_by = []
    elif not isinstance(liked_by, list):
        liked_by = []
    else:
        liked_by = list(liked_by) # Ensure mutable copy

    if user_id in liked_by:
        liked_by.remove(user_id)
    else:
        liked_by.append(user_id)
        
    event.liked_by_users = liked_by
    event.likes = len(liked_by)
    
    db.commit()
    return {"likes": event.likes}

@router.post("/events/sync-instagram")
def sync_instagram_post(payload: dict):
    insta_url = payload.get("url")
    if not insta_url:
        raise HTTPException(400, "No URL provided")

    clean_url = insta_url.split("?")[0]
    api_key = os.getenv("RAPID_API_KEY")

    try:
        url = "https://instagram-looter2.p.rapidapi.com/post"
        querystring = {"url": clean_url}
        headers = {
            "x-rapidapi-key": api_key,
            "x-rapidapi-host": "instagram-looter2.p.rapidapi.com"
        }

        response = requests.get(url, headers=headers, params=querystring, timeout=10)
        data = response.json()
        
        # 1. Grab Video/Image URL
        media_url = data.get("video_url") or data.get("display_url") or ""
        
        # 2. Grab the Caption text robustly
        caption = ""
        try:
            if data.get("caption") and isinstance(data["caption"], str):
                caption = data["caption"]
            elif "edge_media_to_caption" in data:
                edges = data["edge_media_to_caption"].get("edges", [])
                if edges:
                    caption = edges[0].get("node", {}).get("text", "")
        except Exception:
            pass

        # 3. Grab the Organizer (Reel Owner / Society Handle)
        organizer = ""
        try:
            if "owner" in data:
                organizer = data["owner"].get("username", "")
            elif "user" in data:
                organizer = data["user"].get("username", "")
        except Exception:
            pass

        if media_url:
            return {
                "title": "Insta Event (Edit Me!)",
                "desc": caption,
                "poster_url": media_url,
                "venue": "TBA",
                "organizer": organizer # <-- Sends the society name to the frontend
            }
            
    except Exception as e:
        print(f"❌ API Sync Failed: {e}")

    return {
        "title": "Campus Tech Hackathon",
        "desc": "Join us for the ultimate 24 hour coding showdown! 🚀 Bring your laptops and your best ideas. #tech #hackathon\n\n" + clean_url,
        "poster_url": "https://www.w3schools.com/html/mov_bbb.mp4", 
        "venue": "TAN Auditorium",
        "organizer": "Demo_Society"
    }