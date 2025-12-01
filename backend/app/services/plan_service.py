"""
Subscription plan service for managing pricing tiers
"""
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from decimal import Decimal
import logging
import os

from ..models import SubscriptionPlan

logger = logging.getLogger(__name__)


class PlanService:
    """Service for managing subscription plans"""
    
    def get_all_active_plans(self, db: Session) -> List[SubscriptionPlan]:
        """
        Get all active subscription plans
        
        Args:
            db: Database session
            
        Returns:
            List of active SubscriptionPlan objects, sorted by sort_order
        """
        return (
            db.query(SubscriptionPlan)
            .filter(SubscriptionPlan.is_active == True)
            .order_by(SubscriptionPlan.sort_order)
            .all()
        )
    
    def get_plan_by_id(self, db: Session, plan_id: int) -> Optional[SubscriptionPlan]:
        """
        Get a specific plan by ID
        
        Args:
            db: Database session
            plan_id: Plan ID
            
        Returns:
            SubscriptionPlan object or None if not found
        """
        return db.query(SubscriptionPlan).filter(SubscriptionPlan.id == plan_id).first()
    
    def get_plan_by_name(self, db: Session, name: str) -> Optional[SubscriptionPlan]:
        """
        Get a plan by name
        
        Args:
            db: Database session
            name: Plan name
            
        Returns:
            SubscriptionPlan object or None if not found
        """
        return db.query(SubscriptionPlan).filter(SubscriptionPlan.name == name).first()
    
    def get_plan_by_stripe_price_id(self, db: Session, stripe_price_id: str) -> Optional[SubscriptionPlan]:
        """
        Get a plan by Stripe price ID (checks both monthly and yearly)
        
        Args:
            db: Database session
            stripe_price_id: Stripe price ID
            
        Returns:
            SubscriptionPlan object or None if not found
        """
        return db.query(SubscriptionPlan).filter(
            (SubscriptionPlan.stripe_price_id == stripe_price_id) |
            (SubscriptionPlan.stripe_price_id_monthly == stripe_price_id) |
            (SubscriptionPlan.stripe_price_id_yearly == stripe_price_id)
        ).first()
    
    def create_plan(
        self,
        db: Session,
        name: str,
        price_monthly: Decimal,
        credits_per_month: int,
        credits_per_analyze: int = 5,
        credits_per_edit: int = 2,
        stripe_price_id: Optional[str] = None,
        stripe_price_id_monthly: Optional[str] = None,
        stripe_price_id_yearly: Optional[str] = None,
        price_yearly: Optional[Decimal] = None,
        stripe_product_id: Optional[str] = None,
        features: Optional[Dict[str, Any]] = None,
        sort_order: int = 0
    ) -> SubscriptionPlan:
        """
        Create a new subscription plan
        
        Args:
            db: Database session
            name: Plan name
            price_monthly: Monthly price
            credits_per_month: Monthly credit allocation
            credits_per_analyze: Credits per dashboard creation
            credits_per_edit: Credits per edit operation
            stripe_price_id: Legacy Stripe price ID (for backward compatibility)
            stripe_price_id_monthly: Stripe monthly price ID
            stripe_price_id_yearly: Stripe yearly price ID
            price_yearly: Yearly price
            stripe_product_id: Stripe product ID
            features: Optional feature dictionary
            sort_order: Display order
            
        Returns:
            Created SubscriptionPlan object
        """
        # Use legacy stripe_price_id as monthly if monthly not provided
        if stripe_price_id_monthly is None and stripe_price_id is not None:
            stripe_price_id_monthly = stripe_price_id
        
        plan = SubscriptionPlan(
            name=name,
            price_monthly=price_monthly,
            price_yearly=price_yearly,
            credits_per_month=credits_per_month,
            credits_per_analyze=credits_per_analyze,
            credits_per_edit=credits_per_edit,
            stripe_price_id=stripe_price_id,  # Keep for backward compatibility
            stripe_price_id_monthly=stripe_price_id_monthly,
            stripe_price_id_yearly=stripe_price_id_yearly,
            stripe_product_id=stripe_product_id,
            features=features or {},
            sort_order=sort_order,
            is_active=True
        )
        db.add(plan)
        db.commit()
        db.refresh(plan)
        logger.info(f"Created plan: {name} (${price_monthly}/month, {credits_per_month} credits)")
        return plan
    
    def update_plan(
        self,
        db: Session,
        plan_id: int,
        **kwargs
    ) -> Optional[SubscriptionPlan]:
        """
        Update a subscription plan
        
        Args:
            db: Database session
            plan_id: Plan ID
            **kwargs: Fields to update
            
        Returns:
            Updated SubscriptionPlan object or None if not found
        """
        plan = self.get_plan_by_id(db, plan_id)
        if not plan:
            return None
        
        for key, value in kwargs.items():
            if hasattr(plan, key):
                setattr(plan, key, value)
        
        db.commit()
        db.refresh(plan)
        logger.info(f"Updated plan {plan_id}: {plan.name}")
        return plan
    
    def deactivate_plan(self, db: Session, plan_id: int) -> bool:
        """
        Deactivate a plan (soft delete)
        
        Args:
            db: Database session
            plan_id: Plan ID
            
        Returns:
            True if successful, False if plan not found
        """
        plan = self.get_plan_by_id(db, plan_id)
        if not plan:
            return False
        
        plan.is_active = False
        db.commit()
        logger.info(f"Deactivated plan {plan_id}: {plan.name}")
        return True
    
    def initialize_default_plans(self, db: Session, force: bool = False) -> List[SubscriptionPlan]:
        """
        Initialize default subscription plans (Free, Pro, Ultra)
        Idempotent - won't create duplicates unless force=True
        
        Args:
            db: Database session
            force: If True, recreate plans even if they exist
            
        Returns:
            List of created/existing plans
        """
        plans = []
        
        # Default plan configurations
        default_plans = [
            {
                "name": "Free",
                "price_monthly": Decimal("0.00"),
                "price_yearly": Decimal("0.00"),
                "credits_per_month": 25,
                "credits_per_analyze": 5,
                "credits_per_edit": 2,
                "stripe_price_id": os.getenv("STRIPE_FREE_PRICE_MONTHLY_ID"),  # Legacy support
                "stripe_price_id_monthly": os.getenv("STRIPE_FREE_PRICE_MONTHLY_ID"),
                "stripe_price_id_yearly": os.getenv("STRIPE_FREE_PRICE_YEARLY_ID"),
                "stripe_product_id": os.getenv("STRIPE_FREE_PRODUCT_ID"),
                "features": {
                    "max_datasets": 3,
                    "max_file_size_mb": 10,
                    "export_formats": ["png", "csv"]
                },
                "sort_order": 0
            },
            {
                "name": "Pro",
                "price_monthly": Decimal("20.00"),
                "price_yearly": Decimal("192.00"),  # $20 * 12 * 0.8 (20% discount)
                "credits_per_month": 500,
                "credits_per_analyze": 5,
                "credits_per_edit": 2,
                "stripe_price_id": os.getenv("STRIPE_PRO_PRICE_MONTHLY_ID"),  # Legacy support
                "stripe_price_id_monthly": os.getenv("STRIPE_PRO_PRICE_MONTHLY_ID"),
                "stripe_price_id_yearly": os.getenv("STRIPE_PRO_PRICE_YEARLY_ID"),
                "stripe_product_id": os.getenv("STRIPE_PRO_PRODUCT_ID"),
                "features": {
                    "max_datasets": 50,
                    "max_file_size_mb": 100,
                    "export_formats": ["png", "csv", "pdf", "xlsx"],
                    "priority_support": True
                },
                "sort_order": 1
            },
            {
                "name": "Ultra",
                "price_monthly": Decimal("30"),
                "price_yearly": Decimal("288"),  # $29.99 * 12 * 0.8 (20% discount)
                "credits_per_month": 1000,
                "credits_per_analyze": 5,
                "credits_per_edit": 2,
                "stripe_price_id": os.getenv("STRIPE_ULTRA_PRICE_MONTHLY_ID"),  # Legacy support
                "stripe_price_id_monthly": os.getenv("STRIPE_ULTRA_PRICE_MONTHLY_ID"),
                "stripe_price_id_yearly": os.getenv("STRIPE_ULTRA_PRICE_YEARLY_ID"),
                "stripe_product_id": os.getenv("STRIPE_ULTRA_PRODUCT_ID"),
                "features": {
                    "max_datasets": -1,  # Unlimited
                    "max_file_size_mb": 500,
                    "export_formats": ["png", "csv", "pdf", "xlsx", "json"],
                    "priority_support": True,
                    "custom_branding": True,
                    "api_access": True
                },
                "sort_order": 2
            }
        ]
        
        for plan_config in default_plans:
            existing = self.get_plan_by_name(db, plan_config["name"])
            
            if existing and not force:
                logger.info(f"Plan '{plan_config['name']}' already exists, skipping")
                plans.append(existing)
            elif existing and force:
                # Update existing plan
                for key, value in plan_config.items():
                    if key != "name":  # Don't update name
                        setattr(existing, key, value)
                db.commit()
                db.refresh(existing)
                logger.info(f"Updated existing plan: {plan_config['name']}")
                plans.append(existing)
            else:
                # Create new plan
                plan = self.create_plan(db, **plan_config)
                plans.append(plan)
        
        return plans
    
    def get_plan_info(self, db: Session, plan_id: int) -> Optional[Dict[str, Any]]:
        """
        Get comprehensive plan information
        
        Args:
            db: Database session
            plan_id: Plan ID
            
        Returns:
            Dictionary with plan details or None if not found
        """
        plan = self.get_plan_by_id(db, plan_id)
        if not plan:
            return None
        
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
            "is_active": plan.is_active
        }


# Singleton instance
plan_service = PlanService()

