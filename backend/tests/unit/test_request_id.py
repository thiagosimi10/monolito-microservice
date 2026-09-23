"""Unit test for the X-Request-ID correlation + metrics middleware in
isolation - a minimal Starlette app, no database.
"""

from __future__ import annotations

from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from app.observability import REQUEST_ID_HEADER, RequestContextMiddleware


def _make_app():
    async def echo(request):
        return JSONResponse({"ok": True})

    app = Starlette(routes=[Route("/ping", echo)])
    app.add_middleware(RequestContextMiddleware)
    return app


def test_request_with_existing_id_preserves_it():
    client = TestClient(_make_app())
    r = client.get("/ping", headers={REQUEST_ID_HEADER: "caller-supplied-id"})
    assert r.headers[REQUEST_ID_HEADER] == "caller-supplied-id"


def test_request_without_id_generates_a_new_one():
    client = TestClient(_make_app())
    r = client.get("/ping")
    assert r.headers.get(REQUEST_ID_HEADER)


def test_two_requests_without_id_get_different_ids():
    client = TestClient(_make_app())
    r1 = client.get("/ping")
    r2 = client.get("/ping")
    assert r1.headers[REQUEST_ID_HEADER] != r2.headers[REQUEST_ID_HEADER]


def test_failing_route_exception_propagates_and_is_not_swallowed():
    """The middleware records metrics/logs on the exception path (see
    app/observability.py) and then re-raises - it must never swallow the
    original exception.
    """

    async def boom(request):
        raise RuntimeError("boom")

    app = Starlette(routes=[Route("/boom", boom)])
    app.add_middleware(RequestContextMiddleware)
    client = TestClient(app, raise_server_exceptions=True)

    import pytest

    with pytest.raises(RuntimeError, match="boom"):
        client.get("/boom")
