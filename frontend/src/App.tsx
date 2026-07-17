import { lazy, Suspense } from 'react'
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import { AIProvider, useTranslation } from './context/AIContext'
import { AIOfflineToggle } from './components/AIOfflineToggle'
import { LanguagePicker } from './components/LanguagePicker'
import { LiveTelemetryStrip } from './components/LiveTelemetryStrip'

// Lazy-loaded routes for code splitting (Lighthouse performance)
const Wayfinding = lazy(() => import('./pages/Wayfinding'))
const Accessibility = lazy(() => import('./pages/Accessibility'))
const SustainableTransport = lazy(() => import('./pages/SustainableTransport'))

const NAV_LINKS = [
  { to: '/',           key: 'wayfinding',    icon: '🗺️' },
  { to: '/accessible', key: 'accessibility', icon: '♿' },
  { to: '/transport',  key: 'transport',     icon: '🚇' },
]

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64" role="status" aria-label="Loading page">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full bg-brand-400 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  )
}

function AppLayout() {
  const { t } = useTranslation()

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-surface-900">

        {/* ── Top bar ──────────────────────────────────────────── */}
        <header className="bg-surface-800/90 backdrop-blur-sm border-b border-brand-900/60 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
            {/* Logo */}
            <NavLink to="/" className="flex items-center gap-2 shrink-0" aria-label="FanFlow AI home">
              <span className="text-2xl" aria-hidden="true">🏟️</span>
              <span className="font-black text-lg text-gradient tracking-tight">FanFlow AI</span>
            </NavLink>

            {/* Primary nav */}
            <nav className="hidden md:flex items-center gap-1 flex-1" aria-label="Main navigation">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                     ${isActive
                       ? 'bg-brand-100 text-brand-900 border border-brand-200/80 shadow-sm'
                       : 'text-brand-400 hover:text-brand-200 hover:bg-surface-700'
                     }`
                  }
                >
                  <span aria-hidden="true">{link.icon}</span>
                  {t(link.key)}
                </NavLink>
              ))}
            </nav>

            {/* Right controls */}
            <div className="flex items-center gap-3 ml-auto">
              <AIOfflineToggle />
              <div className="h-6 w-px bg-brand-800" aria-hidden="true" />
              <LanguagePicker />
            </div>
          </div>
        </header>

        {/* ── Telemetry strip ─────────────────────────────────── */}
        <LiveTelemetryStrip />

        {/* ── Mobile nav ──────────────────────────────────────── */}
        <nav
          className="md:hidden flex items-center gap-1 overflow-x-auto px-3 py-2
                     bg-surface-800 border-b border-brand-900/40"
          aria-label="Mobile navigation"
        >
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-colors
                 ${isActive
                   ? 'bg-brand-100 text-brand-900 border border-brand-200/50 shadow-sm'
                   : 'text-brand-400 hover:text-brand-200'
                 }`
              }
            >
              <span aria-hidden="true">{link.icon}</span>
              {t(link.key)}
            </NavLink>
          ))}
        </nav>

        {/* ── Page content ────────────────────────────────────── */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6" id="main-content">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/"           element={<Wayfinding />} />
              <Route path="/accessible" element={<Accessibility />} />
              <Route path="/transport"  element={<SustainableTransport />} />
            </Routes>
          </Suspense>
        </main>

        {/* ── Footer ──────────────────────────────────────────── */}
        <footer className="border-t border-brand-900/40 bg-surface-800/50 py-4 px-4 mt-auto">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-xs text-brand-500">
              © 2026 FanFlow AI — FIFA World Cup Stadium Platform
            </p>
            <p className="text-xs text-brand-600">
              🔒 {t('footer_text')}
            </p>
          </div>
        </footer>

      </div>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <AIProvider>
      <AppLayout />
    </AIProvider>
  )
}
