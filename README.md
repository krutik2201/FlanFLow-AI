# FanFlow AI — Stadium Wayfinding, Accessibility & Operations

FanFlow AI is a high-performance, accessibility-first wayfinding and operations platform designed for World Cup-scale stadiums (FIFA 2026). The platform features an undirected, weighted stadium layout graph, a deterministic shortest-path and step-free routing engine, a live crowd/telemetry simulator, and a safe generative AI synthesis layer.

---

## 🔒 Crucial Architectural Boundary

> [!IMPORTANT]
> **GenAI never computes physical routes, distances, or safety-critical facts.**
> A deterministic engine (custom Dijkstra graph traversal) computes paths, estimated times, carbon footprints, and incident escalation rules. GenAI is only invoked as an enhancement layer to rephrase, translate, classify transcripts, and narrate telemetry summaries.
> The system operates fully and safely even if GenAI is offline or fails (timed out / circuit breaker open).

---

## 🏗️ System Architecture

```
                       ┌──────────────────────────────────────────────────────────┐
                       │                    BROWSER (React 18 + Vite)              │
                       │  Wayfinding │ Accessibility │ Transport │ Staff │ OpsCmd  │
                       │  ─────────────────────────────────────────────────────── │
                       │  VenueGraphMap (SVG)  │  LiveTelemetryStrip  │ AI Toggle  │
                       └───────────────┬──────────────────────────────────────────┘
                                       │ HTTPS / WebSocket
                       ┌───────────────▼──────────────────────────────────────────┐
                       │               FASTAPI BACKEND (Python 3.12/3.14)          │
                       │                                                          │
                       │  /wayfinding/route  →  [Dijkstra] → [GenAI phrasing?]    │
                       │  /triage            →  [GenAI classifier + Pydantic val]  │
                       │  /ops/recommend     →  [Telemetry snapshot + GenAI narr.] │
                       │  /transport/score   →  [Deterministic carbon calc]        │
                       │  /ws/telemetry      →  [Simulator push every 4s]         │
                       │                                                          │
                       │  ┌─────────────────┐   ┌──────────────────────────────┐  │
                       │  │  routing/       │   │  genai/                      │  │
                       │  │  graph.py       │   │  client.py (circuit breaker)  │  │
                       │  │  dijkstra.py    │   │  phrasing.py                 │  │
                       │  │  venue_data.py  │   │  triage.py                   │  │
                       │  └─────────────────┘   │  ops_advisor.py              │  │
                       │                        └──────────────────────────────┘  │
                       │  telemetry/simulator.py  (background task)                │
                       └──────────────────────────────────────────────────────────┘
                                       │
                          ┌────────────▼───────────┐
                          │  Gemini API            │
                          │  (gemini-1.5-flash)    │
                          │  — phrasing only —     │
                          │  — never computes —    │
                          └────────────────────────┘
```

---

## 🚀 Setup & Execution

### Prerequisites
- Python 3.12+ (Python 3.14 fully supported)
- Node.js 18+
- Gemini API Key (placed in backend `.env` file as `GEMINI_API_KEY`)

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt --prefer-binary
   ```
3. Run the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   The backend will be available at [http://localhost:8000](http://localhost:8000) and documentation at [http://localhost:8000/docs](http://localhost:8000/docs).

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install Node packages:
   ```bash
   npm install
   ```
3. Launch the React development server:
   ```bash
   npm run dev
   ```
   The client application will open at [http://localhost:5173](http://localhost:5173).

---

## 🧪 Testing

### Running Backend Tests
The backend enforces a strict coverage threshold of **90%** overall, and **100%** on critical routing/triage modules:
```bash
cd backend
pytest --cov=app --cov-report=term-missing
```

### Running Frontend Unit Tests
Unit tests are written using Vitest and React Testing Library:
```bash
cd frontend
npm run test
```

### Running Playwright E2E Tests
To run E2E offline-mocked browser tests:
```bash
cd frontend
npx playwright test
```

### Running Lighthouse Audits Locally
To check Lighthouse compliance of production build files:
```bash
cd frontend
npm run build
npx lhci autorun --config=../lighthouserc.json
```

---

## ⚠️ Known Limitations & Future Roadmap

1. **RAG Vector Database**: The staff copilot uses a hardcoded venue policy guide. In production, this would integrate with a vector database (e.g., pgvector/Chroma) and a retrieval-augmented generation (RAG) pipeline.
2. **Telemetry Feeds**: Telemetry is generated locally by a seeded random-walk simulator. A real venue implementation would subscribe to live IoT sensors, CCTV queue tracking cameras, and turnstile check-in webhooks.
3. **Database Layer**: There is no persistent database. Live staff triage records and custom routing waypoints are kept in-memory. A production version would introduce PostgreSQL for user state and Redis for cache layers.
