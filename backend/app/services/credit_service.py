"""
Credit management service for handling user credit operations
"""
from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime
from typing import Optional, Dict, Any
import logging

from ..models import User, UserCredits, CreditTransaction, TransactionType, SubscriptionPlan

logger = logging.getLogger(__name__)


class CreditService:
    """Service for managing user credits"""
    
    def get_user_credits(self, db: Session, user_id: int) -> Optional[UserCredits]:
        """
        Get the current credit balance for a user
        
        Args:
            db: Database session
            user_id: User ID
            
        Returns:
            UserCredits object or None if not found
        """
        return db.query(UserCredits).filter(UserCredits.user_id == user_id).first()
    
    def get_or_create_user_credits(self, db: Session, user_id: int, plan_id: Optional[int] = None) -> UserCredits:
        """
        Get or create credit record for a user
        
        Args:
            db: Database session
            user_id: User ID
            plan_id: Optional plan ID
            
        Returns:
            UserCredits object
        """
        credits = self.get_user_credits(db, user_id)
        if not credits:
            credits = UserCredits(
                user_id=user_id,
                plan_id=plan_id,
                balance=0,
                last_reset_at=None
            )
            db.add(credits)
            db.commit()
            db.refresh(credits)
            logger.info(f"Created credit record for user {user_id}")
        return credits
    
    def check_sufficient_credits(self, db: Session, user_id: int, amount: int) -> bool:
        """
        Check if user has sufficient credits (pre-check before operation)
        
        Args:
            db: Database session
            user_id: User ID
            amount: Required credit amount
            
        Returns:
            True if user has enough credits, False otherwise
        """
        credits = self.get_user_credits(db, user_id)
        if not credits:
            logger.warning(f"No credit record found for user {user_id}")
            return False
        
        has_sufficient = credits.balance >= amount
        logger.info(f"User {user_id} credit check: balance={credits.balance}, required={amount}, sufficient={has_sufficient}")
        return has_sufficient
    
    def deduct_credits(
        self, 
        db: Session, 
        user_id: int, 
        amount: int, 
        description: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> UserCredits:
        """
        Deduct credits from user account (post-operation deduction)
        
        Args:
            db: Database session
            user_id: User ID
            amount: Amount to deduct (positive number)
            description: Description of the transaction
            metadata: Optional metadata dictionary
            
        Returns:
            Updated UserCredits object
            
        Raises:
            ValueError: If user has insufficient credits
        """
        credits = self.get_user_credits(db, user_id)
        if not credits:
            raise ValueError(f"No credit record found for user {user_id}")
        
        if credits.balance < amount:
            raise ValueError(f"Insufficient credits: balance={credits.balance}, required={amount}")
        
        # Deduct credits
        credits.balance -= amount
        credits.updated_at = datetime.utcnow()
        
        # Log transaction
        transaction = CreditTransaction(
            user_id=user_id,
            amount=-amount,  # Negative for deduction
            transaction_type=TransactionType.DEDUCT,
            description=description,
            transaction_metadata=metadata or {}
        )
        db.add(transaction)
        db.commit()
        db.refresh(credits)
        
        logger.info(f"Deducted {amount} credits from user {user_id}. New balance: {credits.balance}")
        return credits
    
    def add_credits(
        self,
        db: Session,
        user_id: int,
        amount: int,
        description: str,
        transaction_type: TransactionType = TransactionType.ADJUSTMENT,
        metadata: Optional[Dict[str, Any]] = None
    ) -> UserCredits:
        """
        Add credits to user account (for adjustments, refunds, etc.)
        
        Args:
            db: Database session
            user_id: User ID
            amount: Amount to add (positive number)
            description: Description of the transaction
            transaction_type: Type of transaction (ADJUSTMENT, REFUND, etc.)
            metadata: Optional metadata dictionary
            
        Returns:
            Updated UserCredits object
        """
        credits = self.get_or_create_user_credits(db, user_id)
        
        # Add credits
        credits.balance += amount
        credits.updated_at = datetime.utcnow()
        
        # Log transaction
        transaction = CreditTransaction(
            user_id=user_id,
            amount=amount,  # Positive for addition
            transaction_type=transaction_type,
            description=description,
            transaction_metadata=metadata or {}
        )
        db.add(transaction)
        db.commit()
        db.refresh(credits)
        
        logger.info(f"Added {amount} credits to user {user_id}. New balance: {credits.balance}")
        return credits
    
    def reset_credits(
        self,
        db: Session,
        user_id: int,
        plan_id: Optional[int] = None,
        description: str = "Monthly credit reset"
    ) -> UserCredits:
        """
        Reset user credits to their plan limit
        
        Args:
            db: Database session
            user_id: User ID
            plan_id: Optional plan ID (if None, uses current plan)
            description: Description for the transaction
            
        Returns:
            Updated UserCredits object
        """
        credits = self.get_or_create_user_credits(db, user_id, plan_id)
        
        # Get plan details
        if plan_id:
            plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == plan_id).first()
        elif credits.plan_id:
            plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == credits.plan_id).first()
        else:
            # Default to free tier if no plan
            plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.name == "Free").first()
        
        if not plan:
            raise ValueError(f"No plan found for user {user_id}")
        
        # Reset to plan limit
        old_balance = credits.balance
        credits.balance = plan.credits_per_month
        credits.plan_id = plan.id
        credits.last_reset_at = datetime.utcnow()
        credits.updated_at = datetime.utcnow()
        
        # Log transaction
        transaction = CreditTransaction(
            user_id=user_id,
            amount=credits.balance - old_balance,  # Can be positive or negative
            transaction_type=TransactionType.RESET,
            description=description,
            transaction_metadata={"plan_id": plan.id, "plan_name": plan.name, "old_balance": old_balance}
        )
        db.add(transaction)
        db.commit()
        db.refresh(credits)
        
        logger.info(f"Reset credits for user {user_id} to {credits.balance} (plan: {plan.name})")
        return credits
    
    def get_credit_history(
        self,
        db: Session,
        user_id: int,
        limit: int = 50,
        offset: int = 0
    ) -> list[CreditTransaction]:
        """
        Get credit transaction history for a user
        
        Args:
            db: Database session
            user_id: User ID
            limit: Number of transactions to return
            offset: Number of transactions to skip
            
        Returns:
            List of CreditTransaction objects
        """
        return (
            db.query(CreditTransaction)
            .filter(CreditTransaction.user_id == user_id)
            .order_by(CreditTransaction.created_at.desc())
            .limit(limit)
            .offset(offset)
            .all()
        )
    
    def get_balance_info(self, db: Session, user_id: int) -> Dict[str, Any]:
        """
        Get comprehensive balance information for a user
        
        Args:
            db: Database session
            user_id: User ID
            
        Returns:
            Dictionary with balance, plan info, and limits
        """
        credits = self.get_user_credits(db, user_id)
        if not credits:
            return {
                "balance": 0,
                "plan_name": None,
                "credits_per_analyze": 0,
                "credits_per_edit": 0,
                "last_reset_at": None
            }
        
        plan = None
        if credits.plan_id:
            plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == credits.plan_id).first()
        
        return {
            "balance": credits.balance,
            "plan_name": plan.name if plan else None,
            "plan_id": credits.plan_id,
            "credits_per_analyze": plan.credits_per_analyze if plan else 0,
            "credits_per_edit": plan.credits_per_edit if plan else 0,
            "last_reset_at": credits.last_reset_at.isoformat() if credits.last_reset_at else None,
            "updated_at": credits.updated_at.isoformat()
        }


# Singleton instance
credit_service = CreditService()

