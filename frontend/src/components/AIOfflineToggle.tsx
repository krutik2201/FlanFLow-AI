import { useAI, useTranslation } from '../context/AIContext'

export function AIOfflineToggle() {
  const { aiOffline, setAiOffline } = useAI()
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-2.5">
      <span className="text-xs font-medium text-brand-300 hidden sm:block select-none">
        {t('simulate_ai')}
      </span>
      <button
        id="ai-offline-toggle"
        role="switch"
        aria-checked={aiOffline}
        aria-label="Simulate AI offline — forces deterministic-only mode"
        onClick={() => setAiOffline(!aiOffline)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2
                    focus-visible:ring-offset-surface-900 cursor-pointer
                    ${aiOffline ? 'bg-gold-500' : 'bg-surface-500 border border-brand-700/50'}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md
                      transition-transform duration-200
                      ${aiOffline ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </button>
      {aiOffline && (
        <span className="text-xs font-bold text-amber-700 animate-pulse-slow hidden sm:block">
          ⚡ {t('offline')}
        </span>
      )}
    </div>
  )
}
