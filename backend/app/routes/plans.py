"""
Subscription plan routes
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from pydantic import BaseModel
from decimal import Decimal

from ..core.db import get_db
from ..services.plan_service import plan_service

router = APIRouter(prefix="/api/plans", tags=["plans"])


class PlanFeatures(BaseModel):
    """Plan features model"""
    max_datasets: int | None = None
    max_file_size_mb: int | None = None
    export_formats: List[str] | None = None
    priority_support: bool | None = None
    custom_branding: bool | None = None
    api_access: bool | None = None


class PlanResponse(BaseModel):
    """Response model for a subscription plan"""
    id: int
    name: str
    price_monthly: float
    price_yearly: float | None = None
    credits_per_month: int
    credits_per_analyze: int
    credits_per_edit: int
    features: Dict[str, Any]
    stripe_price_id: str | None  # Legacy field
    stripe_price_id_monthly: str | None = None
    stripe_price_id_yearly: str | None = None
    is_active: bool
    sort_order: int


@router.get("", response_model=List[PlanResponse])
def get_all_plans(db: Session = Depends(get_db)):
    """
    Get all active subscription plans
    
    Returns:
        List of active plans sorted by display order
    """
    try:
        plans = plan_service.get_all_active_plans(db)
        
        return [
            {
                "id": plan.id,
                "name": plan.name,
                "price_monthly": float(plan.price_monthly),
                "price_yearly": float(plan.price_yearly) if plan.price_yearly else None,
                "credits_per_month": plan.credits_per_month,
                "credits_per_analyze": plan.credits_per_analyze,
                "credits_per_edit": plan.credits_per_edit,
                "features": plan.features or {},
                "stripe_price_id": plan.stripe_price_id,  # Legacy
                "stripe_price_id_monthly": plan.stripe_price_id_monthly,
                "stripe_price_id_yearly": plan.stripe_price_id_yearly,
                "is_active": plan.is_active,
                "sort_order": plan.sort_order
            }
            for plan in plans
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{plan_id}", response_model=PlanResponse)
def get_plan(plan_id: int, db: Session = Depends(get_db)):
    """
    Get details of a specific plan
    
    Args:
        plan_id: Plan ID
        
    Returns:
        Plan details
    """
    try:
        plan = plan_service.get_plan_by_id(db, plan_id)
        
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")
        
        return {
            "id": plan.id,
            "name": plan.name,
            "price_monthly": float(plan.price_monthly),
            "price_yearly": float(plan.price_yearly) if plan.price_yearly else None,
            "credits_per_month": plan.credits_per_month,
            "credits_per_analyze": plan.credits_per_analyze,
            "credits_per_edit": plan.credits_per_edit,
            "features": plan.features or {},
            "stripe_price_id": plan.stripe_price_id,  # Legacy
            "stripe_price_id_monthly": plan.stripe_price_id_monthly,
            "stripe_price_id_yearly": plan.stripe_price_id_yearly,
            "is_active": plan.is_active,
            "sort_order": plan.sort_order
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

