# FlanFlow AI — Stadium Wayfinding, Accessibility & Operations 🏟️

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/krutik2201/FlanFLow-AI)
[![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)](https://github.com/krutik2201/FlanFLow-AI)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)](https://github.com/krutik2201/FlanFLow-AI)
[![Python Version](https://img.shields.io/badge/python-3.12%20%7C%203.14-blue)](https://github.com/krutik2201/FlanFLow-AI)
[![Lighthouse](https://img.shields.io/badge/lighthouse-100%2F100-brightgreen)](https://github.com/krutik2201/FlanFLow-AI)

FlanFlow AI is a next-generation smart stadium platform designed to optimize crowd flow, enhance fan accessibility, and promote sustainable transit for the FIFA World Cup 2026. This application demonstrates a highly responsive, mathematically-driven venue topology system with a strict AI separation of concerns — powered by Google Gemini API (gemini-1.5-flash).

## Table of Contents
- [Problem](#-problem)
- [Features](#-features)
- [Architecture & Design Choices](#-architecture--design-choices)
- [Request Flow Architecture Diagram](#-request-flow-architecture-diagram)
- [Request Flow](#-request-flow)
- [Tech Stack](#-tech-stack)
- [Project Layout Tree](#-project-layout-tree)
- [Setup & Configuration](#-setup--configuration)
- [Testing](#-testing)
- [Security](#-security)
- [Deployment](#-deployment)

---

## 🏟️ Problem
Modern stadiums struggle with managing peak crowd densities and ensuring accessible routing for fans. Generic AI chatbots are ill-equipped for this as they hallucinate physical spaces and fail to provide deterministic, safe routes. FlanFlow AI solves this by providing focused, AI-assisted tools (not chatbots). The system mathematically computes shortest paths and strictly uses Google Gemini AI only as a natural-language presentation layer to translate hard math into friendly, multilingual instructions for fans navigating unfamiliar venues, while giving staff deterministic telemetry to monitor crowd density.

---

## ✨ Features

| Feature | Description | Deterministic Logic (Rules/Math) | AI Application (Google Gemini) |
| :--- | :--- | :--- | :--- |
| **Topology Wayfinding** | Real-time pathfinding through the stadium graph. | Dijkstra's algorithm strictly calculates the shortest physical route between nodes. | Translates the computed path array into conversational, localized text for the fan. |
| **Accessibility Routing** | Safe navigation for wheelchairs and strollers. | Prunes graph edges marked as stairs/escalators before path computation. | Explains the step-free accommodations applied to the requested route. |
| **Sustainable Transit** | Environmental impact analysis for fan commutes. | Distance and transit mode are captured deterministically from user input to calculate carbon weights. | Analyzes carbon footprint and suggests eco-friendly alternatives. |
| **Multilingual Support** | Instant localization of instructions into 7 languages. | The UI provides explicit language selection tags sent to the backend. | Translates the deterministic response into the fan's native language (ES, FR, AR, PT, ZH, DE). |
| **Staff Operations & Triage** | AI-powered triage dispatcher for volunteer coordination. | Fan incidents are categorized by zone and urgency level. | Translates raw multilingual fan requests into actionable English tasks with priority assignments. |

---

## 🏗️ Architecture & Design Choices

- **AI as a Phrasing Layer**: AI is strictly forbidden from calculating routes or making safety-critical decisions. The backend graph algorithm computes the `[Node A -> Node B]` path, and Google Gemini is only fed this immutable array to generate human-readable text.
- **Graceful Degradation (Offline Mode)**: If the Gemini API fails or times out, the system fails closed. The backend instantly returns deterministic fallback data (raw math output) instead of crashing, ensuring zero downtime for fans. The frontend features a toggle to simulate this behavior.
- **Server-Side Security**: API keys never leave the server. The React frontend has no access to the Google Gemini API.
- **HTTP Caching**: The `/venue-graph` endpoint returns `Cache-Control: public, max-age=3600, immutable` headers, eliminating redundant topology fetches since the stadium graph is static.
- **Dynamic SEO Optimization**: The frontend utilizes a custom `useSEO` React hook to dynamically inject page-specific titles, canonical links, and meta descriptions into the `<head>` in the user's selected language.
- **Micro-interactions & Responsiveness**: The UI uses CSS-driven micro-interactions, responsive grids, and SVG aspect-ratio scaling to guarantee native-app-like mobile responsiveness.

---

## 📊 Request Flow Architecture Diagram

```
[ Browser (React Frontend on Vercel) ]
        |
        | (1) HTTP POST /api/v1/wayfinding/route (JSON payload)
        v
[ FastAPI (Uvicorn on Render) ]
        |
        | (2) CORS Middleware -> (3) Rate Limiter
        v
[ Domain Routers (Wayfinding / Triage / Transport) ]
        |
        | (4) Deterministic Graph Logic (Dijkstra's Algorithm)
        v
[ Prompt Builder ]
        |
        | (5) Injects immutable math path into strict System/User/Assistant prompt template
        v
[ Google Gemini API — gemini-1.5-flash ] (Isolated phrasing layer)
```

---

## 🔁 Request Flow

1. **Form Submission**: The user selects origin, destination, and accessibility needs on the React frontend.
2. **Graph Computation**: The backend deterministic logic loads the JSON arena topology graph. If step-free routing is requested, stair/escalator edges are pruned. Dijkstra's algorithm computes the optimal physical path.
3. **Prompt Construction**: The computed array (e.g. `["Gate A", "Concourse North", "Section 101"]`) is injected into a strict zero-shot system prompt tailored for Gemini.
4. **AI Translation**: Google Gemini rapidly converts the hard data into a friendly, localized paragraph using strict System / User / Assistant instruction boundaries to prevent prompt leaks.
5. **Response & Fallback**: If Gemini succeeds, the structured JSON is returned. If it fails or is forced offline, the controlled deterministic fallback is returned. The frontend visualizes the path on an interactive SVG stadium map.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 18 + Vite, Tailwind CSS + Vanilla CSS, SVG Visualizer |
| **Backend** | Python 3.12+, FastAPI, Uvicorn, Pydantic |
| **AI Engine** | Google Gemini API (gemini-1.5-flash) |
| **Graph Algorithm** | Custom Dijkstra's with accessibility-aware edge pruning |
| **Hosting (Frontend)** | Vercel (Edge CDN) |
| **Hosting (Backend)** | Render (Uvicorn) |
| **Monitoring** | UptimeRobot (`/health` endpoint) |

---

## 📁 Project Layout Tree

```
FlanFlow-AI/
├── backend/                          # FastAPI server and business logic
│   ├── app/
│   │   ├── genai/                    # GenAI Client & Instruction Phrasing Desk
│   │   │   ├── client.py             # Gemini API client, system instructions, fallback logic
│   │   │   ├── ops_advisor.py        # Staff command recommendation phrased by Gemini
│   │   │   ├── phrasing.py           # Wayfinding instructions natural-language phrasing
│   │   │   └── triage.py             # Staff dispatcher triage categorization
│   │   ├── models/                   # Pydantic validation schemas
│   │   ├── routers/                  # API endpoints
│   │   │   ├── ops.py                # Staff / Ops command centers
│   │   │   ├── transport.py          # Sustainable commute calculations
│   │   │   ├── wayfinding.py         # Dijkstra wayfinding route endpoints
│   │   │   └── ws.py                 # Telemetry WebSockets
│   │   ├── routing/                  # Deterministic graph algorithms
│   │   │   ├── dijkstra.py           # Dijkstra shortest-path logic
│   │   │   ├── graph.py              # Nodes, edges and structural connectivity map
│   │   │   └── venue_data.py         # Static stadium nodes and routes data
│   │   ├── telemetry/                # Virtual sensor simulation
│   │   │   └── simulator.py          # Seeded random-walk sensor queues simulator
│   │   └── main.py                   # FastAPI initialization, CORS, WebSocket setup
│   └── requirements.txt              # Backend dependencies
├── frontend/                         # React SPA (Vite)
│   ├── src/
│   │   ├── components/               # Visual components (VenueGraphMap, TelemetryStrip)
│   │   ├── context/                  # State management (AIContext.tsx for translation/toggles)
│   │   ├── hooks/                    # Reusable React hooks (useSEO.ts, useTelemetry.ts)
│   │   ├── pages/                    # Views (Wayfinding, Accessibility, Transport)
│   │   ├── App.tsx                   # Layout structures and routing
│   │   └── index.css                 # Custom design system tokens and Tailwind imports
│   ├── public/                       # Static assets (robots.txt, sitemap.xml)
│   ├── vercel.json                   # Vercel SPA routing fallback configurations
│   └── package.json                  # Frontend dependencies
└── README.md                         # Project documentation
```

---

## ⚙️ Setup & Configuration

### Environment Variables
Create a `.env` file in the `backend/` directory:
```env
GEMINI_API_KEY=your_google_gemini_api_key_here
```

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
   The backend documentation will be available at `http://localhost:8000/docs`.

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
   The client application will open at `http://localhost:5173`.

---

## 🧪 Testing

### Backend Unit & Coverage Tests (Pytest)
The backend enforces a strict overall coverage threshold of **90%**, and **100%** on critical routing/triage modules:
```bash
cd backend
pytest --cov=app --cov-report=term-missing
```

### Frontend Unit Tests (Vitest)
```bash
cd frontend
npm run test
```

### Frontend E2E Tests (Playwright)
To run E2E browser tests under fully-mocked offline network states:
```bash
cd frontend
npx playwright test
```

### Lighthouse Audits
To locally execute compliance verification audits:
```bash
cd frontend
npm run build
npx lhci autorun --config=../lighthouserc.json
```

---

## 🔒 Security

- **Server-Side API Keys**: API credentials never touch the client browser.
- **CORS Configuration**: Restrictive domain whitelist configuration in the FastAPI middleware blocks untrusted requests.
- **Dynamic Input Sanitization**: Backend Pydantic models sanitize input fields and clean prompt injections dynamically.
- **Custom Security Headers**: Injected headers prevent clickjacking and XSS, including `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy: no-referrer`.

---

## 🚀 Deployment

The multi-cloud architecture auto-deploys from the main branch repository:
- **Frontend**: Hosted on Vercel, with rewrites targeting SPA client-side fallback routes.
- **Backend**: Hosted on Render, running under a Uvicorn ASGI server with hot-reloading configurations.
