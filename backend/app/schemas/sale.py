from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SaleCreate(BaseModel):
    user_id: int = Field(gt=0)
    item_name: str = Field(min_length=1, max_length=255)
    quantity: int = Field(gt=0)

    @field_validator("item_name")
    @classmethod
    def _strip_item_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("item_name must not be empty")
        return value


class SaleRead(BaseModel):
    """Sale representation that also carries the user's name via a JOIN.

    The ``user_name`` field is populated by joining ``sales`` and ``users``.
    Once each domain owns its own database this JOIN is no longer possible and
    the name must be denormalized or fetched over the network.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    user_name: str
    item_name: str
    quantity: int
    created_at: datetime
