"""
Subscription service for managing user subscriptions and Stripe integration
"""
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from datetime import datetime
import logging

from ..models import User, Subscription, SubscriptionPlan
from .credit_service import credit_service
from .plan_service import plan_service

logger = logging.getLogger(__name__)


class SubscriptionService:
    """Service for managing user subscriptions"""
    
    def get_user_subscription(self, db: Session, user_id: int) -> Optional[Subscription]:
        """
        Get the active subscription for a user
        
        Args:
            db: Database session
            user_id: User ID
            
        Returns:
            Subscription object or None if not found
        """
        return (
            db.query(Subscription)
            .filter(Subscription.user_id == user_id)
            .order_by(Subscription.created_at.desc())
            .first()
        )
    
    def create_or_update_subscription(
        self,
        db: Session,
        user: User,
        plan_id: int,
        stripe_subscription_data: Dict[str, Any]
    ) -> Subscription:
        """
        Create or update a subscription from Stripe webhook data
        
        Args:
            db: Database session
            user: User object
            plan_id: SubscriptionPlan ID
            stripe_subscription_data: Data from Stripe subscription object
            
        Returns:
            Created or updated Subscription object
        """
        # Check if subscription exists
        existing = self.get_user_subscription(db, user.id)
        
        # Extract Stripe data
        stripe_sub_id = stripe_subscription_data.get("id")
        stripe_customer_id = stripe_subscription_data.get("customer")
        status = stripe_subscription_data.get("status", "active")
        current_period_start = stripe_subscription_data.get("current_period_start")
        current_period_end = stripe_subscription_data.get("current_period_end")
        cancel_at_period_end = stripe_subscription_data.get("cancel_at_period_end", False)
        
        # Convert timestamps if they exist
        period_start = None
        period_end = None
        if current_period_start:
            period_start = datetime.fromtimestamp(current_period_start)
        if current_period_end:
            period_end = datetime.fromtimestamp(current_period_end)
        
        if existing:
            # Update existing subscription
            existing.plan_id = plan_id
            existing.status = status
            existing.stripe_customer_id = stripe_customer_id
            existing.stripe_subscription_id = stripe_sub_id
            existing.current_period_start = period_start
            existing.current_period_end = period_end
            existing.cancel_at_period_end = cancel_at_period_end
            existing.updated_at = datetime.utcnow()
            
            db.commit()
            db.refresh(existing)
            logger.info(f"Updated subscription for user {user.id} to plan {plan_id}")
            return existing
        else:
            # Create new subscription
            subscription = Subscription(
                user_id=user.id,
                plan_id=plan_id,
                status=status,
                stripe_customer_id=stripe_customer_id,
                stripe_subscription_id=stripe_sub_id,
                current_period_start=period_start,
                current_period_end=period_end,
                cancel_at_period_end=cancel_at_period_end
            )
            db.add(subscription)
            db.commit()
            db.refresh(subscription)
            logger.info(f"Created subscription for user {user.id} with plan {plan_id}")
            return subscription
    
    def cancel_subscription(
        self,
        db: Session,
        user_id: int,
        immediate: bool = False
    ) -> Optional[Subscription]:
        """
        Cancel a user's subscription
        
        Args:
            db: Database session
            user_id: User ID
            immediate: If True, cancel immediately; if False, cancel at period end
            
        Returns:
            Updated Subscription object or None if not found
        """
        subscription = self.get_user_subscription(db, user_id)
        if not subscription:
            logger.warning(f"No subscription found for user {user_id}")
            return None
        
        if immediate:
            subscription.status = "canceled"
            subscription.cancel_at_period_end = False
        else:
            subscription.cancel_at_period_end = True
        
        subscription.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(subscription)
        
        logger.info(f"Canceled subscription for user {user_id} (immediate={immediate})")
        return subscription
    
    def downgrade_to_free(self, db: Session, user_id: int) -> Subscription:
        """
        Downgrade a user to the free tier
        
        Args:
            db: Database session
            user_id: User ID
            
        Returns:
            Updated or created Subscription object
        """
        # Get free plan
        free_plan = plan_service.get_plan_by_name(db, "Free")
        if not free_plan:
            raise ValueError("Free plan not found in database")
        
        # Get or create subscription
        subscription = self.get_user_subscription(db, user_id)
        
        if subscription:
            subscription.plan_id = free_plan.id
            subscription.status = "active"
            subscription.stripe_subscription_id = None
            subscription.cancel_at_period_end = False
            subscription.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(subscription)
        else:
            subscription = Subscription(
                user_id=user_id,
                plan_id=free_plan.id,
                status="active"
            )
            db.add(subscription)
            db.commit()
            db.refresh(subscription)
        
        # Reset credits to free tier
        credit_service.reset_credits(
            db, 
            user_id, 
            free_plan.id,
            description="Downgraded to Free tier"
        )
        
        logger.info(f"Downgraded user {user_id} to Free tier")
        return subscription
    
    def assign_free_tier(self, db: Session, user: User) -> Subscription:
        """
        Assign free tier to a new user
        
        Args:
            db: Database session
            user: User object
            
        Returns:
            Created Subscription object
        """
        # Get free plan
        free_plan = plan_service.get_plan_by_name(db, "Free")
        if not free_plan:
            raise ValueError("Free plan not found in database")
        
        # Create subscription
        subscription = Subscription(
            user_id=user.id,
            plan_id=free_plan.id,
            status="active"
        )
        db.add(subscription)
        db.commit()
        db.refresh(subscription)
        
        # Initialize credits
        credit_service.reset_credits(
            db,
            user.id,
            free_plan.id,
            description="New user - Free tier"
        )
        
        logger.info(f"Assigned Free tier to new user {user.id}")
        return subscription
    
    def handle_payment_succeeded(
        self,
        db: Session,
        user_id: int,
        stripe_invoice_data: Dict[str, Any]
    ) -> None:
        """
        Handle successful payment (monthly renewal) - reset credits
        
        Args:
            db: Database session
            user_id: User ID
            stripe_invoice_data: Data from Stripe invoice object
        """
        subscription = self.get_user_subscription(db, user_id)
        if not subscription or not subscription.plan_id:
            logger.warning(f"No subscription or plan found for user {user_id}")
            return
        
        # Reset credits to plan limit
        credit_service.reset_credits(
            db,
            user_id,
            subscription.plan_id,
            description="Monthly subscription renewal"
        )
        
        logger.info(f"Reset credits for user {user_id} after successful payment")
    
    def handle_payment_failed(
        self,
        db: Session,
        user_id: int,
        stripe_invoice_data: Dict[str, Any]
    ) -> None:
        """
        Handle failed payment
        
        Args:
            db: Database session
            user_id: User ID
            stripe_invoice_data: Data from Stripe invoice object
        """
        subscription = self.get_user_subscription(db, user_id)
        if not subscription:
            logger.warning(f"No subscription found for user {user_id}")
            return
        
        # Mark subscription as past_due
        subscription.status = "past_due"
        subscription.updated_at = datetime.utcnow()
        db.commit()
        
        logger.warning(f"Payment failed for user {user_id}, subscription marked as past_due")
    
    def change_plan(
        self,
        db: Session,
        user_id: int,
        new_plan_id: int,
        billing_period: str = "monthly"
    ) -> Subscription:
        """
        Change user's subscription plan immediately with proration
        
        Args:
            db: Database session
            user_id: User ID
            new_plan_id: New plan ID to switch to
            billing_period: "monthly" or "yearly"
            
        Returns:
            Updated Subscription object
        """
        import stripe
        
        subscription = self.get_user_subscription(db, user_id)
        if not subscription or not subscription.stripe_subscription_id:
            raise ValueError("No active Stripe subscription found")
        
        # Get new plan
        new_plan = plan_service.get_plan_by_id(db, new_plan_id)
        if not new_plan:
            raise ValueError(f"Plan {new_plan_id} not found")
        
        # Get price ID based on billing period
        if billing_period.lower() == "yearly":
            new_price_id = new_plan.stripe_price_id_yearly
        else:
            new_price_id = new_plan.stripe_price_id_monthly or new_plan.stripe_price_id
        
        if not new_price_id:
            raise ValueError(f"Plan {new_plan.name} does not have a {billing_period} price ID")
        
        # Get current Stripe subscription
        stripe_sub = stripe.Subscription.retrieve(subscription.stripe_subscription_id)
        
        # Get current subscription item ID
        current_item_id = stripe_sub["items"]["data"][0]["id"]
        
        # Modify subscription in Stripe with immediate proration
        updated_sub = stripe.Subscription.modify(
            subscription.stripe_subscription_id,
            items=[{
                "id": current_item_id,
                "price": new_price_id,
            }],
            proration_behavior="always_invoice",
            metadata={
                "user_id": str(user_id),
                "plan_id": str(new_plan_id),
                "billing_period": billing_period
            }
        )
        
        # Update database subscription
        subscription.plan_id = new_plan_id
        subscription.status = updated_sub["status"]
        subscription.current_period_start = datetime.fromtimestamp(updated_sub["current_period_start"])
        subscription.current_period_end = datetime.fromtimestamp(updated_sub["current_period_end"])
        subscription.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(subscription)
        
        # Reset credits to new plan limit
        credit_service.reset_credits(
            db,
            user_id,
            new_plan_id,
            description=f"Plan changed to {new_plan.name} ({billing_period})"
        )
        
        logger.info(f"Changed plan for user {user_id} to {new_plan.name} ({billing_period})")
        return subscription
    
    def reactivate_subscription(
        self,
        db: Session,
        user_id: int
    ) -> Optional[Subscription]:
        """
        Reactivate a canceled subscription
        
        Args:
            db: Database session
            user_id: User ID
            
        Returns:
            Updated Subscription object or None if not found
        """
        import stripe
        
        subscription = self.get_user_subscription(db, user_id)
        if not subscription or not subscription.stripe_subscription_id:
            logger.warning(f"No subscription found for user {user_id}")
            return None
        
        # Reactivate in Stripe
        stripe.Subscription.modify(
            subscription.stripe_subscription_id,
            cancel_at_period_end=False
        )
        
        # Update database
        subscription.cancel_at_period_end = False
        subscription.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(subscription)
        
        logger.info(f"Reactivated subscription for user {user_id}")
        return subscription
    
    def get_subscription_info(self, db: Session, user_id: int) -> Dict[str, Any]:
        """
        Get comprehensive subscription information for a user
        
        Args:
            db: Database session
            user_id: User ID
            
        Returns:
            Dictionary with subscription details
        """
        subscription = self.get_user_subscription(db, user_id)
        
        # Get all available plans
        all_plans = plan_service.get_all_active_plans(db)
        available_plans = [
            plan_service.get_plan_info(db, plan.id)
            for plan in all_plans
        ]
        
        if not subscription:
            return {
                "has_subscription": False,
                "status": None,
                "plan": None,
                "credits": None,
                "available_plans": available_plans,
                "current_period_start": None,
                "current_period_end": None,
                "next_billing_amount": None,
                "billing_period": None,
                "cancel_at_period_end": False
            }
        
        # Get plan info
        plan_info = None
        if subscription.plan_id:
            plan_info = plan_service.get_plan_info(db, subscription.plan_id)
        
        # Get credit info
        credit_info = credit_service.get_balance_info(db, user_id)
        
        # Add credits_per_month from plan if available
        if plan_info and credit_info:
            credit_info["credits_per_month"] = plan_info.get("credits_per_month", 0)
        
        # Determine billing period from Stripe if available
        billing_period = None
        next_billing_amount = None
        
        if subscription.stripe_subscription_id:
            try:
                import stripe
                stripe_sub = stripe.Subscription.retrieve(subscription.stripe_subscription_id)
                
                # Determine billing period from interval
                if stripe_sub.get("items", {}).get("data", []):
                    interval = stripe_sub["items"]["data"][0]["price"].get("recurring", {}).get("interval")
                    billing_period = "yearly" if interval == "year" else "monthly"
                    
                    # Get next billing amount
                    if stripe_sub.get("items", {}).get("data", []):
                        price = stripe_sub["items"]["data"][0]["price"]
                        next_billing_amount = price.get("unit_amount", 0) / 100  # Convert from cents
            except Exception as e:
                logger.warning(f"Could not fetch Stripe subscription details: {e}")
        
        return {
            "has_subscription": True,
            "status": subscription.status,
            "plan": plan_info,
            "credits": credit_info,
            "stripe_subscription_id": subscription.stripe_subscription_id,
            "current_period_start": subscription.current_period_start.isoformat() if subscription.current_period_start else None,
            "current_period_end": subscription.current_period_end.isoformat() if subscription.current_period_end else None,
            "cancel_at_period_end": subscription.cancel_at_period_end,
            "available_plans": available_plans,
            "billing_period": billing_period,
            "next_billing_amount": next_billing_amount
        }


# Singleton instance
subscription_service = SubscriptionService()

