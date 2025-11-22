import os
from urllib.parse import urlencode
from fastapi import APIRouter, Request, Depends
from authlib.integrations.starlette_client import OAuth
from starlette.responses import RedirectResponse
from sqlalchemy.orm import Session
from .db import get_db
from .models import User
from .security import create_access_token
from .services.subscription_service import subscription_service


router = APIRouter(prefix="/api/auth/google", tags=["auth"])


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
    token = await oauth.google.authorize_access_token(request)
    userinfo = token.get("userinfo")
    if not userinfo:
        # Fallback fetch
        userinfo = await oauth.google.parse_id_token(request, token)

    email = userinfo.get("email")
    sub = userinfo.get("sub")
    name = userinfo.get("name")
    picture = userinfo.get("picture")

    user = db.query(User).filter(User.email == email).first()
    is_new_user = False
    if not user:
        user = User(email=email, name=name, picture=picture, provider="google", provider_id=sub)
        db.add(user)
        db.commit()
        db.refresh(user)
        is_new_user = True
    
    # Assign Free tier to new users
    if is_new_user:
        try:
            subscription_service.assign_free_tier(db, user)
        except Exception as e:
            # Log error but don't block user login
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to assign free tier to user {user.id}: {e}")

    jwt_token = create_access_token(str(user.id), {"email": user.email})
    # redirect back to frontend with token in query for simplicity
    params = urlencode({"token": jwt_token})
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    return RedirectResponse(url=f"{frontend_url}/?{params}")


