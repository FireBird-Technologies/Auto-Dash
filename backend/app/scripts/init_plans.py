"""
Initialization script for default subscription plans
Run this script to create/update the default Free, Pro, and Ultra plans
"""
import sys
import os
from pathlib import Path

# Add parent directory to path to allow imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from sqlalchemy.orm import Session
from app.db import SessionLocal, engine, Base
from app.services.plan_service import plan_service
from app.models import SubscriptionPlan
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def init_database():
    """Create all database tables"""
    logger.info("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created successfully")


def init_plans(db: Session, force: bool = False):
    """
    Initialize default subscription plans
    
    Args:
        db: Database session
        force: If True, update existing plans with new values
    """
    logger.info("Initializing subscription plans...")
    
    plans = plan_service.initialize_default_plans(db, force=force)
    
    logger.info(f"Successfully initialized {len(plans)} plans:")
    for plan in plans:
        logger.info(f"  - {plan.name}: ${plan.price_monthly}/month, {plan.credits_per_month} credits")
    
    return plans


def main():
    """Main initialization function"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Initialize AutoDash subscription plans")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force update of existing plans"
    )
    parser.add_argument(
        "--create-tables",
        action="store_true",
        help="Create database tables if they don't exist"
    )
    
    args = parser.parse_args()
    
    # Create tables if requested
    if args.create_tables:
        init_database()
    
    # Initialize plans
    db = SessionLocal()
    try:
        plans = init_plans(db, force=args.force)
        logger.info("✓ Plan initialization complete!")
        
        # Display plan details
        print("\n" + "="*60)
        print("SUBSCRIPTION PLANS")
        print("="*60)
        for plan in plans:
            print(f"\n{plan.name} Tier:")
            print(f"  Price: ${plan.price_monthly}/month")
            print(f"  Credits: {plan.credits_per_month}/month")
            print(f"  Per Dashboard: {plan.credits_per_analyze} credits")
            print(f"  Per Edit: {plan.credits_per_edit} credits")
            print(f"  Stripe Price ID (Monthly): {plan.stripe_price_id_monthly or plan.stripe_price_id or 'Not set'}")
            print(f"  Stripe Price ID (Yearly): {plan.stripe_price_id_yearly or 'Not set'}")
            if plan.features:
                print(f"  Features: {', '.join(str(k) + '=' + str(v) for k, v in plan.features.items())}")
        print("\n" + "="*60)
        
    except Exception as e:
        logger.error(f"Error initializing plans: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()

