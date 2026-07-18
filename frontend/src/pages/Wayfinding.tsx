import { useEffect, useState } from 'react'
import { api, RouteResponse, VenueNode, VenueEdge } from '../api/client'
import { useAI, useTranslation } from '../context/AIContext'
import { VenueGraphMap } from '../components/VenueGraphMap'
import { useSEO } from '../hooks/useSEO'

const MODES = [
  { value: 'standard',   label: 'Standard',    icon: '🚶' },
  { value: 'accessible', label: 'Accessible',  icon: '♿' },
]

function FallbackBadge() {
  return (
    <span className="badge-deterministic" aria-label="Deterministic mode active">
      ⚙️ Deterministic mode — AI unavailable
    </span>
  )
}

function WalkTimeLabel({ seconds }: { seconds: number }) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return <>{mins > 0 ? `${mins}m ` : ''}{secs}s</>
}

export default function Wayfinding() {
  const { aiOffline, language } = useAI()
  const { t } = useTranslation()
  useSEO('title_wayfinding', 'meta_desc_wayfinding')

  const [nodes, setNodes] = useState<VenueNode[]>([])
  const [edges, setEdges] = useState<VenueEdge[]>([])
  const [origin, setOrigin] = useState('gate_a')
  const [destination, setDestination] = useState('sec_101')
  const [mode, setMode] = useState<'standard' | 'accessible'>('standard')
  const [congestionAware, setCongestionAware] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RouteResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getNodes().then((r) => {
      setNodes(r.nodes)
      if ('edges' in r) {
        setEdges(r.edges)
      }
    }).catch(() => {})
  }, [])

  async function handleRoute() {
    if (!origin || !destination) return
    setLoading(true)
    setError(null)
    try {
      const r = await api.getRoute({
        origin, destination, mode, congestion_aware: congestionAware,
        lang: language, ai_offline: aiOffline,
      })
      setResult(r)
    } catch (e: unknown) {
      const err = e as { message?: string }
      setError(err?.message ?? 'Could not compute route. Please try again.')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (result) {
      handleRoute()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, aiOffline])


  const nodeGroups = {
    Gates: nodes.filter((n) => n.type === 'gate'),
    Concourses: nodes.filter((n) => n.type === 'concourse'),
    Sections: nodes.filter((n) => n.type === 'section'),
    Amenities: nodes.filter((n) => n.type === 'amenity'),
    Transport: nodes.filter((n) => n.type === 'transport'),
  }

  function NodeSelect({ id, value, onChange, label }: {
    id: string; value: string; onChange: (v: string) => void; label: string
  }) {
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="text-xs font-semibold text-brand-300 uppercase tracking-wider">
          {label}
        </label>
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-surface-700 border border-brand-700/40 text-brand-900 rounded-lg px-3 py-3 h-12
                     text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          {Object.entries(nodeGroups).map(([group, groupNodes]) =>
            groupNodes.length > 0 ? (
              <optgroup key={group} label={t(group.toLowerCase())}>
                {groupNodes.map((n) => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </optgroup>
            ) : null
          )}
        </select>
      </div>
    )
  }

  return (
    <>
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-brand-900 mb-1">{t('title_wayfinding')}</h1>
        <p className="text-brand-400 text-sm mb-6">
          {language === 'es' ? 'Encuentre la ruta más rápida a cualquier lugar del estadio: ruta calculada de forma determinista, ' :
           language === 'fr' ? 'Trouvez l\'itinéraire le plus rapide vers n\'importe quel endroit du stade — itinéraire calculé de manière déterministe, ' :
           language === 'ar' ? 'البحث عن أسرع طريق إلى أي موقع في الملعب - يتم حساب المسار بشكل حتمي، ' :
           language === 'pt' ? 'Encontre a rota mais rápida para qualquer local do estádio — rota calculada deterministicamente, ' :
           language === 'zh' ? '寻找前往任何场馆地点的最快路线 — 路线以确定性方式计算， ' :
           language === 'de' ? 'Finden Sie den schnellsten Weg zu jedem Veranstaltungsort — die Route wird deterministisch berechnet, ' :
           'Find the fastest route to any venue location — route computed deterministically, '}
          {aiOffline ? 
            (language === 'es' ? ' direcciones mostradas en modo determinista.' :
             language === 'fr' ? ' directions affichées en mode déterministe.' :
             language === 'ar' ? ' تظهر الاتجاهات في الوضع الحتمي.' :
             language === 'pt' ? ' direções mostradas no modo determinístico.' :
             language === 'zh' ? ' 路线指引以确定性模式显示。' :
             language === 'de' ? ' Wegbeschreibung im deterministischen Modus angezeigt.' :
             ' directions shown in deterministic mode.') : 
            (language === 'es' ? ' direcciones redactadas por IA.' :
             language === 'fr' ? ' directions formulées par l\'IA.' :
             language === 'ar' ? ' تم صياغة الاتجاهات بواسطة الذكاء الاصطnaعي.' :
             language === 'pt' ? ' direções formuladas por IA.' :
             language === 'zh' ? ' 路线指引由人工智能生成。' :
             language === 'de' ? ' Wegbeschreibung von KI formuliert.' :
             ' directions phrased by AI.')}
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Controls */}
          <section aria-label="Route configuration" className="flex flex-col gap-4">
            <div className="glass-card p-4 flex flex-col gap-4">
              <NodeSelect id="origin-select"      value={origin}      onChange={setOrigin}      label={t('origin')} />
              <NodeSelect id="destination-select" value={destination} onChange={setDestination} label={t('destination')} />

              {/* Mode selector */}
              <div>
                <p className="text-xs font-semibold text-brand-300 uppercase tracking-wider mb-2">{t('routing_mode')}</p>
                <div className="flex gap-2" role="group" aria-label="Routing mode">
                  {MODES.map((m) => (
                    <button
                      key={m.value}
                      id={`mode-${m.value}`}
                      onClick={() => setMode(m.value as 'standard' | 'accessible')}
                      aria-pressed={mode === m.value}
                      className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium min-h-[48px] h-12
                                  transition-colors border focus:outline-none focus-visible:ring-2
                                  focus-visible:ring-brand-400
                                  ${mode === m.value
                                    ? 'bg-brand-600/30 border-brand-500 text-brand-200'
                                    : 'bg-surface-700 border-brand-700/40 text-brand-400 hover:border-brand-600'
                                  }`}
                    >
                      <span aria-hidden="true">{m.icon}</span>
                      {m.value === 'standard' ? t('standard') : t('accessible')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Congestion aware */}
              <label className="flex items-center gap-3 cursor-pointer group py-2.5 min-h-[48px]" htmlFor="congestion-toggle">
                <input
                  id="congestion-toggle"
                  type="checkbox"
                  checked={congestionAware}
                  onChange={(e) => setCongestionAware(e.target.checked)}
                  className="h-5 w-5 rounded border-brand-700 bg-surface-700 text-brand-600
                             focus:ring-brand-400 focus:ring-2 focus:ring-offset-0"
                />
                <span className="text-sm text-brand-300 group-hover:text-brand-200">
                  {t('congestion')}
                </span>
              </label>

              <button
                id="find-route-btn"
                onClick={handleRoute}
                disabled={loading || !origin || !destination || origin === destination}
                className="w-full py-3.5 px-4 bg-brand-600 hover:bg-brand-500 disabled:bg-surface-600
                           disabled:text-brand-400 text-white font-semibold rounded-lg transition-colors
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 min-h-[48px] h-12"
                aria-busy={loading}
              >
                {loading ? t('computing') : `🗺️ ${t('find_route')}`}
              </button>
            </div>

            {/* Result panel */}
            {error && (
              <div role="alert" className="glass-card p-4 border-red-500/30 bg-red-500/10">
                <p className="text-red-400 text-sm">⚠️ {error}</p>
              </div>
            )}

            {result?.success && (
              <div className="glass-card p-4 flex flex-col gap-3 animate-slide-up" aria-live="polite">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-brand-900">{t('route_found')}</h2>
                  {result.fallback_mode && <FallbackBadge />}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-surface-700 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-brand-300">{result.total_distance_m.toFixed(0)}m</p>
                    <p className="text-xs text-brand-400 mt-0.5">{t('distance')}</p>
                  </div>
                  <div className="bg-surface-700 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-brand-300">
                      <WalkTimeLabel seconds={result.estimated_walk_time_s} />
                    </p>
                    <p className="text-xs text-brand-400 mt-0.5">{t('walk_time')}</p>
                  </div>
                </div>

                {result.accessibility_accommodations.length > 0 && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                    <p className="text-xs font-semibold text-green-700 mb-1">♿ {t('accessible_route')}</p>
                    {result.accessibility_accommodations.map((a, i) => (
                      <p key={i} className="text-xs text-green-800">{a}</p>
                    ))}
                  </div>
                )}

                <div className="bg-surface-700 rounded-lg p-3">
                  <p className="text-xs font-semibold text-brand-400 mb-2">{t('walking_directions')}</p>
                  <pre className="text-sm text-brand-900 whitespace-pre-wrap font-sans leading-relaxed">
                    {result.phrased_directions}
                  </pre>
                </div>

                <div className="text-xs text-brand-400 border-t border-brand-800 pt-2">
                  {t('path')}: {result.node_names.join(' → ')}
                </div>
              </div>
            )}
          </section>

          {/* Map */}
          <section aria-label="Venue map" className="min-h-[400px]">
            <div className="glass-card p-2 h-full">
              <VenueGraphMap
                nodes={nodes}
                highlightedPath={result?.success ? result.nodes : []}
                edges={edges}
              />
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
