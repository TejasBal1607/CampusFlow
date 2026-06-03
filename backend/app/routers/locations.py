from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from app.database import get_db
from app import models

router = APIRouter(prefix="/locations", tags=["Locations"])

class LocationCreate(BaseModel):
    name: str
    category: str
    desc: str
    coords: List[float]
    image_url: str
    open_time: str

@router.get("/")
def get_locations(db: Session = Depends(get_db)):
    locs = db.query(models.Location).all()
    results = []
    for l in locs:
        # Convert the DB string "y,x" back into a float array
        y, x = map(float, l.coordinates.split(",")) if l.coordinates else [0, 0]
        
        # Extract category from JSON array
        cat = l.category[0] if l.category and isinstance(l.category, list) and len(l.category) > 0 else "Misc"
        
        results.append({
            "id": l.id,
            "name": l.name,
            "category": cat,
            "desc": l.description,
            "coords": [y, x],
            "rating": l.avg_rating,
            "image_url": l.image_url,
            "open_time": "24/7" # You can add this to your DB model later if needed
        })
    return results

@router.post("/")
def create_location(data: LocationCreate, db: Session = Depends(get_db)):
    new_loc = models.Location(
        name=data.name,
        description=data.desc,
        image_url=data.image_url,
        coordinates=f"{data.coords[0]},{data.coords[1]}",
        category=[data.category], # Wrapping in array as per your DB schema
        avg_rating=5.0
    )
    db.add(new_loc)
    db.commit()
    db.refresh(new_loc)
    return {"status": "success", "id": new_loc.id}