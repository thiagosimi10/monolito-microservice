import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import UserCreate

logger = logging.getLogger("app.services.users")


def create_user(db: Session, data: UserCreate) -> User:
    user = User(name=data.name)
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("user created id=%s name=%s", user.id, user.name)
    return user


def list_users(db: Session) -> list[User]:
    return list(db.scalars(select(User).order_by(User.id)))


def get_user(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)
