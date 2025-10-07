from sqlalchemy.orm import Session
from ..models import User


def get_or_create_user_by_email(db: Session, *, email: str, name: str | None = None, picture: str | None = None,
                                provider: str | None = None, provider_id: str | None = None) -> User:
    user = db.query(User).filter(User.email == email).first()
    if user:
        return user
    user = User(email=email, name=name, picture=picture, provider=provider, provider_id=provider_id)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


