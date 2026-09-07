#!/bin/sh
set -e

echo "[entrypoint] waiting for the database..."
python - <<'PY'
import time
import sys

from sqlalchemy import create_engine, text

from app.config import settings

for attempt in range(1, 31):
    try:
        engine = create_engine(settings.database_url)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("[entrypoint] database is ready")
        break
    except Exception as exc:  # noqa: BLE001
        print(f"[entrypoint] db not ready (attempt {attempt}/30): {exc}")
        time.sleep(2)
else:
    sys.exit("[entrypoint] database did not become ready in time")
PY

echo "[entrypoint] applying migrations (alembic upgrade head)..."
alembic upgrade head

echo "[entrypoint] starting FastAPI..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
