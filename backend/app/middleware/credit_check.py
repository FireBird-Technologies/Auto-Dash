"""
Credit check middleware for protecting routes with credit requirements
"""
from typing import Callable
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..core.db import get_db
from ..core.security import get_current_user
from ..models import User
from ..services.credit_service import credit_service
from ..services.plan_service import plan_service


class CreditCheckResult:
    """
    Result of a credit check, passed to route handlers
    Contains information about the user's credit status
    """
    def __init__(self, user: User, balance: int, cost: int, plan_name: str = None):
        self.user = user
        self.balance = balance
        self.cost = cost
        self.plan_name = plan_name


def require_credits(amount: int) -> Callable:
    """
    Dependency factory for checking if user has sufficient credits
    
    Usage in routes:
        @router.post("/analyze")
        async def analyze_data(
            credits: CreditCheckResult = Depends(require_credits(5)),
            db: Session = Depends(get_db)
        ):
            # Your route logic here
            # After successful operation, deduct credits:
            credit_service.deduct_credits(db, credits.user.id, 5, "Data analysis")
    
    Args:
        amount: Number of credits required
        
    Returns:
        Dependency function that checks credits
    """
    def credit_checker(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> CreditCheckResult:
        """
        Check if the current user has sufficient credits
        
        Args:
            current_user: Authenticated user
            db: Database session
            
        Returns:
            CreditCheckResult with user and balance info
            
        Raises:
            HTTPException: If user has insufficient credits
        """
        # Get user's credit balance
        user_credits = credit_service.get_user_credits(db, current_user.id)
        
        if not user_credits:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail={
                    "error": "no_credits_initialized",
                    "message": "Credit account not initialized. Please contact support.",
                    "required": amount,
                    "balance": 0
                }
            )
        
        # Check if sufficient credits
        if user_credits.balance < amount:
            # Get plan name for better error message
            plan_name = None
            if user_credits.plan_id:
                plan = plan_service.get_plan_by_id(db, user_credits.plan_id)
                plan_name = plan.name if plan else None
            
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail={
                    "error": "insufficient_credits",
                    "message": f"Insufficient credits. Required: {amount}, Available: {user_credits.balance}",
                    "required": amount,
                    "balance": user_credits.balance,
                    "plan": plan_name
                }
            )
        
        # Get plan name for result
        plan_name = None
        if user_credits.plan_id:
            plan = plan_service.get_plan_by_id(db, user_credits.plan_id)
            plan_name = plan.name if plan else None
        
        return CreditCheckResult(
            user=current_user,
            balance=user_credits.balance,
            cost=amount,
            plan_name=plan_name
        )
    
    return credit_checker


class OptionalCreditCheck:
    """
    Optional credit check that doesn't raise an error
    Useful for routes that want to check credits but have fallback behavior
    """
    def __init__(self, amount: int):
        self.amount = amount
    
    def __call__(
        self,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> dict:
        """
        Check credits without raising an error
        
        Returns:
            Dictionary with has_credits, balance, required, etc.
        """
        user_credits = credit_service.get_user_credits(db, current_user.id)
        
        if not user_credits:
            return {
                "has_credits": False,
                "balance": 0,
                "required": self.amount,
                "user_id": current_user.id
            }
        
        has_sufficient = user_credits.balance >= self.amount
        
        # Get plan info
        plan_name = None
        if user_credits.plan_id:
            plan = plan_service.get_plan_by_id(db, user_credits.plan_id)
            plan_name = plan.name if plan else None
        
        return {
            "has_credits": has_sufficient,
            "balance": user_credits.balance,
            "required": self.amount,
            "user_id": current_user.id,
            "plan": plan_name
        }

