"""Prometheus metrics, X-Request-ID correlation, and OpenTelemetry tracing for
the monolith API. Kept in one module so main.py stays a thin wiring point.

Label discipline: only method / route (path *template*, e.g. "/users/{user_id}",
never the raw path) / status_code are used as Prometheus labels. Never put
user_id or any other high-cardinality value in a label - see logs for that.
"""

from __future__ import annotations

import logging
import time
import uuid
from collections.abc import Callable

from fastapi import FastAPI, Request, Response
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest
from starlette.middleware.base import BaseHTTPMiddleware

from app.logging_config import request_id_ctx

logger = logging.getLogger("app.observability")

REQUEST_ID_HEADER = "X-Request-ID"

SERVICE_NAME = "monolith-backend"

HTTP_REQUESTS_TOTAL = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["service", "method", "route", "status_code"],
)
HTTP_REQUEST_DURATION = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["service", "method", "route"],
)
HTTP_REQUESTS_IN_FLIGHT = Gauge(
    "http_requests_in_flight",
    "HTTP requests currently being processed",
    ["service"],
)
DB_OPERATION_DURATION = Histogram(
    "db_operation_duration_seconds",
    "Duration of individual SQL statements",
    ["service"],
)
DB_ERRORS_TOTAL = Counter(
    "db_errors_total",
    "Total database errors",
    ["service"],
)


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Assigns/propagates X-Request-ID and records HTTP metrics.

    Mirrors the correlation-id pattern already used in sales-service and
    user-service so logs are consistent across the whole lab.
    """

    async def dispatch(self, request: Request, call_next: Callable):
        request_id = request.headers.get(REQUEST_ID_HEADER) or str(uuid.uuid4())
        token = request_id_ctx.set(request_id)
        HTTP_REQUESTS_IN_FLIGHT.labels(service=SERVICE_NAME).inc()
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            duration = time.perf_counter() - start
            route = _route_template(request)
            HTTP_REQUESTS_TOTAL.labels(
                service=SERVICE_NAME, method=request.method, route=route, status_code="500"
            ).inc()
            HTTP_REQUEST_DURATION.labels(
                service=SERVICE_NAME, method=request.method, route=route
            ).observe(duration)
            logger.exception(
                "request.error",
                extra={"method": request.method, "path": request.url.path},
            )
            raise
        else:
            duration = time.perf_counter() - start
            route = _route_template(request)
            response.headers[REQUEST_ID_HEADER] = request_id
            HTTP_REQUESTS_TOTAL.labels(
                service=SERVICE_NAME,
                method=request.method,
                route=route,
                status_code=str(response.status_code),
            ).inc()
            HTTP_REQUEST_DURATION.labels(
                service=SERVICE_NAME, method=request.method, route=route
            ).observe(duration)
            logger.info(
                "request.end",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "duration_ms": round(duration * 1000, 2),
                },
            )
            return response
        finally:
            HTTP_REQUESTS_IN_FLIGHT.labels(service=SERVICE_NAME).dec()
            request_id_ctx.reset(token)


def _route_template(request: Request) -> str:
    route = request.scope.get("route")
    if route is not None and hasattr(route, "path"):
        return route.path
    return request.url.path


def metrics_endpoint() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


def instrument_app(app: FastAPI) -> None:
    app.add_middleware(RequestContextMiddleware)
    app.add_api_route("/metrics", metrics_endpoint, methods=["GET"], include_in_schema=False)


def setup_tracing(app: FastAPI, engine) -> None:
    """Best-effort OpenTelemetry setup. If the OTel Collector is unreachable,
    span export simply fails silently in the background - it never blocks or
    breaks a request.
    """
    try:
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.instrumentation.logging import LoggingInstrumentor
        from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
        from opentelemetry.sdk.resources import SERVICE_NAME as OTEL_SERVICE_NAME
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
    except ImportError:
        logger.warning(
            "tracing.dependencies_missing", extra={"hint": "otel packages not installed"}
        )
        return

    import os

    endpoint = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT", "http://otel-collector:4317")
    resource = Resource.create({OTEL_SERVICE_NAME: SERVICE_NAME})
    provider = TracerProvider(resource=resource)
    provider.add_span_processor(
        BatchSpanProcessor(OTLPSpanExporter(endpoint=endpoint, insecure=True))
    )
    trace.set_tracer_provider(provider)

    FastAPIInstrumentor.instrument_app(app)
    SQLAlchemyInstrumentor().instrument(engine=engine)
    # Injects trace_id/span_id into every LogRecord (read by JsonFormatter).
    LoggingInstrumentor().instrument(set_logging_format=False)
    logger.info("tracing.enabled", extra={"otlp_endpoint": endpoint})


def instrument_db_metrics(engine) -> None:
    from sqlalchemy import event

    @event.listens_for(engine, "before_cursor_execute")
    def _before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        context._observability_start = time.perf_counter()

    @event.listens_for(engine, "after_cursor_execute")
    def _after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        start = getattr(context, "_observability_start", None)
        if start is not None:
            DB_OPERATION_DURATION.labels(service=SERVICE_NAME).observe(time.perf_counter() - start)

    @event.listens_for(engine, "handle_error")
    def _handle_error(exception_context):
        DB_ERRORS_TOTAL.labels(service=SERVICE_NAME).inc()
