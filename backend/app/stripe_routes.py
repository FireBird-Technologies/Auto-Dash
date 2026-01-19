"""
Stripe payment and webhook routes for subscription management
"""
import os
import stripe
from fastapi import APIRouter, Header, HTTPException, Request, Depends
from sqlalchemy.orm import Session
import logging

from .core.db import get_db
from .core.security import get_current_user
from .models import User
from .services.subscription_service import subscription_service
from .services.plan_service import plan_service
from .services.credit_service import credit_service
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/payment", tags=["payment"])

# Initialize Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "sk_test_123")
WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "whsec_test")


class CreateCheckoutRequest(BaseModel):
    """Request model for creating checkout session"""
    plan_id: int
    billing_period: str = "monthly"  # "monthly" or "yearly"
    promo_code: str | None = None  # Optional promo code


@router.post("/create-checkout-session")
def create_checkout_session(
    request: CreateCheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a Stripe Checkout session for a subscription
    
    Args:
        request: Contains plan_id
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Dictionary with checkoutUrl
    """
    try:
        # Get plan details
        plan = plan_service.get_plan_by_id(db, request.plan_id)
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")
        
        # Determine which price ID to use based on billing period
        billing_period = request.billing_period.lower()
        if billing_period == "yearly":
            price_id = plan.stripe_price_id_yearly
            if not price_id:
                raise HTTPException(status_code=400, detail="Plan does not have a yearly Stripe price ID")
        else:  # Default to monthly
            price_id = plan.stripe_price_id_monthly or plan.stripe_price_id  # Fallback to legacy field
            if not price_id:
                raise HTTPException(status_code=400, detail="Plan does not have a monthly Stripe price ID")
        
        # Get or create Stripe customer
        existing_subscription = subscription_service.get_user_subscription(db, current_user.id)
        customer_id = existing_subscription.stripe_customer_id if existing_subscription else None
        
        if not customer_id:
            # Create new Stripe customer
            customer = stripe.Customer.create(
                email=current_user.email,
                name=current_user.name,
                metadata={
                    "user_id": current_user.id
                }
            )
            customer_id = customer.id
            logger.info(f"Created Stripe customer {customer_id} for user {current_user.id}")
        
        # Known promotion codes mapping (code -> Stripe promotion code ID)
        KNOWN_PROMO_CODES = {
            "FIRST100": "promo_1SrJbKBACqQSnujJriPjszSv",  # 30% off
        }
        
        # Apply promo code if provided
        discounts = None
        if request.promo_code:
            promo_code_upper = request.promo_code.upper()
            
            # Check if it's a known promo code with direct ID
            if promo_code_upper in KNOWN_PROMO_CODES:
                discounts = [{"promotion_code": KNOWN_PROMO_CODES[promo_code_upper]}]
                logger.info(f"Applied known promo code {promo_code_upper}")
            else:
                # Try to look up other promo codes from Stripe
                try:
                    promo_codes = stripe.PromotionCode.list(
                        active=True,
                        code=promo_code_upper,
                        limit=1
                    )
                    
                    if promo_codes.data:
                        discounts = [{"promotion_code": promo_codes.data[0].id}]
                        logger.info(f"Applied promo code {promo_code_upper} from Stripe lookup")
                    else:
                        logger.warning(f"Invalid promo code {request.promo_code}, proceeding without discount")
                except Exception as promo_error:
                    logger.warning(f"Error validating promo code {request.promo_code}: {promo_error}, proceeding without discount")
        
        # Create checkout session
        domain = os.getenv("FRONTEND_URL", "http://localhost:5173")
        session_params = {
            "customer": customer_id,
            "mode": "subscription",
            "line_items": [{
                "price": price_id,
                "quantity": 1
            }],
            "success_url": f"{domain}/subscription?success=true&session_id={{CHECKOUT_SESSION_ID}}",
            "cancel_url": f"{domain}/subscription?canceled=true",
            "metadata": {
                "user_id": str(current_user.id),
                "plan_id": str(plan.id),
                "billing_period": billing_period
            }
        }
        
        # Add discounts if promo code is valid, otherwise allow manual entry
        # Note: Stripe doesn't allow both discounts and allow_promotion_codes together
        if discounts:
            session_params["discounts"] = discounts
        else:
            # Only allow manual promo code entry if no discount is pre-applied
            session_params["allow_promotion_codes"] = True
        
        session = stripe.checkout.Session.create(**session_params)
        
        logger.info(f"Created checkout session {session.id} for user {current_user.id}, plan {plan.name}")
        return {"checkoutUrl": session.url}
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error creating checkout session: {e}")
        raise HTTPException(status_code=500, detail=f"Stripe error: {str(e)}")
    except Exception as e:
        logger.error(f"Error creating checkout session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cancel-subscription")
def cancel_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cancel the current user's subscription at period end
    
    Args:
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Success message
    """
    try:
        # Get user's subscription
        user_subscription = subscription_service.get_user_subscription(db, current_user.id)
        if not user_subscription or not user_subscription.stripe_subscription_id:
            raise HTTPException(status_code=404, detail="No active subscription found")
        
        # Cancel in Stripe
        stripe.Subscription.modify(
            user_subscription.stripe_subscription_id,
            cancel_at_period_end=True
        )
        
        # Update in database
        subscription_service.cancel_subscription(db, current_user.id, immediate=False)
        
        logger.info(f"Canceled subscription for user {current_user.id}")
        return {"message": "Subscription will be canceled at the end of the billing period"}
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error canceling subscription: {e}")
        raise HTTPException(status_code=500, detail=f"Stripe error: {str(e)}")
    except Exception as e:
        logger.error(f"Error canceling subscription: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/subscription-status")
def get_subscription_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current subscription status for the authenticated user
    
    Args:
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Subscription information
    """
    try:
        subscription_info = subscription_service.get_subscription_info(db, current_user.id)
        return subscription_info
    except Exception as e:
        logger.error(f"Error getting subscription status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class ChangePlanRequest(BaseModel):
    """Request model for changing subscription plan"""
    plan_id: int
    billing_period: str = "monthly"  # "monthly" or "yearly"


@router.post("/change-plan")
def change_plan(
    request: ChangePlanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Change user's subscription plan immediately with proration
    If user doesn't have a Stripe subscription (e.g., Free plan), creates checkout session instead
    
    Args:
        request: Contains plan_id and billing_period
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Success message with updated subscription info, or checkout URL if no subscription exists
    """
    try:
        # Check if user has an active Stripe subscription
        user_subscription = subscription_service.get_user_subscription(db, current_user.id)
        
        if not user_subscription or not user_subscription.stripe_subscription_id:
            # No Stripe subscription - redirect to checkout instead
            logger.info(f"User {current_user.id} has no Stripe subscription, creating checkout session")
            
            # Get plan details
            plan = plan_service.get_plan_by_id(db, request.plan_id)
            if not plan:
                raise HTTPException(status_code=404, detail="Plan not found")
            
            # Determine which price ID to use based on billing period
            billing_period = request.billing_period.lower()
            if billing_period == "yearly":
                price_id = plan.stripe_price_id_yearly
                if not price_id:
                    raise HTTPException(status_code=400, detail="Plan does not have a yearly Stripe price ID")
            else:
                price_id = plan.stripe_price_id_monthly or plan.stripe_price_id
                if not price_id:
                    raise HTTPException(status_code=400, detail="Plan does not have a monthly Stripe price ID")
            
            # Get or create Stripe customer
            customer_id = user_subscription.stripe_customer_id if user_subscription else None
            
            if not customer_id:
                customer = stripe.Customer.create(
                    email=current_user.email,
                    name=current_user.name,
                    metadata={"user_id": str(current_user.id)}
                )
                customer_id = customer.id
                logger.info(f"Created Stripe customer {customer_id} for user {current_user.id}")
            
            # Create checkout session
            domain = os.getenv("FRONTEND_URL", "http://localhost:5173")
            session = stripe.checkout.Session.create(
                customer=customer_id,
                mode="subscription",
                line_items=[{"price": price_id, "quantity": 1}],
                success_url=f"{domain}/subscription?success=true&session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"{domain}/subscription?canceled=true",
                allow_promotion_codes=True,
                metadata={
                    "user_id": str(current_user.id),
                    "plan_id": str(plan.id),
                    "billing_period": billing_period
                }
            )
            
            return {
                "checkout_required": True,
                "checkoutUrl": session.url,
                "message": "Please complete checkout to upgrade your plan"
            }
            
        # User has Stripe subscription - proceed with plan change
        subscription = subscription_service.change_plan(
            db,
            current_user.id,
            request.plan_id,
            request.billing_period
        )
        
        # Get updated subscription info
        subscription_info = subscription_service.get_subscription_info(db, current_user.id)
        
        logger.info(f"Changed plan for user {current_user.id} to plan {request.plan_id}")
        return {
            "message": "Plan changed successfully",
            "subscription": subscription_info
        }
        
    except ValueError as e:
        logger.error(f"Invalid plan change request: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error changing plan: {e}")
        raise HTTPException(status_code=500, detail=f"Stripe error: {str(e)}")
    except Exception as e:
        logger.error(f"Error changing plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reactivate-subscription")
def reactivate_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Reactivate a canceled subscription
    
    Args:
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Success message
    """
    try:
        subscription = subscription_service.reactivate_subscription(db, current_user.id)
        
        if not subscription:
            raise HTTPException(status_code=404, detail="No subscription found to reactivate")
        
        logger.info(f"Reactivated subscription for user {current_user.id}")
        return {"message": "Subscription reactivated successfully"}
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error reactivating subscription: {e}")
        raise HTTPException(status_code=500, detail=f"Stripe error: {str(e)}")
    except Exception as e:
        logger.error(f"Error reactivating subscription: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class ValidatePromoCodeRequest(BaseModel):
    """Request model for validating promo code"""
    promo_code: str
    plan_id: int
    billing_period: str = "monthly"  # "monthly" or "yearly"


@router.post("/validate-promo-code")
def validate_promo_code(
    request: ValidatePromoCodeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Validate a promo code for a specific plan/product
    
    Args:
        request: Contains promo_code, plan_id, and billing_period
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Validation result with discount information
    """
    try:
        # Get plan to find product/price ID
        plan = plan_service.get_plan_by_id(db, request.plan_id)
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")
        
        # Get price ID based on billing period
        if request.billing_period.lower() == "yearly":
            price_id = plan.stripe_price_id_yearly
        else:
            price_id = plan.stripe_price_id_monthly or plan.stripe_price_id
        
        if not price_id:
            raise HTTPException(status_code=400, detail=f"Plan does not have a {request.billing_period} price ID")
        
        # Get price object to find product ID
        price = stripe.Price.retrieve(price_id)
        product_id = price.product if isinstance(price.product, str) else price.product.id
        
        # Search for promotion code
        promo_codes = stripe.PromotionCode.list(
            active=True,
            code=request.promo_code.upper(),
            limit=1
        )
        
        if not promo_codes.data:
            return {
                "valid": False,
                "error_message": "Promo code not found or inactive"
            }
        
        promo_code_obj = promo_codes.data[0]
        coupon = promo_code_obj.coupon
        
        # Check if coupon applies to specific products
        if coupon.applies_to and coupon.applies_to.products:
            # Coupon is product-specific
            if product_id not in coupon.applies_to.products:
                return {
                    "valid": False,
                    "error_message": f"Promo code does not apply to {plan.name} plan"
                }
        
        # Check if coupon is valid (not expired, within usage limits)
        if coupon.valid:
            discount_percent = coupon.percent_off
            discount_amount = coupon.amount_off / 100 if coupon.amount_off else None  # Convert from cents
            
            return {
                "valid": True,
                "discount_percent": discount_percent,
                "discount_amount": discount_amount,
                "promo_code_id": promo_code_obj.id
            }
        else:
            return {
                "valid": False,
                "error_message": "Promo code is no longer valid"
            }
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error validating promo code: {e}")
        return {
            "valid": False,
            "error_message": f"Error validating promo code: {str(e)}"
        }
    except Exception as e:
        logger.error(f"Error validating promo code: {e}")
        return {
            "valid": False,
            "error_message": f"Error validating promo code: {str(e)}"
        }


@router.post("/webhook")
async def webhook(
    request: Request,
    stripe_signature: str | None = Header(default=None, alias="stripe-signature"),
    db: Session = Depends(get_db)
):
    """
    Handle Stripe webhook events
    
    Handles:
    - checkout.session.completed: New subscription created
    - customer.subscription.updated: Subscription changed
    - customer.subscription.deleted: Subscription canceled
    - invoice.payment_succeeded: Payment successful (reset credits)
    - invoice.payment_failed: Payment failed
    
    Args:
        request: FastAPI request object
        stripe_signature: Stripe signature header
        db: Database session
        
    Returns:
        Success response
    """
    payload = await request.body()
    
    try:
        # Verify webhook signature
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=stripe_signature or "",
            secret=WEBHOOK_SECRET
        )
    except ValueError as e:
        logger.error(f"Invalid payload: {e}")
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        logger.error(f"Invalid signature: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    event_type = event.get("type")
    event_data = event.get("data", {}).get("object", {})
    
    logger.info(f"Received Stripe webhook: {event_type}")
    
    try:
        # Handle checkout.session.completed
        if event_type == "checkout.session.completed":
            await handle_checkout_completed(db, event_data)
        
        # Handle customer.subscription.updated
        elif event_type == "customer.subscription.updated":
            await handle_subscription_updated(db, event_data)
        
        # Handle customer.subscription.deleted
        elif event_type == "customer.subscription.deleted":
            await handle_subscription_deleted(db, event_data)
        
        # Handle invoice.payment_succeeded
        elif event_type == "invoice.payment_succeeded":
            await handle_payment_succeeded(db, event_data)
        
        # Handle invoice.payment_failed
        elif event_type == "invoice.payment_failed":
            await handle_payment_failed(db, event_data)
        
        else:
            logger.info(f"Unhandled event type: {event_type}")
        
        return {"received": True, "type": event_type}
        
    except Exception as e:
        logger.error(f"Error processing webhook {event_type}: {e}")
        import traceback
        traceback.print_exc()
        # Don't raise error - return 200 to prevent Stripe retries
        return {"received": True, "error": str(e)}


async def handle_checkout_completed(db: Session, session_data: dict):
    """
    Handle checkout.session.completed event
    Creates subscription and assigns plan to user
    """
    user_id = session_data.get("metadata", {}).get("user_id")
    plan_id = session_data.get("metadata", {}).get("plan_id")
    
    if not user_id or not plan_id:
        logger.error(f"Missing user_id or plan_id in checkout session metadata")
        return
    
    user_id = int(user_id)
    plan_id = int(plan_id)
    
    # Get user
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        logger.error(f"User {user_id} not found")
        return
    
    # Get subscription data from Stripe
    subscription_id = session_data.get("subscription")
    if subscription_id:
        stripe_subscription = stripe.Subscription.retrieve(subscription_id)
        
        # Create or update subscription in database
        subscription_service.create_or_update_subscription(
            db, user, plan_id, stripe_subscription
        )
        
        # Reset credits to new plan
        credit_service.reset_credits(
            db, user_id, plan_id,
            description="Subscription created"
        )
        
        logger.info(f"Completed checkout for user {user_id}, plan {plan_id}")
    else:
        logger.warning(f"No subscription ID in checkout session")


async def handle_subscription_updated(db: Session, subscription_data: dict):
    """
    Handle customer.subscription.updated event
    Updates subscription status and plan
    """
    # Get user from customer ID
    customer_id = subscription_data.get("customer")
    if not customer_id:
        logger.error("No customer ID in subscription data")
        return
    
    # Find user by stripe_customer_id
    from .models import Subscription as SubscriptionModel
    subscription = db.query(SubscriptionModel).filter(
        SubscriptionModel.stripe_customer_id == customer_id
    ).first()
    
    if not subscription:
        logger.warning(f"No subscription found for customer {customer_id}")
        return
    
    user_id = subscription.user_id
    
    # Get plan from price ID
    price_id = subscription_data.get("items", {}).get("data", [{}])[0].get("price", {}).get("id")
    if price_id:
        plan = plan_service.get_plan_by_stripe_price_id(db, price_id)
        if plan:
            # Update subscription
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                subscription_service.create_or_update_subscription(
                    db, user, plan.id, subscription_data
                )
                logger.info(f"Updated subscription for user {user_id}")


async def handle_subscription_deleted(db: Session, subscription_data: dict):
    """
    Handle customer.subscription.deleted event
    Downgrades user to free tier
    """
    # Get user from customer ID
    customer_id = subscription_data.get("customer")
    if not customer_id:
        logger.error("No customer ID in subscription data")
        return
    
    # Find user by stripe_customer_id
    from .models import Subscription as SubscriptionModel
    subscription = db.query(SubscriptionModel).filter(
        SubscriptionModel.stripe_customer_id == customer_id
    ).first()
    
    if not subscription:
        logger.warning(f"No subscription found for customer {customer_id}")
        return
    
    user_id = subscription.user_id
    
    # Downgrade to free tier
    subscription_service.downgrade_to_free(db, user_id)
    logger.info(f"Downgraded user {user_id} to free tier after subscription deletion")


async def handle_payment_succeeded(db: Session, invoice_data: dict):
    """
    Handle invoice.payment_succeeded event
    Resets user credits on successful monthly payment
    """
    # Get user from customer ID
    customer_id = invoice_data.get("customer")
    if not customer_id:
        logger.error("No customer ID in invoice data")
        return
    
    # Skip if this is the first payment (initial subscription)
    billing_reason = invoice_data.get("billing_reason")
    if billing_reason == "subscription_create":
        logger.info("Skipping credit reset for initial subscription payment")
        return
    
    # Find user by stripe_customer_id
    from .models import Subscription as SubscriptionModel
    subscription = db.query(SubscriptionModel).filter(
        SubscriptionModel.stripe_customer_id == customer_id
    ).first()
    
    if not subscription:
        logger.warning(f"No subscription found for customer {customer_id}")
        return
    
    user_id = subscription.user_id
    
    # Reset credits
    subscription_service.handle_payment_succeeded(db, user_id, invoice_data)
    logger.info(f"Reset credits for user {user_id} after successful payment")


async def handle_payment_failed(db: Session, invoice_data: dict):
    """
    Handle invoice.payment_failed event
    Marks subscription as past_due
    """
    # Get user from customer ID
    customer_id = invoice_data.get("customer")
    if not customer_id:
        logger.error("No customer ID in invoice data")
        return
    
    # Find user by stripe_customer_id
    from .models import Subscription as SubscriptionModel
    subscription = db.query(SubscriptionModel).filter(
        SubscriptionModel.stripe_customer_id == customer_id
    ).first()
    
    if not subscription:
        logger.warning(f"No subscription found for customer {customer_id}")
        return
    
    user_id = subscription.user_id
    
    # Handle failed payment
    subscription_service.handle_payment_failed(db, user_id, invoice_data)
    logger.warning(f"Payment failed for user {user_id}")
