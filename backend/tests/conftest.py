import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.database import engine, get_db
from app.main import app


@pytest.fixture()
def db_session():
    """Wrap each test in an outer transaction that is always rolled back.

    Uses a real PostgreSQL connection (no SQLite). ``join_transaction_mode``
    turns the service-layer ``commit()`` calls into savepoint releases, so the
    database is left untouched between tests.
    """
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")

    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture()
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
