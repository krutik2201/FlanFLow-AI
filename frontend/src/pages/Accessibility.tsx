import { useEffect, useState } from 'react'
import { api, RouteResponse, VenueNode, VenueEdge } from '../api/client'
import { useAI, useTranslation } from '../context/AIContext'
import { VenueGraphMap } from '../components/VenueGraphMap'

const ACCESSIBILITY_NEEDS = [
  { id: 'wheelchair',     label: 'Wheelchair user',           icon: '♿', dest: 'elevator_north' },
  { id: 'step_free',      label: 'Step-free route required',  icon: '🚶', dest: null },
  { id: 'service_animal', label: 'Service animal relief stop', icon: '🐕', dest: 'restroom_w' },
  { id: 'sensory',        label: 'Sensory-friendly routing',   icon: '🤫', dest: 'quiet_room' },
]

const ACCESSIBLE_AMENITIES = [
  { id: 'quiet_room',       name: 'Quiet / Sensory Room',    desc: 'Low noise, calming environment', icon: '🤫' },
  { id: 'restroom_n',       name: 'Accessible Restrooms (N)', desc: 'North concourse, step-free',  icon: '🚻' },
  { id: 'restroom_s',       name: 'Accessible Restrooms (S)', desc: 'South concourse, step-free',  icon: '🚻' },
  { id: 'elevator_north',   name: 'Elevator (North)',         desc: 'Connects gate level to upper bowl', icon: '🛗' },
  { id: 'elevator_south',   name: 'Elevator (South)',         desc: 'South section access',         icon: '🛗' },
  { id: 'medical_station',  name: 'Medical Station',          desc: 'First aid near Gate A',        icon: '🏥' },
]

export default function Accessibility() {
  const { aiOffline, language } = useAI()
  const { t } = useTranslation()
  const [nodes, setNodes] = useState<VenueNode[]>([])
  const [edges, setEdges] = useState<VenueEdge[]>([])
  const [needs, setNeeds] = useState<Set<string>>(new Set())
  const [origin, setOrigin] = useState('gate_a')
  const [destination, setDestination] = useState('sec_101')
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

  function toggleNeed(id: string) {
    setNeeds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // If sensory or service_animal selected, override destination
  const effectiveDest = (() => {
    for (const n of ACCESSIBILITY_NEEDS) {
      if (needs.has(n.id) && n.dest) return n.dest
    }
    return destination
  })()

  async function findAccessibleRoute() {
    setLoading(true)
    setError(null)
    try {
      const r = await api.getRoute({
        origin, destination: effectiveDest,
        mode: 'accessible', congestion_aware: false,
        lang: language, ai_offline: aiOffline,
      })
      setResult(r)
    } catch (e: unknown) {
      const err = e as { message?: string }
      setError(err?.message ?? 'No accessible route found.')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (result) {
      findAccessibleRoute()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, aiOffline])


  const gateNodes = nodes.filter((n) => n.type === 'gate')
  const sectionNodes = nodes.filter((n) => n.type === 'section')

  return (
    <>
      <title>{t('accessibility')} — FanFlow AI</title>
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-brand-900 mb-1">{t('title_accessibility')}</h1>
        <p className="text-brand-400 text-sm mb-6">
          {language === 'es' ? 'Ruta sin escalones con alternativas de ascensor. Las rutas exclusivas para escaleras se excluyen automáticamente.' :
           language === 'fr' ? 'Itinéraire sans marches avec alternatives d\'ascenseur. Les itinéraires à escaliers uniquement sont exclus.' :
           language === 'ar' ? 'مسار خالٍ من الدرج مع بدائل المصعد. يتم استبعاد المسارات التي تحتوي على درج فقط تلقائيًا.' :
           language === 'pt' ? 'Rota sem degraus com alternativas de elevador. Os caminhos apenas com escadas são excluídos automaticamente.' :
           language === 'zh' ? '无台阶路线及电梯备选。仅包含台阶的路径将自动排除。' :
           language === 'de' ? 'Stufenlose Routenführung mit Aufzugsalternativen. Reine Treppenwege werden automatisch ausgeschlossen.' :
           'Step-free routing with elevator alternatives. Stair-only paths are automatically excluded.'}
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Needs panel */}
          <div className="flex flex-col gap-4">
            <section className="glass-card p-4" aria-labelledby="needs-heading">
              <h2 id="needs-heading" className="text-sm font-semibold text-brand-300 uppercase tracking-wider mb-3">
                {t('assistance_profile')}
              </h2>
              <div className="flex flex-col gap-2" role="group" aria-label="Select accessibility needs">
                {ACCESSIBILITY_NEEDS.map((n) => (
                  <label key={n.id} htmlFor={`need-${n.id}`} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-surface-700 transition-colors">
                    <input
                      id={`need-${n.id}`}
                      type="checkbox"
                      checked={needs.has(n.id)}
                      onChange={() => toggleNeed(n.id)}
                      className="h-4 w-4 rounded border-brand-700 bg-surface-700 text-brand-500 focus:ring-brand-400"
                    />
                    <span aria-hidden="true" className="text-lg">{n.icon}</span>
                    <span className="text-sm text-brand-200">
                      {n.id === 'wheelchair' ? t('wheelchair') :
                       n.id === 'step_free' ? t('step_free') :
                       n.id === 'service_animal' ? t('service_animal') :
                       t('sensory')}
                    </span>
                  </label>
                ))}
              </div>
            </section>

            {/* Origin / destination */}
            <div className="glass-card p-4 flex flex-col gap-3">
              <div>
                <label htmlFor="acc-origin" className="text-xs font-semibold text-brand-300 uppercase tracking-wider block mb-1">
                  {t('origin')}
                </label>
                <select id="acc-origin" value={origin} onChange={(e) => setOrigin(e.target.value)}
                  className="w-full bg-surface-700 border border-brand-700/40 text-brand-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">
                  {gateNodes.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="acc-dest" className="text-xs font-semibold text-brand-300 uppercase tracking-wider block mb-1">
                  {t('destination')}
                </label>
                <select id="acc-dest" value={destination} onChange={(e) => setDestination(e.target.value)}
                  className="w-full bg-surface-700 border border-brand-700/40 text-brand-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">
                  {sectionNodes.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              </div>
              <button
                id="find-accessible-route-btn"
                onClick={findAccessibleRoute}
                disabled={loading}
                className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-500 disabled:bg-surface-600
                           disabled:text-brand-400 text-white font-semibold rounded-lg transition-colors
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                {loading ? t('computing') : `♿ ${t('find_route')}`}
              </button>
            </div>

            {/* Amenity directory */}
            <section className="glass-card p-4" aria-labelledby="amenities-heading">
              <h2 id="amenities-heading" className="text-sm font-semibold text-brand-300 uppercase tracking-wider mb-3">
                {t('amenities')}
              </h2>
              <ul className="flex flex-col gap-2">
                {ACCESSIBLE_AMENITIES.map((a) => (
                  <li key={a.id} className="flex items-start gap-2 p-2 rounded-lg bg-surface-700/50">
                    <span aria-hidden="true" className="text-lg shrink-0">{a.icon}</span>
                    <div>
                      <p className="text-xs font-semibold text-brand-900">
                        {language === 'es' ? (a.id === 'quiet_room' ? 'Sala Sensorial Silenciosa' : a.id.startsWith('restroom') ? 'Baños Accesibles' : a.id.startsWith('elevator') ? 'Ascensor' : 'Estación Médica') :
                         language === 'fr' ? (a.id === 'quiet_room' ? 'Salle Sensorielle Calme' : a.id.startsWith('restroom') ? 'Toilettes Accessibles' : a.id.startsWith('elevator') ? 'Ascenseur' : 'Poste Médical') :
                         language === 'ar' ? (a.id === 'quiet_room' ? 'غرفة حسية هادئة' : a.id.startsWith('restroom') ? 'دورات مياه ميسرة' : a.id.startsWith('elevator') ? 'مصعد' : 'محطة طبية') :
                         language === 'pt' ? (a.id === 'quiet_room' ? 'Sala Sensorial Silenciosa' : a.id.startsWith('restroom') ? 'Banheiros Acessíveis' : a.id.startsWith('elevator') ? 'Elevador' : 'Estação Médica') :
                         language === 'zh' ? (a.id === 'quiet_room' ? '安静/感官室' : a.id.startsWith('restroom') ? '无障碍卫生间' : a.id.startsWith('elevator') ? '电梯' : '医疗站') :
                         language === 'de' ? (a.id === 'quiet_room' ? 'Beruhigungsraum' : a.id.startsWith('restroom') ? 'Barrierefreie Toiletten' : a.id.startsWith('elevator') ? 'Aufzug' : 'Sanitätsstation') :
                         a.name}
                      </p>
                      <p className="text-xs text-brand-400">
                        {language === 'es' ? (a.id === 'quiet_room' ? 'Entorno tranquilo' : 'Acceso sin escalones') :
                         language === 'fr' ? (a.id === 'quiet_room' ? 'Environnement calme' : 'Accès sans marches') :
                         language === 'ar' ? (a.id === 'quiet_room' ? 'بيئة هادئة' : 'سهل الوصول بدون درج') :
                         language === 'pt' ? (a.id === 'quiet_room' ? 'Ambiente calmo' : 'Acesso sem degraus') :
                         language === 'zh' ? (a.id === 'quiet_room' ? '低噪低敏感官友好环境' : '无台阶便捷通道') :
                         language === 'de' ? (a.id === 'quiet_room' ? 'Reizarme Umgebung' : 'Stufenloser Zugang') :
                         a.desc}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Result + map */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {error && (
              <div role="alert" className="glass-card p-4 border-red-500/30 bg-red-500/10">
                <p className="text-red-400 font-semibold mb-1">⚠️ {t('accessibility')}</p>
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            {result?.success && (
              <div className="glass-card p-4 animate-slide-up" aria-live="polite">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-brand-900">♿ {t('route_found')}</h2>
                  {result.fallback_mode && (
                    <span className="badge-deterministic">{t('offline')}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-surface-700 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-brand-300">{result.total_distance_m.toFixed(0)}m</p>
                    <p className="text-xs text-brand-400">{t('distance')}</p>
                  </div>
                  <div className="bg-surface-700 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-brand-300">{Math.ceil(result.estimated_walk_time_s / 60)}min</p>
                    <p className="text-xs text-brand-400">{t('walk_time')}</p>
                  </div>
                </div>
                {result.accessibility_accommodations.length > 0 && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-3">
                    {result.accessibility_accommodations.map((a, i) => (
                      <p key={i} className="text-xs text-green-800">✓ {a}</p>
                    ))}
                  </div>
                )}
                <pre className="text-sm text-brand-900 whitespace-pre-wrap font-sans leading-relaxed">
                  {result.phrased_directions}
                </pre>
              </div>
            )}

            <div className="glass-card p-2 flex-1 min-h-[350px]">
              <VenueGraphMap
                nodes={nodes}
                highlightedPath={result?.success ? result.nodes : []}
                edges={edges}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
