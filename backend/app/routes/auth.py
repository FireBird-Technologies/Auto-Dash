from fastapi import APIRouter, Depends
from ..core.security import create_access_token, get_current_subject
from ..schemas.auth import LoginRequest, TokenResponse


router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest):
    token = create_access_token("u_123", {"email": payload.email})
    return TokenResponse(token=token, user={"id": "u_123", "email": payload.email})


@router.post("/logout")
def logout():
    return {"success": True}


@router.get("/me")
def me(user_sub: str = Depends(get_current_subject)):
    return {"id": user_sub, "email": "user@example.com"}


