import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine
from app.logging_config import configure_logging
from app.observability import instrument_app, instrument_db_metrics, setup_tracing
from app.routers import sales, users

configure_logging()
logger = logging.getLogger("app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Monolith API starting up")
    logger.info("CORS origins: %s", settings.cors_origins_list)
    yield
    logger.info("Monolith API shutting down")


app = FastAPI(title="Monolith Lab API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

instrument_app(app)
instrument_db_metrics(engine)
setup_tracing(app, engine)

app.include_router(users.router)
app.include_router(sales.router)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}
