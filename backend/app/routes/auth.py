from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..core.security import create_access_token, get_current_subject, get_current_user
from ..core.db import get_db
from ..models import User
from ..schemas.auth import LoginRequest, TokenResponse


router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Demo/testing login endpoint. For production, use Google OAuth at /api/auth/google/login
    This creates or gets a test user from the database.
    """
    # Find or create test user
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        user = User(
            email=payload.email,
            name="Test User",
            provider="test",
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    token = create_access_token(str(user.id), {"email": user.email})
    return TokenResponse(token=token, user={"id": str(user.id), "email": user.email})


@router.post("/logout")
def logout():
    return {"success": True, "message": "Logged out successfully"}


@router.get("/me")
def get_current_user_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current authenticated user's profile information"""
    # Get user's subscription info
    from ..models import Subscription, Dataset
    from datetime import datetime, timezone
    
    subscription = db.query(Subscription).filter(
        Subscription.user_id == current_user.id
    ).order_by(Subscription.created_at.desc()).first()
    
    subscription_info = None
    if subscription:
        subscription_info = {
            "tier": subscription.status,  # e.g., "free", "pro", "enterprise"
            "status": subscription.status,
            "stripe_customer_id": subscription.stripe_customer_id,
            "stripe_subscription_id": subscription.stripe_subscription_id,
            "created_at": subscription.created_at.isoformat()
        }
    
    # Calculate dashboards created this month
    now = datetime.now(timezone.utc)
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    dashboards_this_month = db.query(Dataset).filter(
        Dataset.user_id == current_user.id,
        Dataset.created_at >= start_of_month
    ).count()
    
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "picture": current_user.picture,
        "provider": current_user.provider,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at.isoformat(),
        "dashboards_this_month": dashboards_this_month,
        "subscription": subscription_info or {
            "tier": "free",
            "status": "inactive",
            "stripe_customer_id": None,
            "stripe_subscription_id": None,
            "created_at": None
        }
    }


class UpdateProfileRequest(BaseModel):
    name: str | None = None


@router.patch("/me")
def update_user_profile(
    payload: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user's profile"""
    if payload.name is not None:
        current_user.name = payload.name
    
    db.commit()
    db.refresh(current_user)
    
    return {
        "message": "Profile updated successfully",
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "name": current_user.name,
            "picture": current_user.picture,
        }
    }


@router.delete("/me")
def deactivate_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Deactivate user account (soft delete)"""
    current_user.is_active = False
    db.commit()
    
    return {
        "message": "Account deactivated successfully",
        "success": True
    }


