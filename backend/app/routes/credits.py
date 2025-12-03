"""
Credit management routes
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from pydantic import BaseModel

from ..core.db import get_db
from ..core.security import get_current_user
from ..models import User
from ..services.credit_service import credit_service

router = APIRouter(prefix="/api/credits", tags=["credits"])


class CreditBalanceResponse(BaseModel):
    """Response model for credit balance"""
    balance: int
    plan_name: str | None
    plan_id: int | None
    credits_per_analyze: int
    credits_per_edit: int
    last_reset_at: str | None
    updated_at: str


class CreditTransactionResponse(BaseModel):
    """Response model for a credit transaction"""
    id: int
    amount: int
    transaction_type: str
    description: str
    transaction_metadata: Dict[str, Any] | None
    created_at: str


@router.get("/balance", response_model=CreditBalanceResponse)
def get_credit_balance(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get the current user's credit balance and plan information
    
    Returns:
        Credit balance and plan details
    """
    try:
        # Ensure credits record exists (auto-create if missing)
        credit_service.get_or_create_user_credits(db, current_user.id)
        balance_info = credit_service.get_balance_info(db, current_user.id)
        return balance_info
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
def get_credit_history(
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get credit transaction history for the current user
    
    Args:
        limit: Maximum number of transactions to return (default 50)
        offset: Number of transactions to skip (default 0)
        
    Returns:
        List of credit transactions
    """
    try:
        transactions = credit_service.get_credit_history(
            db, current_user.id, limit=limit, offset=offset
        )
        
        # Convert to response format
        return [
            {
                "id": t.id,
                "amount": t.amount,
                "transaction_type": t.transaction_type.value,
                "description": t.description,
                "transaction_metadata": t.transaction_metadata,
                "created_at": t.created_at.isoformat()
            }
            for t in transactions
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

