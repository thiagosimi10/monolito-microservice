import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.sale import Sale
from app.models.user import User
from app.schemas.sale import SaleCreate

logger = logging.getLogger("app.services.sales")


class UserNotFoundError(Exception):
    """Raised when a sale references a user that does not exist."""

    def __init__(self, user_id: int) -> None:
        self.user_id = user_id
        super().__init__(f"User {user_id} not found")


def _row_to_dict(sale: Sale, user_name: str) -> dict:
    return {
        "id": sale.id,
        "user_id": sale.user_id,
        "user_name": user_name,
        "item_name": sale.item_name,
        "quantity": sale.quantity,
        "created_at": sale.created_at,
    }


def create_sale(db: Session, data: SaleCreate) -> dict:
    user = db.get(User, data.user_id)
    if user is None:
        raise UserNotFoundError(data.user_id)

    sale = Sale(
        user_id=data.user_id,
        item_name=data.item_name,
        quantity=data.quantity,
    )
    db.add(sale)
    db.commit()
    db.refresh(sale)
    logger.info("sale created id=%s user_id=%s", sale.id, sale.user_id)
    return _row_to_dict(sale, user.name)


def list_sales(db: Session) -> list[dict]:
    # Intentional JOIN between sales and users. Disappears once the domains are split.
    rows = db.execute(
        select(Sale, User.name)
        .join(User, Sale.user_id == User.id)
        .order_by(Sale.id)
    ).all()
    return [_row_to_dict(sale, name) for sale, name in rows]


def get_sale(db: Session, sale_id: int) -> dict | None:
    row = db.execute(
        select(Sale, User.name)
        .join(User, Sale.user_id == User.id)
        .where(Sale.id == sale_id)
    ).first()
    if row is None:
        return None
    sale, name = row
    return _row_to_dict(sale, name)
