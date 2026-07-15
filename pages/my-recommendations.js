import { useEffect, useState } from 'react'
import { fetchWithAuth } from '../lib/auth'

// Same backend used by recommendations.js -- kept as a local constant here
// since this page doesn't currently share that admin page's config object.
const API_BASE = 'http://127.0.0.1:8000/api'

// Course display names now live on the backend (feature_metadata.json) as
// the single source of truth -- fetched once below, instead of this page
// keeping its own separate hardcoded copy that could drift out of sync.
function courseName(code, metadata) {
  return metadata?.[code]?.display_name || code
}

// Normalizes one resource_hints entry -- older saved records may have a
// plain string (pre-link format), newer ones are {label, url}. `url` is
// always either null or a real, human-verified link that an admin typed
// into feature_metadata.json -- never something Claude generated.
function normalizeHint(hint) {
  if (typeof hint === 'string') return { label: hint, url: null }
  if (hint && hint.label) return { label: hint.label, url: hint.url ?? null }
  return null
}

const MyRecommendations = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [recommendation, setRecommendation] = useState(null)
  const [featureMetadata, setFeatureMetadata] = useState({})

  useEffect(() => {
    async function loadRecommendation() {
      setLoading(true)
      setError('')

      try {
        const [res, metadataRes] = await Promise.all([
          fetchWithAuth('/recommendations/my'),
          fetch(`${API_BASE}/feature_metadata`),
        ])

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.detail || 'Failed to load recommendation')
        }

        // Non-fatal if this fails -- courseName() falls back to the raw
        // feature code and resource links just render as plain text, so a
        // metadata outage degrades gracefully instead of blocking the page.
        const metadata = metadataRes.ok ? await metadataRes.json() : {}

        setRecommendation(data.recommendation)
        setFeatureMetadata(metadata)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadRecommendation()
  }, [])

  if (loading) {
    return <div className="text-slate-500">Loading your recommendation...</div>
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
        {error}
      </div>
    )
  }

  if (!recommendation) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h1 className="text-2xl font-bold text-slate-900">
          My Recommendations
        </h1>
        <p className="text-slate-500 mt-2">
          No approved recommendation is available yet.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <p className="text-sm font-semibold text-green-600 mb-2">
          Approved Recommendation
        </p>

        <h1 className="text-2xl font-bold text-slate-900">
          My Recommendation
        </h1>

        <p className="text-slate-600 whitespace-pre-line mt-4 leading-relaxed">
          {recommendation.text}
        </p>
      </div>

      {recommendation.top_factors?.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900">
            Focus Areas
          </h2>

          <p className="text-slate-500 mt-1 text-sm">
            These are the course areas connected to your recommendation.
          </p>

          <div className="mt-4 space-y-3">
            {recommendation.top_factors.map((factor, index) => (
              <div
                key={index}
                className="flex items-center justify-between border border-slate-100 rounded-xl px-4 py-3"
              >
                <span className="font-medium text-slate-700">
                  {courseName(factor.feature, featureMetadata)}
                </span>

                <span className="text-sm text-slate-500">
                  {factor.direction}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {recommendation.decision_support?.recommended_actions?.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900">
            Resources
          </h2>

          <p className="text-slate-500 mt-1 text-sm">
            A few places to start -- click through if a link is available,
            or ask your instructor for more on the ones that aren't linked
            yet.
          </p>

          {/*
            Intentionally shows ONLY label + a real, human-verified link
            here -- never the score, cohort average, or contribution
            percentages from decision_support.primary_concern /
            contributing_factors. Those numbers are for admin review only;
            a student shouldn't be shown "you scored 15.8 points below
            average" directly.
          */}
          <ul className="mt-4 space-y-2">
            {recommendation.decision_support.recommended_actions
              .map(normalizeHint)
              .filter(Boolean)
              .map((action) => (
                <li
                  key={action.label}
                  className="border border-slate-100 rounded-xl px-4 py-3"
                >
                  {action.url ? (
                    <a
                      href={action.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {action.label}
                    </a>
                  ) : (
                    <span className="text-slate-700 font-medium">{action.label}</span>
                  )}
                </li>
              ))}
          </ul>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6">
        <h2 className="text-xl font-bold text-blue-900">
          Need Help?
        </h2>

        <p className="text-slate-600 mt-2">
          Reach out to your instructor or academic advisor if you want help planning your next steps.
        </p>
      </div>
    </div>
  )
}

export default MyRecommendations