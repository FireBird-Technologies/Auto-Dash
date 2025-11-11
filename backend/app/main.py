import os
from dotenv import load_dotenv
import dspy
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

# Load environment from backend/.env BEFORE importing modules that read env
_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=_ENV_PATH, override=False)

from .core.db import Base, engine
from .routes.health import router as health_router
from .routes.auth import router as auth_router
from .routes.chat import router as chat_router
from .routes.google import router as google_router
from .routes.payment import router as stripe_router
from .routes.data import router as data_router

app = FastAPI(title="AutoDash Backend", version="0.1.0")

default_model = os.getenv("DEFAULT_MODEL", "").lower()
if "anthropic" in default_model:
    provider = "ANTHROPIC"
elif "openai" in default_model:
    provider = "OPENAI"
elif "gemini" in default_model:
    provider = "GEMINI"
else:
    provider = "UNKNOWN"



default_lm = dspy.LM(default_model, max_tokens=3500,api_key=os.getenv(provider+'_API_KEY'), temperature=1, cache=False)

dspy.configure(lm=default_lm)

# CORS middleware - allow frontend to access backend
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Session support for OAuth (Authlib requires request.session)
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET", "change-this-session-secret"),
    same_site="lax",
    https_only=bool(int(os.getenv("SESSION_HTTPS_ONLY", "0"))),
)


from .schemas.auth import LoginRequest
from .schemas.chat import ChatRequest

# Optional debug route to verify OAuth env at runtime (masked)
@app.get("/api/auth/debug")
def auth_debug():
    cid = os.getenv("GOOGLE_CLIENT_ID", "")
    rid = os.getenv("GOOGLE_REDIRECT_URI", "")
    return {
        "GOOGLE_CLIENT_ID_present": bool(cid),
        "GOOGLE_CLIENT_ID_prefix": cid[:10] + ("..." if cid else ""),
        "GOOGLE_REDIRECT_URI": rid,
    }


app.include_router(health_router)


# Auth routes (dummy)
app.include_router(auth_router)


# Chat routes (dummy)
app.include_router(chat_router)


# Payment routes (dummy)
app.include_router(google_router)
app.include_router(stripe_router)

# Data routes
app.include_router(data_router)


# Initialize DB
if os.getenv("AUTO_MIGRATE", "1") == "1":
    Base.metadata.create_all(bind=engine)


