from sqlalchemy import Column, Integer, String, Float, ForeignKey, Date, Boolean, func
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from utils import get_today_ist
Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    phone = Column(String, nullable=True)
    university = Column(String, default="Thapar Institute of Engineering & Technology")
    
    # Security
    hashed_password = Column(String)
    
    # Campus Identity (Settings)
    batch = Column(String, default="1A84")
    semester = Column(Integer, default=1)
    hostel = Column(String, default="Day Scholar")
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

    owner = relationship("User", back_populates="incomes")


class MonthlyBudget(Base):
    __tablename__ = "monthly_budgets"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    month = Column(Integer)  # expected: 1-12
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
    lender_id = Column(Integer, ForeignKey("users.id"))  
    borrower_id = Column(Integer, ForeignKey("users.id")) 
    amount = Column(Float, nullable=False)
    description = Column(String)
    date = Column(Date, default=get_today_ist())
    is_settled = Column(Boolean, default=False)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Track who created the entry