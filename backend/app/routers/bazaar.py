from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, String
from typing import List, Optional
from app.database import get_db
from app.models import Location, LocationReview

router = APIRouter(prefix="/navigator", tags=["Campus Navigator"])

@router.get("/search")
def smart_search_locations(query: Optional[str] = "", db: Session = Depends(get_db)):
    """
    Smart Search: 
    1. Searches Location Name
    2. Searches Description
    3. Searches the JSON Tags (e.g., 'printout', 'food', 'stationary')
    4. Calculates the average review rating
    5. Orders results by highest rating first
    """
    
    # 1. Subquery to calculate Average Rating and Total Review Count per location
    review_stats = db.query(
        LocationReview.location_id,
        func.round(func.avg(LocationReview.rating), 1).label('avg_rating'),
        func.count(LocationReview.id).label('review_count')
    ).group_by(LocationReview.location_id).subquery()

    # 2. Main Query: Join Locations with their calculated Review Stats
    base_query = db.query(
        Location, 
        func.coalesce(review_stats.c.avg_rating, 0).label('avg_rating'), # Default to 0 if no reviews
        func.coalesce(review_stats.c.review_count, 0).label('review_count')
    ).outerjoin(review_stats, Location.id == review_stats.c.location_id)

    # 3. The "Smart Search" Logic
    if query:
        search_term = f"%{query.lower()}%"
        base_query = base_query.filter(
            or_(
                func.lower(Location.name).like(search_term),
                func.lower(Location.description).like(search_term),
                # If using Postgres, you can cast JSON to text to search inside it!
                func.cast(Location.tags, String).ilike(search_term) 
            )
        )

    # 4. Order by Highest Rating First
    results = base_query.order_by(review_stats.c.avg_rating.desc().nullslast()).all()

    # 5. Format the JSON payload for React
    formatted_results = []
    for loc, avg_rating, review_count in results:
        formatted_results.append({
            "id": loc.id,
            "name": loc.name,
            "description": loc.description,
            "tags": loc.tags, # e.g. ["Stationary", "Printout"]
            "coordinates": [float(x) for x in loc.coordinates.split(',')] if loc.coordinates else [0,0],
            "rating": avg_rating,
            "reviews": review_count
        })

    return formatted_results