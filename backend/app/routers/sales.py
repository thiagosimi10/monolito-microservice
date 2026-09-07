from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.sale import SaleCreate, SaleRead
from app.services import sales as sales_service
from app.services.sales import UserNotFoundError

router = APIRouter(prefix="/sales", tags=["sales"])


@router.post("", response_model=SaleRead, status_code=status.HTTP_201_CREATED)
def create_sale(payload: SaleCreate, db: Session = Depends(get_db)) -> SaleRead:
    try:
        return sales_service.create_sale(db, payload)
    except UserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc


@router.get("", response_model=list[SaleRead])
def list_sales(db: Session = Depends(get_db)) -> list[SaleRead]:
    return sales_service.list_sales(db)


@router.get("/{sale_id}", response_model=SaleRead)
def get_sale(sale_id: int, db: Session = Depends(get_db)) -> SaleRead:
    sale = sales_service.get_sale(db, sale_id)
    if sale is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sale {sale_id} not found",
        )
    return sale
