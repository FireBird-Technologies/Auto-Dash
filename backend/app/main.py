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
    model_name = os.getenv("DEFAULT_MODEL").replace("anthropic/", "") if "/" in os.getenv("DEFAULT_MODEL", "") else os.getenv("DEFAULT_MODEL")
    default_lm = dspy.Claude(
        model=model_name,
        max_tokens=7000,
        api_key=os.getenv("ANTHROPIC_API_KEY"),
        temperature=1
    )
elif "openai" in default_model:
    provider = "OPENAI"
    model_name = os.getenv("DEFAULT_MODEL").replace("openai/", "") if "/" in os.getenv("DEFAULT_MODEL", "") else os.getenv("DEFAULT_MODEL")
    default_lm = dspy.OpenAI(
        model=model_name,
        max_tokens=7000,
        api_key=os.getenv("OPENAI_API_KEY"),
        temperature=1
    )
elif "gemini" in default_model:
    provider = "GEMINI"
    model_name = os.getenv("DEFAULT_MODEL").replace("gemini/", "").replace("google/", "") if "/" in os.getenv("DEFAULT_MODEL", "") else os.getenv("DEFAULT_MODEL")
    default_lm = dspy.Google(
        model=model_name,
        max_tokens=7000,
        api_key=os.getenv("GEMINI_API_KEY"),
        temperature=1
    )
else:
    provider = "UNKNOWN"
    # Fallback to OpenAI if unknown
    model_name = os.getenv("DEFAULT_MODEL", "gpt-4o-mini").replace("openai/", "") if "/" in os.getenv("DEFAULT_MODEL", "") else os.getenv("DEFAULT_MODEL", "gpt-4o-mini")
    default_lm = dspy.OpenAI(
        model=model_name,
        max_tokens=7000,
        api_key=os.getenv("OPENAI_API_KEY"),
        temperature=1
    )

dspy.configure(lm=default_lm)

# CORS middleware - allow frontend to access backend
frontend_url = os.getenv("FRONTEND_URL", "")
cors_origins = [
    "http://localhost:5173",  # Vite dev server
    "http://127.0.0.1:5173",  # Alternative localhost
    "http://localhost:3000",  # Alternative port
]
# Add production frontend URL if provided
if frontend_url:
    cors_origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
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


