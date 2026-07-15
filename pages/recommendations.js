import Head from 'next/head'
import { useState, useEffect } from 'react'
import {
  RiRobot2Line,
  RiTimeLine,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiQuestionLine,
  RiEditLine,
} from 'react-icons/ri'
import { fetchWithAuth } from '../lib/auth'

const DEPLOYMENT = {
  apiBase: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000/api',
  projectName: 'nursing_risk_v1',
  cohortName: 's5_master_dataset',
  subjectLabel: 'student',
  subjectLabelPlural: 'students',
  subjectIdLabel: 'Student ID',
}

function normalizeId(id) {
  const text = String(id).trim()
  return text.endsWith('.0') ? text.slice(0, -2) : text
}

// Course display names and resource hints now live on the backend
// (Backend/ml_generic/feature_metadata.json) as the single source of
// truth, fetched once on load into `featureMetadata` state below --
// this file no longer keeps its own separate COURSE_NAMES/RESOURCE_HINTS
// copies that could drift out of sync with what the backend uses.
function courseName(code, metadata) {
  return metadata?.[code]?.display_name || code
}

// Normalizes a single feature_metadata.json resource_hints entry -- old
// entries are a plain string, new entries are {label, url}. url is a
// human-verified link or null (never AI-generated), so Claude never sees
// or invents it -- only the admin's Decision Support card renders it.
function normalizeHint(hint) {
  if (typeof hint === 'string') return { label: hint, url: null }
  if (hint && hint.label) return { label: hint.label, url: hint.url ?? null }
  return null
}

function resourceHintObjects(code, metadata) {
  const raw =
    metadata?.[code]?.resource_hints || [
      { label: "your course's LMS materials", url: null },
      { label: 'office hours with your instructor', url: null },
    ]
  return raw.map(normalizeHint).filter(Boolean)
}

// Label-only view -- used anywhere the resource is being woven into
// freeform text (the student message / its local JS mirror), where a raw
// URL should never be embedded since neither Claude nor this string-join
// logic can guarantee it renders as a safe, clickable, unmangled link.
function resourceHintLabels(code, metadata) {
  return resourceHintObjects(code, metadata).map((h) => h.label)
}

function formatId(id) {
  return normalizeId(id)
}

function priorityTier(probability) {
  if (probability >= 0.6) return { label: 'High priority', className: 'bg-red-100 text-red-700' }
  if (probability >= 0.4) return { label: 'Medium priority', className: 'bg-orange-100 text-orange-700' }
  return { label: 'Low priority', className: 'bg-yellow-100 text-yellow-700' }
}

function buildFactualBasis(topFactors, metadata) {
  if (!topFactors || topFactors.length === 0) {
    return 'No specific contributing factor could be identified from the available data.'
  }

  const top = topFactors[0]
  const gap = Math.abs(top.value - top.cohort_average).toFixed(1)

  return `Based on: ${courseName(top.feature, metadata)} score ${top.value}, ${gap} points ${top.direction} (cohort average ${top.cohort_average}).`
}

// Mirrors admin_router.py's _build_decision_support exactly, so the
// admin-facing card looks the same whether it's the initial fallback
// (right after predict_cohort, before "Polish with AI" is clicked) or
// the backend-computed version returned later by /polish_recommendations.
// Every number here comes straight from top_contributing_factors -- this
// function does not call Claude and does not invent anything.
function buildDecisionSupport(topFactors, metadata) {
  if (!topFactors || topFactors.length === 0) {
    return {
      primary_concern: null,
      contributing_factors: [],
      recommended_actions: [],
      expected_outcome: null,
    }
  }

  const primary = topFactors[0]
  const positive = topFactors.filter((f) => (f.contribution ?? 0) > 0)
  const total = positive.reduce((sum, f) => sum + f.contribution, 0) || 1

  const contributing_factors = positive.map((f) => ({
    feature: f.feature,
    display_name: courseName(f.feature, metadata),
    value: f.value,
    cohort_average: f.cohort_average,
    direction: f.direction,
    weight_pct: Math.round(((100 * f.contribution) / total) * 10) / 10,
  }))

  const gap = Math.round(Math.abs(primary.value - primary.cohort_average) * 10) / 10
  const primaryDisplay = courseName(primary.feature, metadata)

  const seen = new Set()
  const actions = []
  topFactors.forEach((f) => {
    if ((f.contribution ?? 0) <= 0) return
    resourceHintObjects(f.feature, metadata).forEach((hint) => {
      if (!seen.has(hint.label)) {
        seen.add(hint.label)
        actions.push(hint)
      }
    })
  })

  return {
    primary_concern: {
      feature: primary.feature,
      display_name: primaryDisplay,
      value: primary.value,
      cohort_average: primary.cohort_average,
      gap,
      direction: primary.direction,
    },
    contributing_factors,
    recommended_actions: actions.slice(0, 4),
    expected_outcome: `Strengthen understanding in ${primaryDisplay} and reduce predicted risk before the next assessment.`,
  }
}

function gapQualifier(top) {
  const gap = Math.abs(top.value - top.cohort_average)
  if (gap >= 12) return 'noticeably'
  if (gap >= 6) return 'somewhat'
  return 'a little'
}

function buildStudentText(topFactors, metadata) {
  if (!topFactors || topFactors.length === 0) {
    return "Your advisor would like to check in with you about your recent coursework."
  }

  const top = topFactors[0]
  const qualifier = gapQualifier(top)
  const others = topFactors.slice(1)
  const directionPhrase =
    top.direction === 'below average'
      ? 'below where we typically see it at this point'
      : 'different from what we typically see at this point'

  let intro = `We wanted to check in because your progress in ${courseName(top.feature, metadata)} has been ${qualifier} ${directionPhrase}. This is the main reason you're seeing this message.`

  if (others.length === 1) {
    intro += ` ${courseName(others[0].feature, metadata)} came up as a secondary factor too.`
  } else if (others.length >= 2) {
    intro += ` ${courseName(others[0].feature, metadata)} and ${courseName(others[1].feature, metadata)} came up as secondary factors too.`
  }

  const allCourses = [top, ...others].map((f) => f.feature)
  const seen = new Set()
  const resourceLines = []

  allCourses.forEach((code) => {
    resourceHintLabels(code, metadata).forEach((hint) => {
      const key = hint.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        resourceLines.push(hint)
      }
    })
  })

  const bulletList = resourceLines.slice(0, 4).map((h) => `• ${h}`).join('\n')
  const closing =
    "We'd also encourage you to reach out to your instructor or academic advisor directly -- they can point you to what's specifically available in your program."

  return `${intro}\n\nA few things that might help:\n${bulletList}\n\n${closing}`
}

function HelpTip({ title, lines, align = 'left' }) {
  const [visible, setVisible] = useState(false)

  return (
    <span
      className="relative inline-block ml-1.5 align-middle"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-500 inline-flex items-center justify-center cursor-help">
        <RiQuestionLine className="text-[10px]" />
      </span>

      {visible && (
        <div
          className={`absolute z-20 top-6 w-80 bg-slate-800 text-white text-xs rounded-lg p-3 shadow-xl leading-relaxed ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <p className="text-white">{title}</p>
          {lines.map((line, i) => (
            <p key={i} className="text-slate-300 mt-1">
              {line}
            </p>
          ))}
        </div>
      )}
    </span>
  )
}

// Admin-facing evidence panel: Primary Concern / Contributing Factors /
// Recommended Actions / Expected Outcome. Every value rendered here comes
// from `decisionSupport`, which is either backend-computed (after "Polish
// with AI", from admin_router.py's _build_decision_support) or the local
// JS mirror of that same logic (buildDecisionSupport above) -- Claude
// never generates any of these numbers or labels.
function DecisionSupportCard({ decisionSupport }) {
  if (!decisionSupport || !decisionSupport.primary_concern) {
    return (
      <p className="text-xs text-slate-400 mt-2 italic">
        No specific contributing factor could be identified from the available data.
      </p>
    )
  }

  const { primary_concern, contributing_factors, recommended_actions, expected_outcome } =
    decisionSupport

  return (
    <div className="mt-3 border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50/50">
      <div className="p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
          Primary Concern
        </p>
        <p className="text-sm text-slate-800">
          {primary_concern.display_name} — Score {primary_concern.value},{' '}
          {primary_concern.gap} points {primary_concern.direction} (cohort average{' '}
          {primary_concern.cohort_average})
        </p>
      </div>

      {contributing_factors.length > 0 && (
        <div className="p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
            Contributing Factors
          </p>
          <ul className="text-sm text-slate-700 space-y-0.5">
            {contributing_factors.map((f) => (
              <li key={f.feature}>
                • {f.display_name}: {f.weight_pct}%
              </li>
            ))}
          </ul>
        </div>
      )}

      {recommended_actions.length > 0 && (
        <div className="p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
            Recommended Actions
          </p>
          <ul className="text-sm text-slate-700 space-y-0.5">
            {recommended_actions.map((action) => {
              // Back-compat: older saved records may still have plain
              // strings here instead of {label, url} objects.
              const label = typeof action === 'string' ? action : action.label
              const url = typeof action === 'string' ? null : action.url

              return (
                <li key={label}>
                  •{' '}
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {label}
                    </a>
                  ) : (
                    label
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {expected_outcome && (
        <div className="p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
            Expected Outcome
          </p>
          <p className="text-sm text-slate-700">{expected_outcome}</p>
        </div>
      )}
    </div>
  )
}

export default function Recommendations() {
  const [recommendations, setRecommendations] = useState([])
  const [decisions, setDecisions] = useState({})
  const [editedTexts, setEditedTexts] = useState({})
  const [aiPolishedIds, setAiPolishedIds] = useState({})
  const [featureMetadata, setFeatureMetadata] = useState({})
  const [decisionSupports, setDecisionSupports] = useState({})
  const [polishCounts, setPolishCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState('')

  const [polishing, setPolishing] = useState(false)
  const [polishError, setPolishError] = useState('')

  const [selected, setSelected] = useState({})

  const displayText = (item) => editedTexts[item.id] ?? item.text

  const saveDraftToBackend = async (item, overrides = {}) => {
    const text = overrides.text ?? displayText(item)
    const isAiPolished = overrides.is_ai_polished ?? !!aiPolishedIds[item.id]
    const isManuallyEdited = overrides.is_manually_edited ?? !!editedTexts[item.id]
    const decisionSupport = overrides.decision_support ?? decisionSupports[item.id] ?? null
    const polishCount = overrides.polish_count ?? polishCounts[item.id] ?? null

    const res = await fetchWithAuth('/recommendations/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject_id: item.id,
        probability: item.probability,
        text,
        factual_basis: item.factualBasis,
        top_factors: item.topFactors,
        decision_support: decisionSupport,
        polish_count: polishCount,
        is_ai_polished: isAiPolished,
        is_manually_edited: isManuallyEdited,
      }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || 'Failed to save draft')
    return data
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')

      try {
        const [predictionRes, savedRes, metadataRes] = await Promise.all([
          fetch(
            `${DEPLOYMENT.apiBase}/projects/${DEPLOYMENT.projectName}/predict_cohort/${DEPLOYMENT.cohortName}`,
            { method: 'POST' }
          ),
          fetchWithAuth('/recommendations'),
          fetch(`${DEPLOYMENT.apiBase}/feature_metadata`),
        ])

        const predictionData = await predictionRes.json()
        if (!predictionRes.ok) {
          throw new Error(predictionData.detail || 'Failed to load predictions')
        }

        const savedData = await savedRes.json()
        if (!savedRes.ok) {
          throw new Error(savedData.detail || 'Failed to load saved recommendations')
        }

        // Non-fatal if this fails -- courseName()/resourceHintLabels()/
        // resourceHintObjects() fall
        // back to raw feature codes / generic hints when metadata is
        // empty, so a metadata outage degrades gracefully instead of
        // blocking the whole page.
        const metadata = metadataRes.ok ? await metadataRes.json() : {}

        const savedItems = savedData.items || {}

        const nextDecisions = {}
        const nextEditedTexts = {}
        const nextAiPolishedIds = {}
        const nextDecisionSupports = {}
        const nextPolishCounts = {}

        const flagged = predictionData.results
          .filter((r) => r.status === 'ok' && r.flagged_for_review === true)
          .map((r) => {
            const id = normalizeId(r.subject_id)
            const saved = savedItems[id]

            const baseText = buildStudentText(r.top_contributing_factors, metadata)
            const text = saved?.text || baseText

            if (saved?.status && saved.status !== 'pending') {
              nextDecisions[id] = saved.status
            }

            if (saved?.text && saved.text !== baseText) {
              nextEditedTexts[id] = saved.text
            }

            if (saved?.is_ai_polished) {
              nextAiPolishedIds[id] = true
            }

            nextPolishCounts[id] = saved?.polish_count || 0

            // Prefer the persisted decision_support (set once "Polish
            // with AI" ran and was saved) -- fall back to the local
            // mirror built straight from top_contributing_factors so the
            // card still shows real numbers even before any AI polish.
            nextDecisionSupports[id] =
              saved?.decision_support || buildDecisionSupport(r.top_contributing_factors, metadata)

            return {
              id,
              probability: r.probability_high_risk,
              topFactors: r.top_contributing_factors || [],
              text,
              factualBasis: buildFactualBasis(r.top_contributing_factors, metadata),
            }
          })
          .sort((a, b) => b.probability - a.probability)

        setRecommendations(flagged)
        setDecisions(nextDecisions)
        setEditedTexts(nextEditedTexts)
        setAiPolishedIds(nextAiPolishedIds)
        setFeatureMetadata(metadata)
        setDecisionSupports(nextDecisionSupports)
        setPolishCounts(nextPolishCounts)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const startEdit = (item) => {
    setEditingId(item.id)
    setEditDraft(displayText(item))
  }

  const saveEdit = async (item) => {
    try {
      await saveDraftToBackend(item, {
        text: editDraft,
        is_manually_edited: true,
        is_ai_polished: false,
      })

      setEditedTexts((prev) => ({ ...prev, [item.id]: editDraft }))
      setAiPolishedIds((prev) => {
        const next = { ...prev }
        delete next[item.id]
        return next
      })
      setEditingId(null)
    } catch (err) {
      alert(err.message)
    }
  }

  const cancelEdit = () => setEditingId(null)

  const decide = async (id, decision) => {
    const item = recommendations.find((r) => r.id === id)
    if (!item) return

    const endpoint =
      decision === 'approved'
        ? '/recommendations/approve'
        : '/recommendations/reject'

    try {
      const res = await fetchWithAuth(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject_id: item.id,
          probability: item.probability,
          text: displayText(item),
          factual_basis: item.factualBasis,
          top_factors: item.topFactors,
          decision_support: decisionSupports[item.id] || null,
          polish_count: polishCounts[item.id] || null,
          is_ai_polished: !!aiPolishedIds[item.id],
          is_manually_edited: !!editedTexts[item.id],
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        alert(data.detail || `Failed to ${decision} recommendation`)
        return
      }

      setDecisions((prev) => ({ ...prev, [id]: decision }))
      setSelected((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    } catch (err) {
      alert(err.message)
    }
  }

  const reopenItem = async (id) => {
    try {
      const res = await fetchWithAuth('/recommendations/reopen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject_id: id }),
      })

      const data = await res.json()
      if (!res.ok) {
        alert(data.detail || 'Failed to reopen recommendation')
        return
      }

      setDecisions((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    } catch (err) {
      alert(err.message)
    }
  }

  const polishWithAI = async () => {
    setPolishing(true)
    setPolishError('')

    try {
      const targets = recommendations.filter((item) => !decisions[item.id])

      const res = await fetch(`${DEPLOYMENT.apiBase}/polish_recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject_label: DEPLOYMENT.subjectLabel,
          // Send raw feature codes (CT1/OB/Comm/Men) and no resource_hints
          // -- the backend now resolves display names and per-factor
          // resource hints itself from feature_metadata.json, so this
          // page doesn't need its own copy of that mapping anymore.
          items: targets.map((item) => ({
            subject_id: item.id,
            factors: item.topFactors,
          })),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'AI polishing failed')

      // Match Claude's response back to the request by subject_id, not by
      // array position. The prompt asks for "same order", but that's a
      // soft instruction -- if the model ever skips, duplicates, or
      // reorders an entry, positional (data.items[i]) matching silently
      // shifts every subsequent student's text/decision_support onto the
      // wrong record. Keying by subject_id is safe even if order drifts.
      const entryBySubjectId = {}
      ;(data.items || []).forEach((entry) => {
        if (entry && entry.subject_id != null) {
          entryBySubjectId[normalizeId(entry.subject_id)] = entry
        }
      })

      const nextTexts = { ...editedTexts }
      const nextFlags = { ...aiPolishedIds }
      const nextDecisionSupports = { ...decisionSupports }
      const nextPolishCounts = { ...polishCounts }

      for (const item of targets) {
        const entry = entryBySubjectId[item.id]
        if (!entry) continue // no matching response for this subject -- skip rather than guess

        if (entry.text) {
          nextTexts[item.id] = entry.text
          nextFlags[item.id] = true
          nextPolishCounts[item.id] = (polishCounts[item.id] || 0) + 1

          // entry.decision_support is the backend-computed evidence panel
          // (admin_router.py's _build_decision_support) -- prefer it over
          // the local JS mirror since it's the authoritative version.
          if (entry.decision_support) {
            nextDecisionSupports[item.id] = entry.decision_support
          }

          await saveDraftToBackend(item, {
            text: entry.text,
            decision_support: entry.decision_support || decisionSupports[item.id] || null,
            polish_count: nextPolishCounts[item.id],
            is_ai_polished: true,
            is_manually_edited: false,
          })
        }
      }

      setEditedTexts(nextTexts)
      setAiPolishedIds(nextFlags)
      setDecisionSupports(nextDecisionSupports)
      setPolishCounts(nextPolishCounts)
    } catch (err) {
      setPolishError(err.message)
    } finally {
      setPolishing(false)
    }
  }

  const toggleSelect = (id) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const pendingItems = recommendations.filter((item) => !decisions[item.id])
  const allPendingSelected =
    pendingItems.length > 0 && pendingItems.every((item) => selected[item.id])

  const toggleSelectAll = () => {
    if (allPendingSelected) {
      setSelected({})
    } else {
      const next = {}
      pendingItems.forEach((item) => {
        next[item.id] = true
      })
      setSelected(next)
    }
  }

  const selectedCount = Object.values(selected).filter(Boolean).length

  const approveSelected = async () => {
    const ids = Object.keys(selected).filter((id) => selected[id])

    for (const id of ids) {
      await decide(id, 'approved')
    }

    setSelected({})
  }

  const approvedCount = Object.values(decisions).filter((d) => d === 'approved').length
  const rejectedCount = Object.values(decisions).filter((d) => d === 'rejected').length
  const pendingCount = recommendations.length - approvedCount - rejectedCount

  return (
    <div className="grow">
      <Head>
        <title>Recommendations | AACN AI</title>
      </Head>

      <main className="h-full grow flex flex-col gap-6 overflow-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
              <RiRobot2Line className="text-2xl text-blue-600" />
            </div>
            <p className="text-slate-500">Generated Suggestions</p>
            <h2 className="text-3xl font-bold text-slate-900">
              {recommendations.length}
            </h2>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
            <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center mb-3">
              <RiTimeLine className="text-2xl text-orange-500" />
            </div>
            <p className="text-slate-500">Pending Review</p>
            <h2 className="text-3xl font-bold text-orange-500">{pendingCount}</h2>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
            <div className="w-11 h-11 rounded-xl bg-green-50 flex items-center justify-center mb-3">
              <RiCheckboxCircleLine className="text-2xl text-green-500" />
            </div>
            <p className="text-slate-500">Approved</p>
            <h2 className="text-3xl font-bold text-green-500">{approvedCount}</h2>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
            <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
              <RiCloseCircleLine className="text-2xl text-slate-500" />
            </div>
            <p className="text-slate-500">Rejected</p>
            <h2 className="text-3xl font-bold text-slate-500">{rejectedCount}</h2>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold text-slate-900">Suggested Actions</h2>

            <button
              onClick={polishWithAI}
              disabled={polishing || pendingItems.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 transition disabled:opacity-40"
            >
              {polishing ? 'Polishing...' : `Polish with AI (${pendingItems.length})`}
              <HelpTip
                align="right"
                title="What this does and doesn't do"
                lines={[
                  `Rewrites the ${DEPLOYMENT.subjectLabel}-facing wording only -- the underlying factor is unchanged.`,
                  'Polished text still needs Approve/Reject review.',
                ]}
              />
            </button>
          </div>

          {polishError && (
            <p className="text-sm text-red-600 mb-2">{polishError}</p>
          )}

          <p className="text-sm text-slate-500 mb-6 flex items-center">
            The message shown below each {DEPLOYMENT.subjectLabel} is what would be sent to them once approved.
          </p>

          {loading && (
            <div className="text-center text-slate-500 py-8">Loading...</div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
              {error}
            </div>
          )}

          {!loading && !error && pendingItems.length > 0 && (
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-4">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={allPendingSelected}
                  onChange={toggleSelectAll}
                  className="w-4 h-4"
                />
                Select all pending ({pendingItems.length})
              </label>

              <button
                onClick={approveSelected}
                disabled={selectedCount === 0}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-40 disabled:bg-slate-400"
              >
                Approve selected ({selectedCount})
              </button>
            </div>
          )}

          <div className="space-y-4">
            {recommendations.map((item) => {
              const tier = priorityTier(item.probability)
              const decision = decisions[item.id]
              const isEditing = editingId === item.id

              return (
                <div
                  key={item.id}
                  className="border border-slate-200 rounded-2xl p-5 hover:bg-slate-50 transition"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    {!decision && (
                      <input
                        type="checkbox"
                        checked={!!selected[item.id]}
                        onChange={() => toggleSelect(item.id)}
                        className="w-4 h-4 mt-1 shrink-0"
                      />
                    )}

                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg font-semibold shrink-0">
                      {DEPLOYMENT.subjectIdLabel[0]}
                    </div>

                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className="text-lg font-bold text-slate-900">
                          {formatId(item.id)}
                        </h3>

                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${tier.className}`}>
                          {tier.label}
                        </span>

                        <span className="text-sm text-slate-500">
                          {(item.probability * 100).toFixed(1)}%
                        </span>
                      </div>

                      <p className="text-xs text-slate-400 mb-1.5">
                        Student-facing message:
                      </p>

                      {isEditing ? (
                        <div>
                          <textarea
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            rows={5}
                            className="w-full border border-slate-300 rounded-lg p-2 text-sm text-slate-700"
                          />

                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => saveEdit(item)}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                            >
                              Save
                            </button>

                            <button
                              onClick={cancelEdit}
                              className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-100"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2">
                          <p className="text-slate-600 whitespace-pre-line">
                            {displayText(item)}
                          </p>

                          {!decision && (
                            <button
                              onClick={() => startEdit(item)}
                              className="text-slate-400 hover:text-blue-600 shrink-0"
                            >
                              <RiEditLine />
                            </button>
                          )}
                        </div>
                      )}

                      <DecisionSupportCard decisionSupport={decisionSupports[item.id]} />

                      <div className="flex flex-wrap gap-2 mt-4">
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-semibold ${
                            decision === 'approved'
                              ? 'bg-green-100 text-green-600'
                              : decision === 'rejected'
                                ? 'bg-slate-200 text-slate-600'
                                : 'bg-orange-100 text-orange-600'
                          }`}
                        >
                          {decision === 'approved'
                            ? 'Approved'
                            : decision === 'rejected'
                              ? 'Rejected'
                              : 'Pending Review'}
                        </span>

                        {editedTexts[item.id] && (
                          <span className="px-3 py-1 rounded-full text-sm font-semibold bg-blue-50 text-blue-600">
                            {aiPolishedIds[item.id]
                              ? `AI-polished wording${
                                  polishCounts[item.id] ? ` (v${polishCounts[item.id]})` : ''
                                }`
                              : 'Manually edited'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex lg:flex-col gap-2">
                      <button
                        onClick={() => decide(item.id, 'approved')}
                        className={`px-4 py-2 rounded-xl font-medium transition ${
                          decision === 'approved'
                            ? 'bg-green-600 text-white'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        Approve
                      </button>

                      <button
                        onClick={() => decide(item.id, 'rejected')}
                        className={`px-4 py-2 rounded-xl font-medium border transition ${
                          decision === 'rejected'
                            ? 'bg-slate-600 text-white border-slate-600'
                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        Reject
                      </button>

                      {decision && (
                        <button
                          onClick={() => reopenItem(item.id)}
                          className="px-4 py-2 rounded-xl font-medium border border-slate-300 text-slate-500 hover:bg-slate-50 transition text-sm"
                        >
                          Reopen for Review
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}