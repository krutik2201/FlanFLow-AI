import { useAI } from '../context/AIContext'

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
]

export function LanguagePicker() {
  const { language, setLanguage } = useAI()

  return (
    <div className="relative">
      <label htmlFor="language-select" className="sr-only">Select language</label>
      <select
        id="language-select"
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        className="appearance-none bg-surface-700 border border-brand-700/40 text-brand-200
                   rounded-lg px-3 py-1.5 text-sm font-medium cursor-pointer
                   hover:border-brand-500 transition-colors focus:outline-none focus-visible:ring-2
                   focus-visible:ring-brand-400"
        aria-label="Select navigation language"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.flag} {l.label}
          </option>
        ))}
      </select>
    </div>
  )
}
