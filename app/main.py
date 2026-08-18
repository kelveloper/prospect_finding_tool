from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.routes import router
from app.database import Base, engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Prototype convenience; production migrations run via Alembic
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Emerging Affluent Prospecting API",
    description="Signal-driven prospect ranking prototype (physicians, V1)",
    version="0.1.0",
    lifespan=lifespan,
)
app.include_router(router)


@app.get("/health")
def health():
    return {"status": "ok"}
