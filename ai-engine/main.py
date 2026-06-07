"""
Nyxara AI Engine — Port 8001
FastAPI application entry point.
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from api.routes import score, explain, rings, clusters, batch, metrics, health
from startup import ensure_models_ready


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run model training/loading on startup."""
    await ensure_models_ready()
    yield


app = FastAPI(
    title="Nyxara AI Engine",
    description="Mule account detection — GNN + Ensemble + VAE + Explainability",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all routers
app.include_router(health.router, tags=["health"])
app.include_router(score.router, prefix="/v1", tags=["scoring"])
app.include_router(explain.router, prefix="/v1", tags=["explainability"])
app.include_router(rings.router, prefix="/v1", tags=["graph"])
app.include_router(clusters.router, prefix="/v1", tags=["graph"])
app.include_router(batch.router, prefix="/v1", tags=["batch"])
app.include_router(metrics.router, prefix="/v1", tags=["metrics"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("AI_ENGINE_PORT", 8001)),
        reload=True,
    )