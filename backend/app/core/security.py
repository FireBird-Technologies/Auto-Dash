from ..security import create_access_token, get_current_subject
from ..models import User
from ..core.db import get_db
from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException, status

__all__ = ["create_access_token", "get_current_subject", "get_current_user"]


def get_current_user(
    subject: str = Depends(get_current_subject),
    db: Session = Depends(get_db)
) -> User:
    """
    Get the current user from the JWT token.
    The subject is the user's ID (as string).
    """
    user = None
    
    # Try to find user by ID first (primary method since JWT sub = user.id)
    try:
        user_id = int(subject)
        user = db.query(User).filter(User.id == user_id).first()
    except (ValueError, TypeError):
        # Fallback: try to find by email if subject is not numeric
        user = db.query(User).filter(User.email == subject).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is inactive"
        )
    
    return user


