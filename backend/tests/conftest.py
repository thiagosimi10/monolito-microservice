from __future__ import annotations

import os

# Tests run against their OWN database so they never disturb the dev/compose
# data. Override with TEST_DATABASE_URL if needed. Must be set before any
# `app.*` import (settings/engine are built at import time).
#
# HISTORY: sales-service's conftest.py once defaulted to the same DB as the
# dev docker-compose stack and TRUNCATEd it before every test, wiping 1002
# real rows. This repo's tests never TRUNCATE (they use a rolled-back
# savepoint transaction, see db_session below), but the explicit guard below
# is added anyway so a future test can never silently run destructive SQL
# against the shared "monolith" dev database.
_DEFAULT_TEST_DB = "postgresql+psycopg://postgres:postgres@localhost:5432/monolith_test"
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", _DEFAULT_TEST_DB)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.engine import make_url  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.database import engine, get_db  # noqa: E402
from app.main import app  # noqa: E402


def _assert_test_database(url: str) -> None:
    db_name = make_url(url).database or ""
    if "test" not in db_name.lower():
        raise RuntimeError(
            f"Refusing to run tests against database {db_name!r} - its name does not "
            "contain 'test'. Set TEST_DATABASE_URL to a database whose name contains "
            "'test' (e.g. 'monolith_test') before running pytest."
        )


_assert_test_database(str(engine.url))


@pytest.fixture()
def db_session():
    """Wrap each test in an outer transaction that is always rolled back.

    Uses a real PostgreSQL connection (no SQLite). ``join_transaction_mode``
    turns the service-layer ``commit()`` calls into savepoint releases, so the
    database is left untouched between tests.
    """
    _assert_test_database(str(engine.url))
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


def pytest_collection_modifyitems(config, items):
    for item in items:
        path = str(item.fspath).replace("\\", "/")
        if "/tests/unit/" in path:
            item.add_marker(pytest.mark.unit)
        elif "/tests/integration/" in path:
            item.add_marker(pytest.mark.integration)
        elif "/tests/e2e/" in path:
            item.add_marker(pytest.mark.e2e)
        else:
            item.add_marker(pytest.mark.integration)  # test_api.py: real Postgres
