from sqlalchemy import extract, func, or_, and_
from datetime import date as dt_date # Crucial fix to prevent namespace collision
from typing import List, Optional
import json
import os

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session
from fastapi.concurrency import run_in_threadpool
from google import genai
from google.genai import types

from app import models
from app.database import get_db
from app.utils import get_today_ist
from enum import Enum

router = APIRouter(prefix="/expenses", tags=["Expenses"])

class ExpenseCategory(str, Enum):
    FOOD = "Food"
    TRAVEL = "Travel"
    ENTERTAINMENT = "Entertainment"
    DEBT_PAYMENT = "Debt Payment"
    MONEY_LENT = "Money Lent"
    COLLEGE = "College"
    HEALTH = "Health"
    OTHER = "Other"

class ExpenseCreate(BaseModel):
    amount: float
    category: ExpenseCategory
    vendor: Optional[str] = None
    description: Optional[str] = None
    user_id: int
    split_with: list[int] | None = None
    date: Optional[dt_date] = None # Fixed Schema
    is_recurring: bool = False

class ExpenseOut(BaseModel):
    id: int
    user_id: int
    amount: float
    category: str
    vendor: Optional[str] = None
    description: Optional[str] = None
    date: dt_date 
    is_recurring: bool = False
    class Config:
        from_attributes = True

class OcrExpenseResult(BaseModel):
    amount: float
    vendor: str
    category: ExpenseCategory
    description: str

@router.post("/", response_model=ExpenseOut)
def create_expense(payload: ExpenseCreate, db: Session = Depends(get_db)):
    expense_date = payload.date or get_today_ist()
    ex_month = expense_date.month
    ex_year = expense_date.year

    total_budget = db.query(func.coalesce(func.sum(models.MonthlyBudget.amount), 0.0)).filter(
        models.MonthlyBudget.user_id == payload.user_id, models.MonthlyBudget.month == ex_month, models.MonthlyBudget.year == ex_year
    ).scalar()

    total_income = db.query(func.coalesce(func.sum(models.Income.amount), 0.0)).filter(
        models.Income.user_id == payload.user_id, extract("month", models.Income.created_at) == ex_month, extract("year", models.Income.created_at) == ex_year
    ).scalar()

    total_expenses = db.query(func.coalesce(func.sum(models.Expense.amount), 0.0)).filter(
        models.Expense.user_id == payload.user_id, extract("month", models.Expense.date) == ex_month, extract("year", models.Expense.date) == ex_year
    ).scalar()

    total_savings_locked = db.query(func.coalesce(func.sum(models.SavingsLock.amount), 0.0)).filter(
        models.SavingsLock.user_id == payload.user_id, extract("month", models.SavingsLock.created_at) == ex_month, extract("year", models.SavingsLock.created_at) == ex_year
    ).scalar()

    available_to_spend = (total_budget + total_income) - total_expenses - total_savings_locked

    overage = 0.0
    if available_to_spend > 0 and payload.amount > available_to_spend:
        overage = payload.amount - available_to_spend
    elif available_to_spend <= 0:
        overage = payload.amount 

    if overage > 0:
        global_savings = db.query(func.coalesce(func.sum(models.SavingsLock.amount), 0.0)).filter(models.SavingsLock.user_id == payload.user_id).scalar()
        withdraw_amount = overage if global_savings >= overage else global_savings

        if withdraw_amount > 0:
            auto_withdrawal = models.SavingsLock(
                user_id=payload.user_id,
                amount=-abs(withdraw_amount),
                purpose=f"Auto-Withdrawal: Covered {payload.vendor or payload.category}",
                created_at=expense_date
            )
            db.add(auto_withdrawal)

    expense = models.Expense(
        user_id=payload.user_id,
        amount=payload.amount,
        category=payload.category,
        vendor=payload.vendor,
        description=payload.description,
        date=expense_date,
        is_recurring=payload.is_recurring
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)

    if payload.split_with:
        from app.models import CreditLedger 
        total_people = len(payload.split_with) + 1
        split_amount = round(payload.amount / total_people, 2)
        for friend_id in payload.split_with:
            new_debt = CreditLedger(
                lender_id=payload.user_id, borrower_id=friend_id, amount=split_amount,
                description=f"Split: {payload.vendor or payload.category}", is_settled=False, date=expense_date
            )
            db.add(new_debt)
        db.commit()
    
    return expense

@router.put("/{expense_id}", response_model=ExpenseOut)
def update_expense(expense_id: int, payload: ExpenseCreate, db: Session = Depends(get_db)):
    expense = db.query(models.Expense).filter(models.Expense.id == expense_id).first()
    if not expense: raise HTTPException(status_code=404, detail="Expense not found")

    expense.user_id = payload.user_id
    expense.amount = payload.amount
    expense.category = payload.category
    expense.vendor = payload.vendor
    expense.description = payload.description
    expense.is_recurring = payload.is_recurring
    
    if payload.date is not None:
        expense.date = payload.date 

    db.commit()
    db.refresh(expense)
    return expense

@router.delete("/{expense_id}")
def delete_expense(expense_id: int, db: Session = Depends(get_db)):
    expense = db.query(models.Expense).filter(models.Expense.id == expense_id).first()
    if not expense: raise HTTPException(status_code=404)
    db.delete(expense)
    db.commit()
    return {"detail": "Expense deleted", "expense_id": expense_id}

@router.get("/user/{user_id}", response_model=List[ExpenseOut])
def get_expenses_by_user(user_id: int, month: int, year: int, db: Session = Depends(get_db)):
    target_date = dt_date(year, month, 1)
    
    return db.query(models.Expense).filter(
        models.Expense.user_id == user_id,
        or_(
            and_(extract("month", models.Expense.date) == month, extract("year", models.Expense.date) == year),
            and_(models.Expense.is_recurring == True, models.Expense.date <= target_date)
        )
    ).order_by(models.Expense.date.desc()).all()


@router.post("/ocr", response_model=OcrExpenseResult)
async def ocr_expense(image: UploadFile = File(...)):
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if not gemini_api_key: raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not set")
    image_bytes = await image.read()
    if not image_bytes: raise HTTPException(status_code=400, detail="Empty image")
    
    prompt = (
        "Extract the payment amount and the vendor name from this UPI screenshot. "
        "Compare the extracted vendor to this official list of Thapar campus shops: "
        "['COS Cafe', 'Jaggi Sweets', 'Giani', 'Nescafe TAN', 'B-Block Canteen', 'Kathi Roll', 'Bikano']. "
        "Based on the vendor, assign a category. The category MUST strictly be one of the following exact strings: "
        "'Food', 'Travel', 'Entertainment', 'Debt Payment', 'Money Lent', 'College', 'Health', or 'Other'. "
        "Return ONLY a raw JSON object with keys: amount (float), vendor (string), "
        "category (string), and description (string like 'Paid X at Y'). "
        "Do not include markdown formatting."
    )
    client = genai.Client(api_key=gemini_api_key)
    response = await run_in_threadpool(
        client.models.generate_content,
        model="gemini-2.5-flash",
        contents=[prompt, types.Part.from_bytes(data=image_bytes, mime_type=image.content_type or "image/png")],
        config=types.GenerateContentConfig(temperature=0, response_mime_type="application/json")
    )
    raw_text = (response.text or "").strip()
    return OcrExpenseResult.model_validate(json.loads(raw_text)).model_dump()