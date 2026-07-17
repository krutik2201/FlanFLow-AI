import { useTelemetry } from '../hooks/useTelemetry'

function densityColor(pct: number): string {
  if (pct < 40) return '#15803d'
  if (pct < 75) return '#b45309'
  return '#b91c1c'
}

export function LiveTelemetryStrip() {
  const snapshot = useTelemetry()

  if (!snapshot) {
    return (
      <div
        className="h-10 bg-surface-800 border-b border-brand-900/50 flex items-center px-4 gap-3"
        aria-label="Telemetry loading"
        role="status"
      >
        <span className="text-xs text-brand-400 animate-pulse">Connecting to live telemetry…</span>
      </div>
    )
  }

  return (
    <div
      className="h-10 bg-surface-800 border-b border-brand-900/50 flex items-center px-4 gap-4 overflow-x-auto"
      role="status"
      aria-label="Live venue telemetry"
      aria-live="polite"
    >
      {/* Overall density */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span
          className="h-2 w-2 rounded-full animate-pulse-slow"
          style={{ backgroundColor: densityColor(snapshot.overall_venue_density_pct) }}
          aria-hidden="true"
        />
        <span className="text-xs font-medium text-brand-200">
          Venue: <strong>{snapshot.overall_venue_density_pct.toFixed(0)}%</strong>
        </span>
      </div>

      <div className="h-4 w-px bg-brand-800" aria-hidden="true" />

      {/* Gate queues */}
      {snapshot.gates.slice(0, 3).map((gate) => (
        <div key={gate.gate_id} className="flex items-center gap-1 shrink-0">
          <span className="text-xs text-brand-400">{gate.gate_name.split(' ')[0]} {gate.gate_name.split(' ')[1]}:</span>
          <span
            className="text-xs font-semibold"
            style={{ color: gate.queue_time_min > 8 ? '#b91c1c' : gate.queue_time_min > 4 ? '#b45309' : '#15803d' }}
          >
            {gate.queue_time_min.toFixed(1)}m
          </span>
        </div>
      ))}

      <div className="h-4 w-px bg-brand-800" aria-hidden="true" />

      {/* Transit */}
      {snapshot.transit.map((t) => (
        <div key={t.mode} className="flex items-center gap-1 shrink-0">
          <span className="text-xs text-brand-400">{t.mode === 'rail' ? '🚇' : '🚌'}:</span>
          <span className={`text-xs font-semibold ${t.status === 'delayed' ? 'text-red-600' : 'text-green-700'}`}>
            {t.eta_min.toFixed(0)}min
          </span>
        </div>
      ))}
    </div>
  )
}
