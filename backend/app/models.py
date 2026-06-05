from sqlalchemy import JSON, Column, DateTime, Integer, String, Float, ForeignKey, Date, Boolean, func
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
from app.utils import get_today_ist # Assuming this is your custom util

Base = declarative_base()

# ==========================================
# EXISTING CORE TABLES (MODIFIED)
# ==========================================

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    phone = Column(String, nullable=True)
    university = Column(String, default="Thapar Institute of Engineering & Technology")
    
    # Campus Identity (Settings)
    roll_number = Column(String, unique=True, index=True)
    stream = Column(String, default="COE")
    batch = Column(String, default="1A84")
    semester = Column(Integer, default=1)
    hostel = Column(String, default="Day Scholar")
    
    # --- NEW: RBAC & MODERATION ---
    role = Column(String, default="student") # 'guest', 'student', 'class_admin', 'hostel_admin', 'super_admin'
    is_verified = Column(Boolean, default=False) # False for Gmails, True for Thapar emails
    banned_until = Column(DateTime, nullable=True) # If set and in the future, user cannot upload/post
    
    # Relationships
    expenses = relationship("Expense", back_populates="owner")
    incomes = relationship("Income", back_populates="owner")
    savings_locks = relationship("SavingsLock", back_populates="owner")


class Expense(Base):
    __tablename__ = "expenses"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    amount = Column(Float, nullable=False)
    category = Column(String, nullable=False) 
    vendor = Column(String) 
    description = Column(String)
    date = Column(Date, default=get_today_ist())
    is_recurring = Column(Boolean, default=False)
    end_date = Column(Date, nullable=True)
    owner = relationship("User", back_populates="expenses")


class Income(Base):
    __tablename__ = "incomes"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    amount = Column(Float, nullable=False)
    source = Column(String)
    description = Column(String)
    created_at = Column(Date, default=get_today_ist())
    is_recurring = Column(Boolean, default=False)
    end_date = Column(Date, nullable=True)
    owner = relationship("User", back_populates="incomes")


class MonthlyBudget(Base):
    __tablename__ = "monthly_budgets"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    month = Column(Integer)  
    year = Column(Integer)
    amount = Column(Float, nullable=False)


class SavingsLock(Base):
    __tablename__ = "savings_locks"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    amount = Column(Float, nullable=False)
    purpose = Column(String)
    created_at = Column(Date, default=get_today_ist())
    owner = relationship("User", back_populates="savings_locks")


class CreditLedger(Base):
    __tablename__ = "credit_ledger"
    id = Column(Integer, primary_key=True, index=True)
    lender_id = Column(Integer, ForeignKey("users.id"), nullable=True)  
    borrower_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    unregistered_name = Column(String, nullable=True) 
    amount = Column(Float, nullable=False)
    description = Column(String)
    date = Column(Date, default=get_today_ist())
    is_settled = Column(Boolean, default=False)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=True) 


class Broadcast(Base):
    __tablename__ = "broadcasts"
    id = Column(Integer, primary_key=True, index=True)
    tag = Column(String, index=True) 
    text = Column(String)
    urgent = Column(Boolean, default=False)
    
    target_batch = Column(String, nullable=True)
    target_hostel = Column(String, nullable=True)
    target_stream = Column(String, nullable=True)
    target_year = Column(Integer, nullable=True)
    
    creator_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)


class BunkTrack(Base):
    __tablename__ = "bunk_tracks"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    subject = Column(String)
    attended = Column(Integer, default=0)
    bunked = Column(Integer, default=0)
    cancelled = Column(Integer, default=0)


class MessMenu(Base):
    __tablename__ = "mess_menus"
    id = Column(Integer, primary_key=True, index=True)
    hostel = Column(String, unique=True, index=True) 
    image_url = Column(String)
    uploader_id = Column(Integer, ForeignKey("users.id"))
    
    # --- NEW: STRIKE SYSTEM ---
    report_count = Column(Integer, default=0)
    reporters = Column(String, default="")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    uploader = relationship("User")


class AcadResource(Base):
    __tablename__ = "acad_resources"
    id = Column(Integer, primary_key=True, index=True)
    uploader_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String, nullable=False)
    file_url = Column(String, nullable=False) 
    
    tags = Column(JSON, default=list) # Array of strings e.g. ["PYQ", "UPH004", "Year 1"]
    
    status = Column(String, default="pending") # 'pending', 'approved', 'rejected'
    created_at = Column(DateTime, default=datetime.utcnow)


class MarketListing(Base):
    __tablename__ = "market_listings"
    id = Column(Integer, primary_key=True, index=True)
    seller_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String, nullable=False)
    description = Column(String)
    price = Column(Float, nullable=False)
    image_url = Column(String) 
    
    tags = Column(JSON, default=list) # e.g. ["Electronics", "Cooler"]
    
    is_sold = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="pending") # "pending", "approved", "rejected"


class Location(Base):
    __tablename__ = "locations"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    description = Column(String)
    image_url = Column(String)
    coordinates = Column(String, nullable=True) # e.g. "30.3564,76.3647"
    category = Column(JSON, default=list) # e.g. ["Eatery", "Open Late", "Coffee"]
    avg_rating = Column(Float, default=0.0) # Updated via triggers or application logic


class LocationRatings(Base):
    __tablename__ = "location_ratings"
    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(Integer, ForeignKey("locations.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    rating = Column(Integer, nullable=False) # 1 to 5


class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True, index=True)
    organizer_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String, nullable=False)
    description = Column(String)
    poster_url = Column(String, nullable=False) # Crucial for the Insta-Story UI
    venue = Column(String)
    registration_link = Column(String, nullable=True)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False) # Frontend will use this to auto-delete expired stories
    likes = Column(Integer, default=0)
    info_link = Column(String, nullable=True) # For "More Info" button on the event story
    organizer_name = Column(String, nullable=True)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    liked_by_users = Column(JSON, default=list) # 🚀 Tracks WHO liked the event

class TODO(Base):
    __tablename__ = "todos"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    task = Column(String, nullable=False)
    is_completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
