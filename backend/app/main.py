import os
from dotenv import load_dotenv
from fastapi import FastAPI
from starlette.middleware.sessions import SessionMiddleware
from .core.db import Base, engine
from .routes.health import router as health_router
from .routes.auth import router as auth_router
from .routes.chat import router as chat_router
from .routes.google import router as google_router
from .routes.payment import router as stripe_router

# Load environment from .env (must happen before oauth module reads env)
load_dotenv()

app = FastAPI(title="AutoDash Backend", version="0.1.0")

# Session support for OAuth (Authlib requires request.session)
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET", "change-this-session-secret"),
    same_site="lax",
    https_only=bool(int(os.getenv("SESSION_HTTPS_ONLY", "0"))),
)


from .schemas.auth import LoginRequest
from .schemas.chat import ChatRequest


app.include_router(health_router)


# Auth routes (dummy)
app.include_router(auth_router)


# Chat routes (dummy)
app.include_router(chat_router)


# Payment routes (dummy)
app.include_router(google_router)
app.include_router(stripe_router)


# Initialize DB
if os.getenv("AUTO_MIGRATE", "1") == "1":
    Base.metadata.create_all(bind=engine)


