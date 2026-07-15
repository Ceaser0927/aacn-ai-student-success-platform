import { useState, useEffect } from 'react'
import { RiQuestionLine } from 'react-icons/ri'

// --- Everything specific to THIS deployment lives here. ---
// To point this same page at a different project (e.g. a future hospital
// deployment), only this block needs to change -- nothing else in the
// file assumes "student" or "nursing" anywhere.
const DEPLOYMENT = {
  apiBase: 'http://127.0.0.1:8000/api',
  projectName: 'nursing_risk_v1',
  cohortName: 's5_master_dataset',
  subjectLabel: 'Student', // e.g. would be "Patient" for a hospital deployment
  subjectIdLabel: 'ID', // e.g. would be "Patient ID"
}

function formatId(id) {
  const num = Number(id)
  if (!Number.isNaN(num) && Number.isInteger(num)) return String(num)
  return id
}

// Ranks already-flagged students by the model's own probability score, to
// help order outreach. NOT a separately validated severity scale -- see
// the help tooltip on the "Priority" column header.
function priorityTier(probability) {
  if (probability >= 0.6) return { label: 'High priority', className: 'bg-red-100 text-red-700' }
  if (probability >= 0.4) return { label: 'Medium priority', className: 'bg-orange-100 text-orange-700' }
  return { label: 'Low priority', className: 'bg-yellow-100 text-yellow-700' }
}

// Hover-to-show, hover-out-to-hide tooltip. `align="right"` for columns
// near the right edge of the table so the popup doesn't run off-screen.
function HelpTip({ title, lines, align = 'left' }) {
  const [visible, setVisible] = useState(false)
  return (
    <span
      className="relative inline-block ml-1.5 align-middle"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <span
        className="w-4 h-4 rounded-full bg-slate-200 text-slate-500 inline-flex items-center justify-center cursor-help"
        aria-label="Help"
      >
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
            <p key={i} className="text-slate-300 mt-1">{line}</p>
          ))}
        </div>
      )}
    </span>
  )
}

// Short title + a couple of plain, scannable lines. Each line stays
// concrete (uses a real example) rather than abstract, since a vague
// short line can be just as unclear as a dense paragraph.
const columnHelp = {
  status: {
    title: 'Flagged for review, or not',
    lines: [
      'A yes/no decision from the model.',
      'Verified on real students the model never trained on -- not just a theory.',
    ],
  },
  priority: {
    title: 'Order among flagged students',
    lines: [
      'Sorts by the model\'s own score, to help you start somewhere.',
      'Caution: in our tests, the single highest-scored student turned out NOT to be a real case. High priority means "check this one first," not "this one is certain."',
    ],
  },
  probability: {
    title: 'How risky the model estimates this is',
    lines: [
      '0% = model sees no risk. 100% = model sees strong risk.',
      'Use it to guide attention, not as a final answer on its own.',
    ],
  },
  confidence: {
    title: 'How much course data we have',
    lines: [
      'Not the same as how sure the model is.',
      'Example: a student with only 1 course on file shows "Low confidence," even if a score was still produced.',
    ],
  },
  stage: {
    title: 'Which set of courses was used',
    lines: [
      'Example: "stage_3" means CT1, OB, Comm, and Men grades were used.',
      'Only stages proven reliable on test data are allowed to produce a real flag.',
    ],
  },
}

export default function Students() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadPredictions() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(
          `${DEPLOYMENT.apiBase}/projects/${DEPLOYMENT.projectName}/predict_cohort/${DEPLOYMENT.cohortName}`,
          { method: 'POST' }
        )
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || 'Failed to load predictions')

        const mapped = data.results.map((r) => ({
          id: r.subject_id,
          status: r.status,
          flagged: r.flagged_for_review === true,
          probability: r.probability_high_risk,
          confidence: r.confidence,
          stageUsed: r.stage_used,
        }))
        setStudents(mapped)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadPredictions()
  }, [])

  const riskLabel = (s) => {
    if (s.status !== 'ok') return 'Not scored'
    return s.flagged ? 'Flagged' : 'Not flagged'
  }
  const riskBadge = (s) => {
    if (s.status !== 'ok') return 'bg-slate-100 text-slate-500'
    return s.flagged ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
  }

  const filteredStudents = students.filter((s) => {
    const matchesSearch = formatId(s.id).toLowerCase().includes(search.toLowerCase())
    const matchesFilter =
      filter === 'All' ||
      (filter === 'Flagged' && s.status === 'ok' && s.flagged) ||
      (filter === 'Not flagged' && s.status === 'ok' && !s.flagged) ||
      (filter === 'Not scored' && s.status !== 'ok')
    return matchesSearch && matchesFilter
  })

  return (
    <div className="flex flex-col gap-6">
      {/* Search + filter */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          <input
            type="text"
            placeholder={`Search ${DEPLOYMENT.subjectIdLabel.toLowerCase()}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-slate-200 rounded-xl px-4 py-2 w-full md:w-80 outline-none"
          />
          <div className="flex gap-2">
            {['All', 'Flagged', 'Not flagged', 'Not scored'].map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={`px-4 py-2 rounded-xl border transition ${
                  filter === item
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center text-slate-500">
          Scoring students against the published model...
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-sm text-slate-600">
                <th className="text-left p-4 font-semibold">{DEPLOYMENT.subjectIdLabel}</th>
                <th className="text-left p-4 font-semibold">
                  Status
                  <HelpTip title={columnHelp.status.title} lines={columnHelp.status.lines} />
                </th>
                <th className="text-left p-4 font-semibold">
                  Priority
                  <HelpTip title={columnHelp.priority.title} lines={columnHelp.priority.lines} />
                </th>
                <th className="text-left p-4 font-semibold">
                  Probability
                  <HelpTip title={columnHelp.probability.title} lines={columnHelp.probability.lines} />
                </th>
                <th className="text-left p-4 font-semibold">
                  Confidence
                  <HelpTip title={columnHelp.confidence.title} lines={columnHelp.confidence.lines} align="right" />
                </th>
                <th className="text-left p-4 font-semibold">
                  Stage used
                  <HelpTip title={columnHelp.stage.title} lines={columnHelp.stage.lines} align="right" />
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s) => {
                const tier = s.status === 'ok' && s.flagged ? priorityTier(s.probability) : null
                return (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                    <td className="p-4 font-medium text-slate-900">{formatId(s.id)}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${riskBadge(s)}`}>
                        {riskLabel(s)}
                      </span>
                    </td>
                    <td className="p-4">
                      {tier ? (
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${tier.className}`}>
                          {tier.label}
                        </span>
                      ) : (
                        <span className="text-slate-300">--</span>
                      )}
                    </td>
                    <td className="p-4 font-semibold text-slate-900">
                      {s.status === 'ok' ? `${(s.probability * 100).toFixed(1)}%` : (
                        <span className="text-slate-300 font-normal">--</span>
                      )}
                    </td>
                    <td className="p-4 text-slate-500">{s.confidence || '--'}</td>
                    <td className="p-4 text-slate-500">{s.stageUsed || '--'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}