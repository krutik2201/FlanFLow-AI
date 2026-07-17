import { useState } from 'react'
import { api, TriageResult } from '../api/client'
import { useAI } from '../context/AIContext'

const SAMPLE_TRANSCRIPTS = [
  "Medical emergency: Fan collapsed in Section 106 and seems unresponsive.",
  "Security alert: Altercation breaking out between two groups near Gate C.",
  "Facilities issue: Water leak reported in Restrooms (North), floor is flooding.",
  "Lost person: A 6-year-old child wearing a yellow cap has been found alone near Concourse East.",
  "Crowd density at Gate A is extremely high, queue times are now over 15 minutes."
]

const SAMPLE_QUESTIONS = [
  "What is the lost child protocol?",
  "Where are AEDs located in the venue?",
  "What time does Gate D2 open?",
  "Are laser pointers allowed inside the stadium?"
]

export default function StaffOperations() {
  const { aiOffline } = useAI()

  // Incident Triage State
  const [transcript, setTranscript] = useState('')
  const [triageLoading, setTriageLoading] = useState(false)
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null)
  const [triageError, setTriageError] = useState<string | null>(null)

  // Copilot State
  const [question, setQuestion] = useState('')
  const [copilotLoading, setCopilotLoading] = useState(false)
  const [copilotAnswer, setCopilotAnswer] = useState<string | null>(null)
  const [copilotError, setCopilotError] = useState<string | null>(null)

  async function handleTriage(textToTriage: string) {
    if (!textToTriage.trim()) return
    setTriageLoading(true)
    setTriageError(null)
    try {
      const res = await api.triageIncident(textToTriage, aiOffline)
      setTriageResult(res)
    } catch (e: unknown) {
      const err = e as { message?: string }
      setTriageError(err?.message ?? 'Failed to parse incident. Please try again.')
      setTriageResult(null)
    } finally {
      setTriageLoading(false)
    }
  }

  async function handleCopilot(qText: string) {
    if (!qText.trim()) return
    setCopilotLoading(true)
    setCopilotError(null)
    try {
      const res = await api.staffCopilot(qText, aiOffline)
      setCopilotAnswer(res.answer)
    } catch (e: unknown) {
      const err = e as { message?: string }
      setCopilotError(err?.message ?? 'Failed to get answer. Please try again.')
      setCopilotAnswer(null)
    } finally {
      setCopilotLoading(false)
    }
  }

  // Safety escalation keywords check client-side for immediate UI safety net
  const hasEscalationKeywords = /cardiac|heart attack|unconscious|breathing|collapsed|seizure|bleeding|injury|injured|ambulance|cpr|aed|weapon|gun|knife|bomb|threat|fight|assault|violence|fire|smoke/i.test(question)

  return (
    <>
      <title>Staff Operations — FanFlow AI</title>
      <div className="animate-fade-in flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Staff Operations Copilot</h1>
          <p className="text-brand-400 text-sm">
            AI-assisted incident triage and policy Q&A for stadium volunteers and operations staff.
          </p>
        </div>

        {/* Global Warning Banner for client-side escalation warning */}
        {hasEscalationKeywords && (
          <div className="escalation-banner" role="alert">
            <h2 className="text-sm font-bold text-red-400 mb-1">⚠️ IMMEDIATE ACTION RECOMMENDED</h2>
            <p className="text-xs text-red-200">
              Your inquiry concerns a potential medical or security emergency. Please report this immediately to stadium operations via radio channel 3 or extension 911. Do not rely solely on the AI assistant.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Section 1: Incident Triage */}
          <section aria-labelledby="triage-heading" className="glass-card p-5 flex flex-col gap-4">
            <h2 id="triage-heading" className="text-lg font-semibold text-white flex items-center gap-2">
              📻 Incident Triage Classifier
            </h2>
            <p className="text-xs text-brand-400">
              Paste or type radio transmission transcripts. The system will categorize the incident, assess severity level, and outline recommended response steps.
            </p>

            <div className="flex flex-col gap-2">
              <label htmlFor="transcript-input" className="text-xs font-semibold text-brand-300 uppercase tracking-wider">
                Radio Transcript
              </label>
              <textarea
                id="transcript-input"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Type or paste transmission details here..."
                rows={4}
                className="w-full bg-surface-700 border border-brand-700/40 text-white rounded-lg p-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs text-brand-400 self-center mr-1">Examples:</span>
              {SAMPLE_TRANSCRIPTS.map((t, idx) => (
                <button
                  key={idx}
                  onClick={() => { setTranscript(t); handleTriage(t); }}
                  className="text-xs px-2.5 py-1 bg-surface-700 hover:bg-brand-600/30 text-brand-300 border border-brand-800 rounded-full transition-colors focus:outline-none"
                >
                  Example {idx + 1}
                </button>
              ))}
            </div>

            <button
              id="triage-btn"
              onClick={() => handleTriage(transcript)}
              disabled={triageLoading || !transcript.trim()}
              className="py-2.5 px-4 bg-brand-600 hover:bg-brand-500 disabled:bg-surface-600 disabled:text-brand-500 text-white font-semibold rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              {triageLoading ? 'Triaging...' : '⚡ Classify & Action'}
            </button>

            {triageError && (
              <div role="alert" className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-xs text-red-400">⚠️ {triageError}</p>
              </div>
            )}

            {triageResult && (
              <div className="bg-surface-800 border border-brand-900/50 rounded-xl p-4 flex flex-col gap-3 animate-slide-up" aria-live="polite">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Incident Assessment</h3>
                  {triageResult.fallback_mode && (
                    <span className="badge-deterministic">⚙️ Deterministic</span>
                  )}
                </div>

                <div className="flex gap-2 flex-wrap">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-brand-500 font-semibold uppercase">Category</span>
                    <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${
                      triageResult.category === 'Medical' ? 'chip-medical' :
                      triageResult.category === 'Security' ? 'chip-security' : 'bg-brand-900/40 text-brand-300 border-brand-800'
                    }`}>
                      {triageResult.category}
                    </span>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-brand-500 font-semibold uppercase">Severity</span>
                    <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${
                      triageResult.severity === 'Low' ? 'chip-low' :
                      triageResult.severity === 'Medium' ? 'chip-medium' : 'chip-high'
                    }`}>
                      {triageResult.severity}
                    </span>
                  </div>
                </div>

                {triageResult.escalation_required && (
                  <div className="p-3 bg-red-950/30 border border-red-800/50 rounded-lg flex items-start gap-2">
                    <span className="text-red-400 shrink-0">🚨</span>
                    <div>
                      <p className="text-xs font-bold text-red-300">Safety Escalation Active</p>
                      <p className="text-[11px] text-red-400">This incident matches emergency criteria. Stadium operations have been flagged immediately.</p>
                    </div>
                  </div>
                )}

                <div className="bg-surface-700/60 rounded-lg p-3">
                  <p className="text-xs font-semibold text-brand-400 mb-1">Recommended Action</p>
                  <p className="text-sm text-white leading-relaxed">{triageResult.recommended_action}</p>
                </div>
              </div>
            )}
          </section>

          {/* Section 2: Volunteer Copilot */}
          <section aria-labelledby="copilot-heading" className="glass-card p-5 flex flex-col gap-4">
            <h2 id="copilot-heading" className="text-lg font-semibold text-white flex items-center gap-2">
              📖 Venue Policy Copilot
            </h2>
            <p className="text-xs text-brand-400">
              Quickly ask questions about venue rules, location coordinates, parking guides, and event schedules.
            </p>

            <div className="flex flex-col gap-2">
              <label htmlFor="copilot-input" className="text-xs font-semibold text-brand-300 uppercase tracking-wider">
                Ask a question
              </label>
              <div className="flex gap-2">
                <input
                  id="copilot-input"
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g. Where is the first aid station located?"
                  className="flex-1 bg-surface-700 border border-brand-700/40 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                />
                <button
                  id="copilot-btn"
                  onClick={() => handleCopilot(question)}
                  disabled={copilotLoading || !question.trim()}
                  className="py-2 px-4 bg-brand-600 hover:bg-brand-500 disabled:bg-surface-600 disabled:text-brand-500 text-white font-semibold rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                >
                  Ask
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => { setQuestion(q); handleCopilot(q); }}
                  className="text-xs px-2.5 py-1 bg-surface-700 hover:bg-brand-600/30 text-brand-300 border border-brand-800 rounded-full transition-colors focus:outline-none"
                >
                  {q}
                </button>
              ))}
            </div>

            {copilotError && (
              <div role="alert" className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-xs text-red-400">⚠️ {copilotError}</p>
              </div>
            )}

            {copilotAnswer && (
              <div className="bg-surface-800 border border-brand-900/50 rounded-xl p-4 flex flex-col gap-2 animate-slide-up" aria-live="polite">
                <h3 className="text-xs font-semibold text-brand-400">Response</h3>
                <p className="text-sm text-white leading-relaxed">{copilotAnswer}</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  )
}
