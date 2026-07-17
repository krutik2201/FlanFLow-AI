"""FanFlow AI Backend — FastAPI application entrypoint."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import wayfinding, transport, ops, ws
from app.telemetry.simulator import TelemetrySimulator


# Shared simulator instance (singleton for this process)
simulator = TelemetrySimulator(seed=42)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start the telemetry simulator background task on startup."""
    import asyncio
    task = asyncio.create_task(simulator.run())
    app.state.simulator = simulator
    yield
    task.cancel()


app = FastAPI(
    title="FanFlow AI",
    description=(
        "Stadium wayfinding, accessibility, and operations platform. "
        "GenAI never computes physical facts — it only phrases, translates, and advises."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wayfinding.router, prefix="/wayfinding", tags=["Wayfinding"])
app.include_router(transport.router, prefix="/transport", tags=["Transport"])
app.include_router(ops.router, prefix="/ops", tags=["Operations"])
app.include_router(ws.router, tags=["WebSocket"])


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "service": "fanflow-ai-backend"}
