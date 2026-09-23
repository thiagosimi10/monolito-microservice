"""Unit test for app/observability.py::instrument_db_metrics in isolation -
a throwaway SQLite in-memory engine, no Postgres.
"""

from __future__ import annotations

from sqlalchemy import create_engine, text

from app.observability import (
    DB_ERRORS_TOTAL,
    DB_OPERATION_DURATION,
    SERVICE_NAME,
    instrument_db_metrics,
)


def _histogram_count(histogram, **labels):
    for metric in histogram.collect():
        total_sum = total_count = None
        for sample in metric.samples:
            if not all(sample.labels.get(k) == v for k, v in labels.items()):
                continue
            if sample.name.endswith("_sum"):
                total_sum = sample.value
            elif sample.name.endswith("_count"):
                total_count = sample.value
        if total_sum is not None and total_count is not None:
            return total_sum, total_count
    return 0.0, 0.0


def test_successful_query_is_observed_in_duration_histogram():
    engine = create_engine("sqlite://")
    instrument_db_metrics(engine)
    _, count_before = _histogram_count(DB_OPERATION_DURATION, service=SERVICE_NAME)

    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))

    _, count_after = _histogram_count(DB_OPERATION_DURATION, service=SERVICE_NAME)
    assert count_after == count_before + 1


def test_failing_query_increments_error_counter():
    engine = create_engine("sqlite://")
    instrument_db_metrics(engine)
    before = DB_ERRORS_TOTAL.labels(service=SERVICE_NAME)._value.get()

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT * FROM a_table_that_does_not_exist"))
    except Exception:
        pass

    after = DB_ERRORS_TOTAL.labels(service=SERVICE_NAME)._value.get()
    assert after == before + 1
