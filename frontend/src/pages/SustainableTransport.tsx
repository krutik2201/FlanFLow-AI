import { useEffect, useState } from 'react'
import { api, TransportScoreResponse } from '../api/client'
import { useAI, useTranslation } from '../context/AIContext'
import { useTelemetry } from '../hooks/useTelemetry'
import { useSEO } from '../hooks/useSEO'

const TRANSPORT_MODES = [
  { mode: 'transit',   label: 'Rail / Metro',  icon: '🚇', color: '#3d7eff', desc: 'Lowest emissions' },
  { mode: 'walk',      label: 'Walk / Cycle',  icon: '🚶', color: '#22c55e', desc: 'Zero emissions' },
  { mode: 'rideshare', label: 'Rideshare',     icon: '🚗', color: '#f59e0b', desc: 'Moderate emissions' },
  { mode: 'parking',   label: 'Drive & Park',  icon: '🅿️', color: '#ef4444', desc: 'Highest emissions' },
]

// Max carbon for bar chart scale
const MAX_CARBON = 1700

function CarbonBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="relative h-3 bg-surface-600 rounded-full overflow-hidden" role="presentation">
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${pct}%`, backgroundColor: color }}
        aria-hidden="true"
      />
    </div>
  )
}

export default function SustainableTransport() {
  const { aiOffline, language } = useAI()
  const { t } = useTranslation()
  const telemetry = useTelemetry()
  useSEO('title_transport', 'meta_desc_transport')

  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TransportScoreResponse | null>(null)

  async function handleSelect(mode: string) {
    setSelected(mode)
    setLoading(true)
    try {
      const r = await api.getTransportScore(mode, aiOffline)
      setResult(r)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selected) {
      handleSelect(selected)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiOffline])


  // Live transit ETA from WebSocket
  const railETA = telemetry?.transit.find((t) => t.mode === 'rail')
  const busETA = telemetry?.transit.find((t) => t.mode === 'bus')

  return (
    <>
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-brand-900 mb-1">{t('title_transport')}</h1>
        <p className="text-brand-400 text-sm mb-6">
          {language === 'es' ? 'Compare la huella de carbono y el tiempo de viaje para diferentes modos de transporte. Todas las cifras se calculan de forma determinista: la IA solo agrega contexto.' :
           language === 'fr' ? 'Comparez l\'empreinte carbone et le temps de trajet pour différents modes de transport. Tous les chiffres sont calculés de manière déterministe — l\'IA ajoute du contexte uniquement.' :
           language === 'ar' ? 'قارن بين البصمة الكربونية ووقت السفر لمختلف وسائل النقل. يتم حساب جميع الأرقام بشكل حتمي - يضيف الذكاء الاصطناعي السياق فقط.' :
           language === 'pt' ? 'Compare a pegada de carbono e o tempo de viagem para diferentes modos de transporte. Todos os números são calculados deterministicamente — a IA adiciona contexto apenas.' :
           language === 'zh' ? '比较不同交通方式的碳足迹和出行时间。所有数据均通过确定性计算得出 — 人工智能仅添加上下文。' :
           language === 'de' ? 'Vergleichen Sie die CO2-Bilanz und die Reisezeit für verschiedene Transportmittel. Alle Zahlen werden deterministisch berechnet — KI fügt nur Kontext hinzu.' :
           'Compare carbon footprint and travel time for different transport modes. All figures are deterministically computed — AI adds context only.'}
        </p>

        {/* Live transit status */}
        {telemetry && (
          <div className="glass-card p-4 mb-6 flex flex-wrap gap-4" aria-label="Live transit status">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse-slow" aria-hidden="true"/>
              <span className="text-xs font-semibold text-brand-300">
                {language === 'es' ? 'Tránsito en Vivo' : language === 'fr' ? 'Transit en Direct' : language === 'ar' ? 'حركة النقل المباشرة' : language === 'pt' ? 'Trânsito ao Vivo' : language === 'zh' ? '实时交通' : language === 'de' ? 'Live-Transit' : 'Live Transit'}
              </span>
            </div>
            {railETA && (
              <div className="flex items-center gap-1.5">
                <span className="text-lg" aria-hidden="true">🚇</span>
                <div>
                  <p className="text-xs text-brand-900 font-semibold">{railETA.line_name}</p>
                  <p className={`text-xs ${railETA.status === 'delayed' ? 'text-red-600' : 'text-green-700'}`}>
                    ETA {railETA.eta_min.toFixed(0)} min — {railETA.status}
                  </p>
                </div>
              </div>
            )}
            {busETA && (
              <div className="flex items-center gap-1.5">
                <span className="text-lg" aria-hidden="true">🚌</span>
                <div>
                  <p className="text-xs text-brand-900 font-semibold">{busETA.line_name}</p>
                  <p className={`text-xs ${busETA.status === 'delayed' ? 'text-red-600' : 'text-green-700'}`}>
                    ETA {busETA.eta_min.toFixed(0)} min — {busETA.status}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Mode selector */}
          <section aria-labelledby="transport-mode-heading">
            <h2 id="transport-mode-heading" className="sr-only">Select transport mode</h2>
            <div className="grid grid-cols-2 gap-3">
              {TRANSPORT_MODES.map((m) => (
                <button
                  key={m.mode}
                  id={`transport-mode-${m.mode}`}
                  onClick={() => handleSelect(m.mode)}
                  aria-pressed={selected === m.mode}
                  className={`glass-card p-4 text-left transition-all flex flex-col gap-2 cursor-pointer
                               focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400
                               ${selected === m.mode ? 'border-brand-500 bg-brand-600/20' : 'hover:border-brand-700/60'}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl" aria-hidden="true">{m.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-brand-900">
                        {m.mode === 'transit' ? (language === 'es' ? 'Tren / Metro' : language === 'fr' ? 'Train / Métro' : language === 'ar' ? 'قطار / مترو' : language === 'pt' ? 'Trem / Metrô' : language === 'zh' ? '火车 / 地铁' : language === 'de' ? 'Bahn / U-Bahn' : m.label) :
                         m.mode === 'walk' ? (language === 'es' ? 'Caminar / Bicicleta' : language === 'fr' ? 'Marcher / Vélo' : language === 'ar' ? 'مشي / دراجة' : language === 'pt' ? 'Caminhar / Bicicleta' : language === 'zh' ? '步行 / 自行车' : language === 'de' ? 'Gehen / Radfahren' : m.label) :
                         m.mode === 'rideshare' ? (language === 'es' ? 'Viaje Compartido' : language === 'fr' ? 'Covoiturage' : language === 'ar' ? 'تشارُك الركوب' : language === 'pt' ? 'Carona Compartilhada' : language === 'zh' ? '网约车' : language === 'de' ? 'Fahrgemeinschaft' : m.label) :
                         (language === 'es' ? 'Conducir y Estacionar' : language === 'fr' ? 'Conduire & Stationner' : language === 'ar' ? 'قيادة وموقف' : language === 'pt' ? 'Dirigir e Estacionar' : language === 'zh' ? '自驾泊车' : language === 'de' ? 'Fahren & Parken' : m.label)}
                      </p>
                      <p className="text-xs text-brand-400">
                        {language === 'es' ? (m.mode === 'transit' ? 'Emisiones más bajas' : m.mode === 'walk' ? 'Cero emisiones' : m.mode === 'rideshare' ? 'Emisiones moderadas' : 'Emisiones más altas') :
                         language === 'fr' ? (m.mode === 'transit' ? 'Émissions les plus faibles' : m.mode === 'walk' ? 'Zéro émission' : m.mode === 'rideshare' ? 'Émissions modérées' : 'Émissions les plus élevées') :
                         language === 'ar' ? (m.mode === 'transit' ? 'أقل انبعاثات' : m.mode === 'walk' ? 'خالٍ من الانبعاثات' : m.mode === 'rideshare' ? 'انبعاثات معتدلة' : 'أعلى انبعاثات') :
                         language === 'pt' ? (m.mode === 'transit' ? 'Menores emissões' : m.mode === 'walk' ? 'Zero emissões' : m.mode === 'rideshare' ? 'Emissões moderadas' : 'Maiores emissões') :
                         language === 'zh' ? (m.mode === 'transit' ? '最低碳排放' : m.mode === 'walk' ? '零碳排放' : m.mode === 'rideshare' ? '中等碳排放' : '最高碳排放') :
                         language === 'de' ? (m.mode === 'transit' ? 'Niedrigste Emissionen' : m.mode === 'walk' ? 'Null Emissionen' : m.mode === 'rideshare' ? 'Moderate Emissionen' : 'Höchste Emissionen') :
                         m.desc}
                      </p>
                    </div>
                  </div>
                  {loading && selected === m.mode && (
                    <div className="text-xs text-brand-400 animate-pulse">
                      {language === 'es' ? 'Calculando…' : language === 'fr' ? 'Calcul en cours…' : language === 'ar' ? 'جاري الحساب…' : language === 'pt' ? 'Calculando…' : language === 'zh' ? '正在计算…' : language === 'de' ? 'Berechnung…' : 'Calculating…'}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Results */}
          {result && (
            <section className="glass-card p-5 flex flex-col gap-4 animate-slide-up" aria-live="polite" aria-labelledby="transport-result-heading">
              <div className="flex items-center justify-between">
                <h2 id="transport-result-heading" className="font-semibold text-brand-900">
                  {TRANSPORT_MODES.find((m) => m.mode === result.mode)?.icon}{' '}
                  {result.mode === 'transit' ? (language === 'es' ? 'Tren / Metro' : language === 'fr' ? 'Train / Métro' : language === 'ar' ? 'قطار / مترو' : language === 'pt' ? 'Trem / Metrô' : language === 'zh' ? '火车 / 地铁' : language === 'de' ? 'Bahn / U-Bahn' : result.label) :
                   result.mode === 'walk' ? (language === 'es' ? 'Caminar / Bicicleta' : language === 'fr' ? 'Marcher / Vélo' : language === 'ar' ? 'مشي / دراجة' : language === 'pt' ? 'Caminhar / Bicicleta' : language === 'zh' ? '步行 / 自行车' : language === 'de' ? 'Gehen / Radfahren' : result.label) :
                   result.mode === 'rideshare' ? (language === 'es' ? 'Viaje Compartido' : language === 'fr' ? 'Covoiturage' : language === 'ar' ? 'تشارُك الركوب' : language === 'pt' ? 'Carona Compartilhada' : language === 'zh' ? '网约车' : language === 'de' ? 'Fahrgemeinschaft' : result.label) :
                   (language === 'es' ? 'Conducir y Estacionar' : language === 'fr' ? 'Conduire & Stationner' : language === 'ar' ? 'قيادة وموقف' : language === 'pt' ? 'Dirigir e Estacionar' : language === 'zh' ? '自驾泊车' : language === 'de' ? 'Fahren & Parken' : result.label)}
                </h2>
                {result.fallback_mode && (
                  <span className="badge-deterministic">{t('offline')}</span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-surface-700 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-brand-900">{result.carbon_g}g</p>
                  <p className="text-xs text-brand-400">CO₂</p>
                </div>
                <div className="bg-surface-700 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-brand-900">{result.eta_min}min</p>
                  <p className="text-xs text-brand-400">ETA</p>
                </div>
                <div className="bg-surface-700 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-brand-900">${result.cost_usd.toFixed(2)}</p>
                  <p className="text-xs text-brand-400">{t('est_cost')}</p>
                </div>
              </div>

              {/* AI summary */}
              {result.summary_text && (
                <div className="bg-brand-900/40 border border-brand-700/30 rounded-lg p-3">
                  <p className="text-sm text-brand-200 italic">"{result.summary_text}"</p>
                </div>
              )}

              {/* Carbon comparison bars */}
              <div>
                <p className="text-xs font-semibold text-brand-400 uppercase tracking-wider mb-3">
                  {language === 'es' ? 'Comparación de carbono (g CO₂)' : language === 'fr' ? 'Comparaison carbone (g CO₂)' : language === 'ar' ? 'مقارنة الكربون (جم ثاني أكسيد الكربون)' : language === 'pt' ? 'Comparação de carbono (g CO₂)' : language === 'zh' ? '碳足迹对比 (克二氧化碳)' : language === 'de' ? 'CO2-Vergleich (g CO₂)' : 'Carbon comparison (g CO₂)'}
                </p>
                <div className="flex flex-col gap-2.5" role="list" aria-label="Carbon emissions by mode">
                  {result.all_modes.map((m) => {
                    const modeInfo = TRANSPORT_MODES.find((t) => t.mode === m.mode)
                    const translatedLabel = m.mode === 'transit' ? (language === 'es' ? 'Tren / Metro' : language === 'fr' ? 'Train / Métro' : language === 'ar' ? 'قطار / مترو' : language === 'pt' ? 'Trem / Metrô' : language === 'zh' ? '火车 / 地铁' : language === 'de' ? 'Bahn / U-Bahn' : m.label) :
                      m.mode === 'walk' ? (language === 'es' ? 'Caminar / Bicicleta' : language === 'fr' ? 'Marcher / Vélo' : language === 'ar' ? 'مشي / دراجة' : language === 'pt' ? 'Caminhar / Bicicleta' : language === 'zh' ? '步行 / 自行车' : language === 'de' ? 'Gehen / Radfahren' : m.label) :
                      m.mode === 'rideshare' ? (language === 'es' ? 'Viaje Compartido' : language === 'fr' ? 'Covoiturage' : language === 'ar' ? 'تشارُك الركوب' : language === 'pt' ? 'Carona Compartilhada' : language === 'zh' ? '网约车' : language === 'de' ? 'Fahrgemeinschaft' : m.label) :
                      (language === 'es' ? 'Conducir / Parq.' : language === 'fr' ? 'Conduire / Station.' : language === 'ar' ? 'قيادة / موقف' : language === 'pt' ? 'Dirigir / Estac.' : language === 'zh' ? '自驾泊车' : language === 'de' ? 'Fahren / Parken' : m.label);
                    return (
                      <div key={m.mode} className="flex items-center gap-3" role="listitem">
                        <span className="text-sm w-24 shrink-0 text-brand-300 text-right">{translatedLabel}</span>
                        <CarbonBar value={m.carbon_g} max={MAX_CARBON} color={modeInfo?.color ?? '#7aa7ff'} />
                        <span className="text-xs text-brand-400 w-16 shrink-0">{m.carbon_g}g</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>
          )}

          {!result && !loading && (
            <div className="glass-card p-8 flex items-center justify-center text-brand-500 text-sm">
              {language === 'es' ? 'Seleccione un modo de transporte para ver la comparación de carbono y ETA' :
               language === 'fr' ? 'Seleccione un mode de transport pour voir la comparaison de carbone et d\'ETA' :
               language === 'ar' ? 'اختر وسيلة نقل لعرض مقارنة الكربون والوقت المتوقع للوصول' :
               language === 'pt' ? 'Selecione um modo de transporte para ver a comparação de carbono e ETA' :
               language === 'zh' ? '请选择一种出行方式以查看碳足迹及预计到达时间对比' :
               language === 'de' ? 'Wählen Sie ein Transportmittel aus, um den CO2- und ETA-Vergleich anzuzeigen' :
               'Select a transport mode to see carbon and ETA comparison'}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
