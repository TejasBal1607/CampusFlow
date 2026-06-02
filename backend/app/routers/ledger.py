import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app import models
from app.database import get_db

from app.routers.expenses import ExpenseCategory, ExpenseCreate, create_expense

router = APIRouter(prefix="/ledger", tags=["Ledger"])

# --- SCHEMAS ---
class CreditCreate(BaseModel):
    lender_id: Optional[int] = None
    borrower_id: Optional[int] = None
    unregistered_name: Optional[str] = None
    amount: float
    description: str
    date: Optional[datetime.date] = None

class CreditOut(BaseModel):
    id: int
    lender_id: Optional[int] = None
    borrower_id: Optional[int] = None
    unregistered_name: Optional[str] = None
    amount: float
    description: str | None
    date: Optional[datetime.date] = None
    is_settled: bool
    creator_id: Optional[int] = None

    class Config:
        from_attributes = True

class SplitCreate(BaseModel):
    lender_id: int
    total_amount: float
    borrower_ids: List[int] = []
    unregistered_borrowers: List[str] = [] # NEW: Array of string names
    description: str
    date: Optional[datetime.date] = None

class LedgerUpdate(BaseModel):
    amount: Optional[float] = None
    description: Optional[str] = None
    date: Optional[datetime.date] = None


# --- ROUTES ---
@router.post("/split", response_model=List[CreditOut])
def split_expense(payload: SplitCreate, db: Session = Depends(get_db)):
    if payload.total_amount <= 0:
        raise HTTPException(status_code=400, detail="Total amount must be greater than zero.")

    clean_borrowers = [bid for bid in set(payload.borrower_ids) if bid != payload.lender_id]
    
    if not clean_borrowers and not payload.unregistered_borrowers:
        raise HTTPException(status_code=400, detail="Must include at least one valid or unregistered borrower.")

    lender = db.query(models.User).filter(models.User.id == payload.lender_id).first()
    if not lender:
        raise HTTPException(status_code=404, detail="Lender not found.")

    if clean_borrowers:
        existing_borrowers = db.query(models.User).filter(models.User.id.in_(clean_borrowers)).all()
        if len(existing_borrowers) != len(clean_borrowers):
            raise HTTPException(status_code=404, detail="One or more borrower IDs do not exist.")

    # Math includes registered + unregistered + the lender themselves
    total_people = len(clean_borrowers) + len(payload.unregistered_borrowers) + 1
    split_amount = round(payload.total_amount / total_people, 2)
    
    created_ledgers = []
    
    # 1. Create debts for registered users
    for borrower_id in clean_borrowers:
        credit = models.CreditLedger(
            lender_id=payload.lender_id,
            borrower_id=borrower_id,
            amount=split_amount,
            description=f"{payload.description} (Split)",
            date=payload.date,
            creator_id=payload.lender_id
        )
        db.add(credit)
        created_ledgers.append(credit)

    # 2. Create ghost debts for unregistered users
    for unreg_name in payload.unregistered_borrowers:
        credit = models.CreditLedger(
            lender_id=payload.lender_id,
            borrower_id=None,
            unregistered_name=unreg_name.strip(),
            amount=split_amount,
            description=f"{payload.description} (Split)",
            date=payload.date,
            creator_id=payload.lender_id
        )
        db.add(credit)
        created_ledgers.append(credit)
        
    db.commit()
    
    for credit in created_ledgers:
        db.refresh(credit)
        
    return created_ledgers


@router.post("/", response_model=CreditOut)
def create_credit(payload: CreditCreate, db: Session = Depends(get_db)):
    if not payload.lender_id and not payload.borrower_id:
        raise HTTPException(status_code=400, detail="Must provide at least a lender_id or a borrower_id.")
    
    if payload.lender_id and payload.borrower_id and payload.unregistered_name:
        raise HTTPException(status_code=400, detail="Cannot have both users registered AND an unregistered name.")

    if (not payload.lender_id or not payload.borrower_id) and not payload.unregistered_name:
        raise HTTPException(status_code=400, detail="Must provide an unregistered name if one party is outside the database.")

    creator_id = payload.lender_id if payload.lender_id else payload.borrower_id

    credit = models.CreditLedger(
        lender_id=payload.lender_id,
        borrower_id=payload.borrower_id,
        unregistered_name=payload.unregistered_name,
        amount=payload.amount,
        description=payload.description,
        date=payload.date,
        creator_id=creator_id
    )
    db.add(credit)
    db.commit()
    db.refresh(credit)
    return credit


@router.get("/user/{user_id}", response_model=List[CreditOut])
def get_user_ledger(user_id: int, db: Session = Depends(get_db)):
    # This automatically fetches all debts involving the user, even if the other party is unregistered.
    return (
        db.query(models.CreditLedger)
        .filter(or_(models.CreditLedger.lender_id == user_id, models.CreditLedger.borrower_id == user_id))
        .all()
    )


@router.put("/{ledger_id}/settle", response_model=CreditOut)
@router.put("/settle/{ledger_id}", response_model=CreditOut)
def settle_ledger(ledger_id: int, db: Session = Depends(get_db)):
    credit = db.query(models.CreditLedger).filter(models.CreditLedger.id == ledger_id).first()
    if not credit:
        raise HTTPException(status_code=404, detail="Ledger entry not found")

    if not credit.is_settled:
        # Default the names to the unregistered string first
        lender_name = credit.unregistered_name if not credit.lender_id else None
        borrower_name = credit.unregistered_name if not credit.borrower_id else None

        # Process Registered Lender
        if credit.lender_id:
            lender = db.query(models.User).filter(models.User.id == credit.lender_id).first()
            lender_name = lender.name if lender and lender.name else f"User {credit.lender_id}"
            
            income = models.Income(
                user_id=credit.lender_id,
                amount=credit.amount,
                source=f"Settled Debt with {borrower_name}", 
                description=f"{credit.description}"
            )
            db.add(income)

        # Process Registered Borrower
        if credit.borrower_id:
            borrower = db.query(models.User).filter(models.User.id == credit.borrower_id).first()
            borrower_name = borrower.name if borrower and borrower.name else f"User {credit.borrower_id}"
            
            settlement_payload = ExpenseCreate(
                user_id=credit.borrower_id,
                amount=credit.amount,
                category=ExpenseCategory.DEBT_PAYMENT, 
                vendor=f"Settled debt with {lender_name}",
                description=credit.description,
                split_with=None
            )
            create_expense(payload=settlement_payload, db=db) 

        credit.is_settled = True
        db.commit()
        db.refresh(credit)
        
    return credit

@router.put("/{ledger_id}")
def update_ledger(ledger_id: int, payload: LedgerUpdate, db: Session = Depends(get_db)):
    ledger = db.query(models.CreditLedger).filter(models.CreditLedger.id == ledger_id).first()
    if payload.amount is not None: ledger.amount = payload.amount
    if payload.description is not None: ledger.description = payload.description
    if payload.date is not None: ledger.date = payload.date 

    db.commit()
    db.refresh(ledger)
    return ledger   

@router.delete("/{ledger_id}")
def delete_ledger_entry(ledger_id: int, db: Session = Depends(get_db)):
    ledger_entry = db.query(models.CreditLedger).filter(models.CreditLedger.id == ledger_id).first()
    if not ledger_entry:
        raise HTTPException(status_code=404, detail="Ledger entry not found.")

    db.delete(ledger_entry)
    db.commit()
    
    return {"detail": "Ledger entry permanently deleted.", "id": ledger_id}