import os
import logging
import asyncio
from urllib.parse import urlencode
from fastapi import APIRouter, Request, Depends
from authlib.integrations.starlette_client import OAuth
from starlette.responses import RedirectResponse
from sqlalchemy.orm import Session
from .db import get_db
from .models import User
from .security import create_access_token
from .services.subscription_service import subscription_service
from .services.email_service import email_service, EmailServiceError

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth/google", tags=["auth"])
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:3001/api/auth/google/callback")

oauth = OAuth()
oauth.register(
    name="google",
    client_id=GOOGLE_CLIENT_ID,
    client_secret=GOOGLE_CLIENT_SECRET,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)


@router.get("/login")
async def login(request: Request):
    redirect_uri = GOOGLE_REDIRECT_URI
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/callback")
async def callback(request: Request, db: Session = Depends(get_db)):
    try:
        token = await oauth.google.authorize_access_token(request)
        userinfo = token.get("userinfo") or await oauth.google.parse_id_token(request, token)
        
        email = userinfo.get("email")
        if not email:
            logger.error("No email in Google OAuth response")
            return RedirectResponse(url=f"{FRONTEND_URL}/?error=missing_email")
        
        user = db.query(User).filter(User.email == email).first()
        is_new_user = not user
        
        if is_new_user:
            user = User(
                email=email,
                name=userinfo.get("name"),
                picture=userinfo.get("picture"),
                provider="google",
                provider_id=userinfo.get("sub")
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            
            # Assign free tier (non-blocking)
            try:
                subscription_service.assign_free_tier(db, user)
            except Exception as e:
                logger.error(f"Failed to assign free tier to user {user.id}: {e}")
            
            # Send welcome email asynchronously (non-blocking)
            asyncio.create_task(_send_welcome_email(user))
        
        jwt_token = create_access_token(str(user.id), {"email": user.email})
        return RedirectResponse(url=f"{FRONTEND_URL}/?{urlencode({'token': jwt_token})}")
    
    except Exception as e:
        logger.error(f"OAuth callback error: {e}", exc_info=True)
        return RedirectResponse(url=f"{FRONTEND_URL}/?error=login_failed")


async def _send_welcome_email(user: User):
    """
    Send welcome email to new user.
    Runs asynchronously and doesn't block the OAuth flow.
    
    Args:
        user: User object
    """
    try:
        await email_service.send_welcome_email(
            to_email=user.email,
            user_name=user.name
        )
        logger.info(f"Welcome email sent to {user.email}")
    except EmailServiceError as e:
        # Log but don't fail the OAuth flow
        logger.error(f"Failed to send welcome email to {user.email}: {e}")
    except Exception as e:
        # Catch all other errors to prevent breaking OAuth
        logger.error(f"Unexpected error sending welcome email to {user.email}: {e}", exc_info=True)