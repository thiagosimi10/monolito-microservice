"""Importing this package registers every model with the SQLAlchemy mapper."""

from app.models.sale import Sale
from app.models.user import User

__all__ = ["Sale", "User"]
