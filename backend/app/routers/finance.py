import calendar
from utils import get_today_ist
from datetime import date as dt_date # Prevent naming collisions
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import extract, func, or_, and_
from sqlalchemy.orm import Session

import models
from database import get_db

router = APIRouter(prefix="/finance", tags=["Finance"])

class IncomeCreate(BaseModel):
    user_id: int
    amount: float
    source: str
    created_at: Optional[dt_date] = None 
    description: Optional[str] = None
    is_recurring: bool = False

class SavingsCreate(BaseModel):
    user_id: int
    amount: float
    purpose: str
    created_at: Optional[dt_date] = None 

class IncomeUpdate(BaseModel):
    amount: Optional[float] = None
    source: Optional[str] = None
    description: Optional[str] = None
    created_at: Optional[dt_date] = None 
    is_recurring: Optional[bool] = None


class SavingsUpdate(BaseModel):
    amount: Optional[float] = None
    purpose: Optional[str] = None
    created_at: Optional[dt_date] = None 

class IncomeOut(BaseModel):
    id: int
    user_id: int
    amount: float
    source: str
    description: Optional[str] = None
    created_at: Optional[dt_date] = None 
    is_recurring: bool = False
    class Config:
        from_attributes = True

class SavingsOut(BaseModel):
    id: int
    user_id: int
    amount: float
    purpose: str
    created_at: Optional[dt_date] = None 
    class Config:
        from_attributes = True

class BudgetCreate(BaseModel):
    user_id: int
    month: int  
    year: int
    amount: float

class SavingsWithdraw(BaseModel):
    user_id: int
    amount: float
    purpose: str
    created_at: Optional[dt_date] = None

class FinanceSummaryOut(BaseModel):
    user_id: int
    month: int
    year: int
    total_budget: float
    total_income: float
    total_expenses: float
    category_breakdown: Dict[str, float]
    monthly_savings: float       
    total_savings_locked: float
    net_cash: float
    available_to_spend: float
    credit_out: float
    credit_in: float
    ideal_month_avg: float
    current_avg: float
    needed_avg: float
    daily_percentage: float

class BudgetOut(BaseModel):
    id: int
    user_id: int
    month: int
    year: int
    amount: float
    class Config:
        from_attributes = True

@router.post("/savings/lock", response_model=SavingsOut)
def lock_savings(payload: SavingsCreate, db: Session = Depends(get_db)):
    lock = models.SavingsLock(
        user_id=payload.user_id,
        amount=payload.amount,
        purpose=payload.purpose,
        created_at=payload.created_at # Pydantic already converted this to a date!
    )
    db.add(lock)
    db.commit()
    db.refresh(lock)
    return lock

@router.post("/savings/withdraw", response_model=SavingsOut)
def withdraw_savings(payload: SavingsWithdraw, db: Session = Depends(get_db)):
    total_savings = db.query(func.coalesce(func.sum(models.SavingsLock.amount), 0.0)).filter(
        models.SavingsLock.user_id == payload.user_id
    ).scalar()

    if payload.amount > total_savings:
        raise HTTPException(status_code=400, detail=f"Insufficient funds.")

    withdrawal = models.SavingsLock(
        user_id=payload.user_id,
        amount=-abs(payload.amount),  
        purpose=f"Withdrawal: {payload.purpose}",
        created_at=payload.created_at # Pass directly!
    )
    db.add(withdrawal)
    db.commit()
    db.refresh(withdrawal)
    return withdrawal

@router.get("/savings/user/{user_id}", response_model=List[SavingsOut])
def get_savings(user_id: int, month: int, year: int, db: Session = Depends(get_db)):
    savings = db.query(models.SavingsLock).filter(
        models.SavingsLock.user_id == user_id,
        extract("month", models.SavingsLock.created_at) == month,
        extract("year", models.SavingsLock.created_at) == year
    ).order_by(models.SavingsLock.created_at.desc()).all()
    return savings

@router.put("/savings/{lock_id}", response_model=SavingsOut)
def update_savings(lock_id: int, payload: SavingsUpdate, db: Session = Depends(get_db)):
    savings_item = db.query(models.SavingsLock).filter(models.SavingsLock.id == lock_id).first()
    if payload.amount is not None: savings_item.amount = payload.amount
    if payload.purpose is not None: savings_item.purpose = payload.purpose
    if payload.created_at is not None: savings_item.created_at = payload.created_at 
    db.commit()
    db.refresh(savings_item)
    return savings_item

@router.delete("/savings/{lock_id}")
def delete_savings(lock_id: int, db: Session = Depends(get_db)):
    lock = db.query(models.SavingsLock).filter(models.SavingsLock.id == lock_id).first()
    if not lock: raise HTTPException(status_code=404, detail="Not found.")
    db.delete(lock)
    db.commit()
    return {"detail": "Deleted", "id": lock_id}

@router.post("/income", response_model=IncomeOut)
def log_income(payload: IncomeCreate, db: Session = Depends(get_db)):
    income = models.Income(
        user_id=payload.user_id,
        amount=payload.amount,
        source=payload.source,
        description=payload.description,
        created_at=payload.created_at, # Pass directly!
        is_recurring=payload.is_recurring
    )
    db.add(income)
    db.commit()
    db.refresh(income)
    return income

@router.get("/income/user/{user_id}", response_model=List[IncomeOut])
def get_incomes(user_id: int, month: int, year: int, db: Session = Depends(get_db)):
    target_date = dt_date(year, month, 1)
    
    return db.query(models.Income).filter(
        models.Income.user_id == user_id,
        or_(
            and_(extract("month", models.Income.created_at) == month, extract("year", models.Income.created_at) == year),
            and_(models.Income.is_recurring == True, models.Income.created_at <= target_date)
        )
    ).order_by(models.Income.created_at.desc()).all()

@router.put("/income/{income_id}", response_model=IncomeOut)
def update_income(income_id: int, payload: IncomeUpdate, db: Session = Depends(get_db)):
    income = db.query(models.Income).filter(models.Income.id == income_id).first()
    if not income: raise HTTPException(status_code=404, detail="Not found")

    if payload.amount is not None: income.amount = payload.amount
    if payload.source is not None: income.source = payload.source
    if payload.description is not None: income.description = payload.description
    if payload.created_at is not None: income.created_at = payload.created_at 
    if hasattr(payload, 'is_recurring') and payload.is_recurring is not None:
        income.is_recurring = payload.is_recurring
    db.commit()
    db.refresh(income)
    return income

@router.delete("/income/{income_id}")
def delete_income(income_id: int, db: Session = Depends(get_db)):
    income = db.query(models.Income).filter(models.Income.id == income_id).first()
    if not income: raise HTTPException(status_code=404)
    db.delete(income)
    db.commit()
    return {"detail": "Deleted", "id": income_id}

@router.post("/budget", response_model=BudgetOut)
def set_or_update_budget(payload: BudgetCreate, db: Session = Depends(get_db)):
    existing_budgets = db.query(models.MonthlyBudget).filter(
        models.MonthlyBudget.user_id == payload.user_id,
        models.MonthlyBudget.month == payload.month,
        models.MonthlyBudget.year == payload.year,
    ).all()

    if existing_budgets:
        primary = existing_budgets[0]
        primary.amount = payload.amount
        db.add(primary)
        for duplicate in existing_budgets[1:]:
            db.delete(duplicate)
        db.commit()
        db.refresh(primary)
        return primary

    budget = models.MonthlyBudget(
        user_id=payload.user_id, month=payload.month, year=payload.year, amount=payload.amount,
    )
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return budget

@router.get("/summary/{user_id}", response_model=FinanceSummaryOut)
def summary(user_id: int, month: int, year: int, db: Session = Depends(get_db)):
    total_budget = db.query(func.coalesce(func.sum(models.MonthlyBudget.amount), 0.0)).filter(
        models.MonthlyBudget.user_id == user_id, models.MonthlyBudget.month == month, models.MonthlyBudget.year == year
    ).scalar()

    target_date = dt_date(year, month, 1)

    total_income = db.query(func.coalesce(func.sum(models.Income.amount), 0.0)).filter(
        models.Income.user_id == user_id,
        or_(
            and_(extract("month", models.Income.created_at) == month, extract("year", models.Income.created_at) == year),
            and_(models.Income.is_recurring == True, models.Income.created_at <= target_date)
        )
    ).scalar()

    total_expenses = db.query(func.coalesce(func.sum(models.Expense.amount), 0.0)).filter(
        models.Expense.user_id == user_id,
        or_(
            and_(extract("month", models.Expense.date) == month, extract("year", models.Expense.date) == year),
            and_(models.Expense.is_recurring == True, models.Expense.date <= target_date)
        )
    ).scalar()

    category_totals = db.query(models.Expense.category, func.coalesce(func.sum(models.Expense.amount), 0.0)).filter(
        models.Expense.user_id == user_id, extract("month", models.Expense.date) == month, extract("year", models.Expense.date) == year
    ).group_by(models.Expense.category).all()
    category_breakdown = {cat: amount for cat, amount in category_totals}

    monthly_savings = db.query(func.coalesce(func.sum(models.SavingsLock.amount), 0.0)).filter(
        models.SavingsLock.user_id == user_id, extract("month", models.SavingsLock.created_at) == month, extract("year", models.SavingsLock.created_at) == year
    ).scalar()

    total_savings_locked = db.query(func.coalesce(func.sum(models.SavingsLock.amount), 0.0)).filter(models.SavingsLock.user_id == user_id).scalar()

    money_lent_out = db.query(func.coalesce(func.sum(models.CreditLedger.amount), 0.0)).filter(
        models.CreditLedger.lender_id == user_id, models.CreditLedger.is_settled == False
    ).scalar()

    money_borrowed = db.query(func.coalesce(func.sum(models.CreditLedger.amount), 0.0)).filter(
        models.CreditLedger.borrower_id == user_id, models.CreditLedger.is_settled == False
    ).scalar()

    net_cash = (total_budget + total_income) - total_expenses
    available_to_spend = max(0, net_cash - monthly_savings)
    
    today = get_today_ist()
    _, total_days_in_month = calendar.monthrange(year, month)
    
    if month == today.month and year == today.year:
        days_passed = today.day
        days_remaining = (total_days_in_month - days_passed) + 1 
    elif year < today.year or (year == today.year and month < today.month):
        days_passed = total_days_in_month
        days_remaining = 0
    else:
        days_passed = 0
        days_remaining = total_days_in_month

    ideal_month_avg = round(((total_budget + total_income) - monthly_savings) / total_days_in_month, 2) if total_days_in_month > 0 else 0.0
    current_avg = round(total_expenses / days_passed, 2) if days_passed > 0 else 0.0
    needed_avg = round(available_to_spend / days_remaining, 2) if days_remaining > 0 else 0.0

    spent_today = db.query(func.sum(models.Expense.amount)).filter(
        models.Expense.user_id == user_id, func.date(models.Expense.date) == today
    ).scalar() or 0.0

    if ideal_month_avg > 0:
        raw_percentage = ((ideal_month_avg - spent_today) / ideal_month_avg) * 100
        daily_percentage = max(0, raw_percentage) 
    else:
        daily_percentage = 0
    
    return FinanceSummaryOut(
        user_id=user_id, month=month, year=year, total_budget=total_budget, total_income=total_income,
        total_expenses=total_expenses, category_breakdown=category_breakdown, monthly_savings=monthly_savings,
        total_savings_locked=total_savings_locked, net_cash=net_cash, available_to_spend=available_to_spend,
        credit_out=money_lent_out, credit_in=money_borrowed, ideal_month_avg=ideal_month_avg,
        current_avg=current_avg, needed_avg=needed_avg, daily_percentage=daily_percentage
    )