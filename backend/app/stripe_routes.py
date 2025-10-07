import os
import stripe
from fastapi import APIRouter, Header, HTTPException, Request


router = APIRouter(prefix="/api/payment", tags=["payment"])

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "sk_test_123")
WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "whsec_test")


@router.post("/create-checkout-session")
def create_checkout_session():
    domain = os.getenv("FRONTEND_URL", "http://localhost:5173")
    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": os.getenv("STRIPE_PRICE_ID", "price_test"), "quantity": 1}],
        success_url=f"{domain}/?success=true",
        cancel_url=f"{domain}/?canceled=true",
    )
    return {"checkoutUrl": session.url}


@router.post("/webhook")
async def webhook(request: Request, stripe_signature: str | None = Header(default=None, alias="stripe-signature")):
    payload = await request.body()
    try:
        event = stripe.Webhook.construct_event(payload=payload, sig_header=stripe_signature or "", secret=WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid webhook")

    # Handle events here if needed
    return {"received": True, "type": event.get("type")}


