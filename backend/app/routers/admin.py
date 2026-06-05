from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text, inspect
from app import models
from app.database import get_db
from app.routers.auth import get_current_user

router = APIRouter(prefix="/admin", tags=["God Mode"])

def require_super_admin(current_user: models.User = Depends(get_current_user)):
    if current_user.role != "super_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super Admins only.")
    return current_user

# ==========================================
# 1. MODERATOR TAB (Fetch ALL items)
# ==========================================
@router.get("/menus")
def get_all_menus(db: Session = Depends(get_db), admin: models.User = Depends(require_super_admin)):
    return db.query(models.MessMenu).all()

@router.delete("/menus/{menu_id}")
def delete_menu(menu_id: int, db: Session = Depends(get_db), admin: models.User = Depends(require_super_admin)):
    menu = db.query(models.MessMenu).filter(models.MessMenu.id == menu_id).first()
    if menu:
        db.delete(menu)
        db.commit()
    return {"message": "Menu deleted."}

@router.get("/vault")
def get_all_resources(db: Session = Depends(get_db), admin: models.User = Depends(require_super_admin)):
    return db.query(models.AcadResource).all()

@router.put("/vault/{resource_id}/approve")
def approve_resource(resource_id: int, db: Session = Depends(get_db), admin: models.User = Depends(require_super_admin)):
    resource = db.query(models.AcadResource).filter(models.AcadResource.id == resource_id).first()
    if resource:
        resource.status = "approved"
        db.commit()
    return {"message": "Resource approved."}

@router.delete("/vault/{resource_id}/reject")
def reject_resource(resource_id: int, db: Session = Depends(get_db), admin: models.User = Depends(require_super_admin)):
    resource = db.query(models.AcadResource).filter(models.AcadResource.id == resource_id).first()
    if resource:
        db.delete(resource)
        db.commit()
    return {"message": "Resource rejected."}

# 🚀 MARKETPLACE QUEUE
@router.get("/market")
def get_all_market(db: Session = Depends(get_db), admin: models.User = Depends(require_super_admin)):
    return db.query(models.MarketListing).order_by(models.MarketListing.created_at.desc()).all()

@router.put("/market/{item_id}/approve")
def approve_market(item_id: int, db: Session = Depends(get_db), admin: models.User = Depends(require_super_admin)):
    item = db.query(models.MarketListing).filter(models.MarketListing.id == item_id).first()
    if item: 
        item.status = "approved"
        db.commit()
    return {"status": "approved"}

@router.delete("/market/{item_id}/reject")
def reject_market(item_id: int, db: Session = Depends(get_db), admin: models.User = Depends(require_super_admin)):
    item = db.query(models.MarketListing).filter(models.MarketListing.id == item_id).first()
    if item: 
        db.delete(item)
        db.commit()
    return {"status": "rejected"}
    
# 🚀 EVENTS QUEUE
@router.get("/events")
def get_all_events(db: Session = Depends(get_db), admin: models.User = Depends(require_super_admin)):
    return db.query(models.Event).order_by(models.Event.created_at.desc()).all()

@router.put("/events/{event_id}/approve")
def approve_event(event_id: int, db: Session = Depends(get_db), admin: models.User = Depends(require_super_admin)):
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if event: 
        event.status = "approved"
        db.commit()
    return {"status": "approved"}

@router.delete("/events/{event_id}/reject")
def reject_event(event_id: int, db: Session = Depends(get_db), admin: models.User = Depends(require_super_admin)):
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if event: 
        db.delete(event)
        db.commit()
    return {"status": "rejected"}

# ==========================================
# 2. DATABASE CRUD
# ==========================================

@router.get("/db/tables")
def get_tables(db: Session = Depends(get_db), admin: models.User = Depends(require_super_admin)):
    inspector = inspect(db.get_bind())
    return inspector.get_table_names()

@router.get("/db/table/{table_name}")
def get_table_data(table_name: str, db: Session = Depends(get_db), admin: models.User = Depends(require_super_admin)):
    result = db.execute(text(f"SELECT * FROM {table_name} ORDER BY id DESC LIMIT 100"))
    return [dict(row._mapping) for row in result]

@router.post("/db/table/{table_name}/raw")
def execute_raw_sql(table_name: str, payload: dict, action: str, db: Session = Depends(get_db), admin: models.User = Depends(require_super_admin)):
    try:
        if action == "delete":
            db.execute(text(f"DELETE FROM {table_name} WHERE id = :id"), {"id": payload.get("id")})
        elif action == "update":
            row_id = payload.pop("id")
            set_clause = ", ".join([f"{k} = :{k}" for k in payload.keys()])
            payload["id"] = row_id 
            db.execute(text(f"UPDATE {table_name} SET {set_clause} WHERE id = :id"), payload)
        elif action == "insert":
            cols = ", ".join(payload.keys())
            vals = ", ".join([f":{k}" for k in payload.keys()])
            db.execute(text(f"INSERT INTO {table_name} ({cols}) VALUES ({vals})"), payload)
            
        db.commit()
        return {"message": f"Action {action} successful."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))