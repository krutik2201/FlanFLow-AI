import { useState, useEffect } from 'react'
import { api, TelemetrySnapshot } from '../api/client'
import { useAI } from '../context/AIContext'
import { useTelemetry } from '../hooks/useTelemetry'

export default function OpsCommandBrain() {
  const { aiOffline } = useAI()
  const liveSnapshot = useTelemetry()

  // Local snapshot to fall back on if WebSocket not active yet
  const [snapshot, setSnapshot] = useState<TelemetrySnapshot | null>(null)
  const [loadingRec, setLoadingRec] = useState(false)
  const [recText, setRecText] = useState<string | null>(null)
  const [recFallback, setRecFallback] = useState(false)
  const [errorRec, setErrorRec] = useState<string | null>(null)

  // Sync WebSocket live telemetry with page state
  useEffect(() => {
    if (liveSnapshot) {
      setSnapshot(liveSnapshot)
    }
  }, [liveSnapshot])

  // Initial fetch for telemetry if WebSocket is connecting
  useEffect(() => {
    if (!snapshot) {
      api.getLatestTelemetry()
        .then(setSnapshot)
        .catch(() => {})
    }
  }, [snapshot])

  async function generateOpsRecommendation() {
    if (!snapshot) return
    setLoadingRec(true)
    setErrorRec(null)
    try {
      const res = await api.opsRecommend(snapshot, aiOffline)
      setRecText(res.recommendation)
      setRecFallback(res.fallback_mode)
    } catch (e: unknown) {
      const err = e as { message?: string }
      setErrorRec(err?.message ?? 'Failed to generate operational recommendations.')
      setRecText(null)
    } finally {
      setLoadingRec(false)
    }
  }

  if (!snapshot) {
    return (
      <div className="flex items-center justify-center h-64 text-brand-400 text-sm">
        Loading Operations telemetry...
      </div>
    )
  }

  return (
    <>
      <title>Ops Command Brain — FanFlow AI</title>
      <div className="animate-fade-in flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Ops Command Brain</h1>
          <p className="text-brand-400 text-sm">
            Real-time venue metrics, congestion mapping, and advisory intelligence.
          </p>
        </div>

        {/* Live Metrics Grid */}
        <section aria-label="Venue status metrics" className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-card p-4">
            <p className="text-xs text-brand-400 font-semibold uppercase">Overall Density</p>
            <p className={`text-3xl font-black mt-1 ${
              snapshot.overall_venue_density_pct > 75 ? 'text-red-400' :
              snapshot.overall_venue_density_pct > 40 ? 'text-amber-400' : 'text-green-400'
            }`}>
              {snapshot.overall_venue_density_pct.toFixed(0)}%
            </p>
            <p className="text-[10px] text-brand-500 mt-1">Average across all concourse zones</p>
          </div>

          <div className="glass-card p-4">
            <p className="text-xs text-brand-400 font-semibold uppercase">Max Gate Queue</p>
            {(() => {
              const maxGate = [...snapshot.gates].sort((a, b) => b.queue_time_min - a.queue_time_min)[0]
              return (
                <>
                  <p className={`text-3xl font-black mt-1 ${maxGate.queue_time_min > 8 ? 'text-red-400' : 'text-green-400'}`}>
                    {maxGate.queue_time_min.toFixed(1)}m
                  </p>
                  <p className="text-[10px] text-brand-400 mt-1 truncate">{maxGate.gate_name}</p>
                </>
              )
            })()}
          </div>

          <div className="glass-card p-4">
            <p className="text-xs text-brand-400 font-semibold uppercase">Active Volunteers</p>
            <p className="text-3xl font-black mt-1 text-brand-300">
              {snapshot.staff.reduce((acc, s) => acc + s.staff_count, 0)}
            </p>
            <p className="text-[10px] text-brand-500 mt-1">Deployed at entrance safety points</p>
          </div>

          <div className="glass-card p-4">
            <p className="text-xs text-brand-400 font-semibold uppercase">Transit Lines</p>
            <p className="text-3xl font-black mt-1 text-green-400">Normal</p>
            <p className="text-[10px] text-brand-500 mt-1">Metro and Shuttle systems running</p>
          </div>
        </section>

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left/Middle Column: Zone densities and Gate Queues */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Zone Densities */}
            <section aria-labelledby="zones-heading" className="glass-card p-5">
              <h2 id="zones-heading" className="text-sm font-semibold text-brand-300 uppercase tracking-wider mb-4">
                Concourse Zone Crowding
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-brand-900/50 text-brand-400 uppercase tracking-wider">
                      <th className="py-2.5 px-3">Zone</th>
                      <th className="py-2.5 px-3">Density</th>
                      <th className="py-2.5 px-3">Weight Multiplier</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.zones.map((z) => (
                      <tr key={z.zone_id} className="border-b border-brand-900/20 hover:bg-surface-700/30">
                        <td className="py-3 px-3 font-medium text-white">{z.zone_name}</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-brand-200">{z.density_pct.toFixed(0)}%</span>
                            <div className="w-20 bg-surface-600 h-1.5 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{
                                width: `${z.density_pct}%`,
                                backgroundColor: z.density_pct > 75 ? '#ef4444' : z.density_pct > 40 ? '#f59e0b' : '#22c55e'
                              }} />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-brand-400">{z.congestion_multiplier.toFixed(2)}x</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded font-semibold text-[10px] uppercase ${
                            z.status === 'congested' ? 'bg-red-500/10 text-red-400 border border-red-500/30' :
                            z.status === 'busy' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                            'bg-green-500/10 text-green-400 border border-green-500/30'
                          }`}>
                            {z.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Gate Queues & Staff deployment */}
            <section aria-labelledby="gates-heading" className="glass-card p-5">
              <h2 id="gates-heading" className="text-sm font-semibold text-brand-300 uppercase tracking-wider mb-4">
                Entrance Safety Gates & Staffing
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {snapshot.gates.map((g) => {
                  const s = snapshot.staff.find((st) => st.gate_id === g.gate_id)
                  return (
                    <div key={g.gate_id} className="p-3 bg-surface-700/40 rounded-lg flex justify-between items-center">
                      <div>
                        <p className="text-sm font-semibold text-white">{g.gate_name}</p>
                        <p className="text-xs text-brand-400">Queue Time: <strong className="text-brand-300">{g.queue_time_min.toFixed(1)} min</strong></p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-brand-400 block">Volunteer Count</span>
                        <strong className="text-sm text-brand-200">{s?.staff_count ?? 0} / {s?.capacity ?? 10}</strong>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </div>

          {/* Right Column: AI Ops Advisor Recommendation */}
          <section aria-labelledby="advisor-heading" className="glass-card p-5 flex flex-col gap-4">
            <h2 id="advisor-heading" className="text-lg font-semibold text-white flex items-center gap-2">
              🧠 Operations Advisor
            </h2>
            <p className="text-xs text-brand-400">
              Generates strategic dispatch options, crowd control recommendations, and safety alerts based directly on real-time data inputs.
            </p>

            <button
              id="recommend-btn"
              onClick={generateOpsRecommendation}
              disabled={loadingRec}
              className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-500 disabled:bg-surface-600 disabled:text-brand-500 text-white font-semibold rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              {loadingRec ? 'Generating recommendations...' : '✨ Generate Decision Recommendation'}
            </button>

            {errorRec && (
              <div role="alert" className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-xs text-red-400">⚠️ {errorRec}</p>
              </div>
            )}

            {recText && (
              <div className="bg-surface-800 border border-brand-900/50 rounded-xl p-4 flex flex-col gap-3 animate-slide-up" aria-live="polite">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-brand-400 uppercase">Operational Directive</h3>
                  {recFallback && (
                    <span className="badge-deterministic">⚙️ Deterministic</span>
                  )}
                </div>
                <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{recText}</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  )
}
