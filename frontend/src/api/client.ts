const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export interface RouteResponse {
  success: boolean
  nodes: string[]
  node_names: string[]
  total_distance_m: number
  estimated_walk_time_s: number
  accessibility_accommodations: string[]
  phrased_directions: string
  deterministic_directions: string
  fallback_mode: boolean
  mode: string
  congestion_aware: boolean
  error?: string
  // Error case
  reason?: string
  message?: string
}

export interface VenueNode {
  id: string
  name: string
  type: string
  x: number
  y: number
}

export interface TransportScoreResponse {
  mode: string
  label: string
  carbon_g: number
  eta_min: number
  cost_usd: number
  summary_text: string
  fallback_mode: boolean
  all_modes: Array<{ mode: string; label: string; carbon_g: number; eta_min: number; cost_usd: number }>
}

export interface TriageResult {
  category: string
  severity: string
  recommended_action: string
  needs_human_review: boolean
  escalation_required: boolean
  fallback_mode: boolean
}

export interface TelemetrySnapshot {
  timestamp: string
  gates: Array<{ gate_id: string; gate_name: string; queue_time_min: number; crowd_pct: number }>
  zones: Array<{ zone_id: string; zone_name: string; density_pct: number; congestion_multiplier: number; status: string }>
  transit: Array<{ mode: string; eta_min: number; status: string; line_name: string }>
  staff: Array<{ gate_id: string; gate_name: string; staff_count: number; capacity: number }>
  overall_venue_density_pct: number
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw { status: res.status, ...body }
  }
  return res.json()
}

export interface VenueEdge {
  from: string
  to: string
  distance_m: number
  has_stairs: boolean
  has_elevator: boolean
}

export const api = {
  getNodes: () => apiFetch<{ nodes: VenueNode[]; edges: VenueEdge[] }>('/wayfinding/nodes'),

  getRoute: (params: {
    origin: string
    destination: string
    mode: string
    congestion_aware: boolean
    lang: string
    ai_offline: boolean
  }) => {
    const q = new URLSearchParams({
      origin: params.origin,
      destination: params.destination,
      mode: params.mode,
      congestion_aware: String(params.congestion_aware),
      lang: params.lang,
      ai_offline: String(params.ai_offline),
    })
    return apiFetch<RouteResponse>(`/wayfinding/route?${q}`)
  },

  getTransportScore: (mode: string, ai_offline: boolean) =>
    apiFetch<TransportScoreResponse>(`/transport/score?mode=${mode}&ai_offline=${ai_offline}`),

  triageIncident: (transcript: string, ai_offline: boolean) =>
    apiFetch<TriageResult>(`/ops/triage?ai_offline=${ai_offline}`, {
      method: 'POST',
      body: JSON.stringify({ transcript }),
    }),

  staffCopilot: (question: string, ai_offline: boolean) =>
    apiFetch<{ answer: string; fallback_mode: boolean }>('/ops/staff/copilot', {
      method: 'POST',
      body: JSON.stringify({ question, ai_offline }),
    }),

  opsRecommend: (snapshot: TelemetrySnapshot, ai_offline: boolean) =>
    apiFetch<{ recommendation: string; fallback_mode: boolean }>(`/ops/recommend?ai_offline=${ai_offline}`, {
      method: 'POST',
      body: JSON.stringify(snapshot),
    }),

  getLatestTelemetry: () =>
    apiFetch<TelemetrySnapshot>('/ops/telemetry/latest'),
}
