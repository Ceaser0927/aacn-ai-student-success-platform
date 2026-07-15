import Head from 'next/head'
import { useState, useEffect } from 'react'
import {
  RiAlarmWarningLine,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiShieldCheckLine,
  RiQuestionLine,
} from 'react-icons/ri'

const DEPLOYMENT = {
  apiBase: 'http://127.0.0.1:8000/api',
  projectName: 'nursing_risk_v1',
  cohortName: 's5_master_dataset',
  subjectLabel: 'student',
  subjectLabelPlural: 'students',
}

// Same best-guess mapping used on the Recommendations page -- please
// correct anything wrong. See the comment there for details.
const COURSE_NAMES = {
  CT1: 'Critical Thinking Assessment 1',
  CT2: 'Critical Thinking Assessment 2',
  OB: 'Obstetric Nursing',
  Peds: 'Pediatric Nursing',
  Comm: 'Community Health Nursing',
  Men: 'Mental Health Nursing',
  MS: 'Medical-Surgical Nursing',
  MS5: 'Medical-Surgical Nursing 5',
  Pharm: 'Pharmacology',
  Foundation: 'Foundations of Nursing',
  Leadership: 'Nursing Leadership',
}

function courseName(code) {
  return COURSE_NAMES[code] || code
}

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

export default function RiskAnalysis() {
  const [stages, setStages] = useState({})
  const [flaggedFactors, setFlaggedFactors] = useState([]) // list of top_contributing_factors arrays
  const [flaggedCount, setFlaggedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [statusRes, predictRes] = await Promise.all([
          fetch(`${DEPLOYMENT.apiBase}/projects/${DEPLOYMENT.projectName}/live_status`),
          fetch(
            `${DEPLOYMENT.apiBase}/projects/${DEPLOYMENT.projectName}/predict_cohort/${DEPLOYMENT.cohortName}`,
            { method: 'POST' }
          ),
        ])

        const statusData = await statusRes.json()
        if (!statusRes.ok) throw new Error(statusData.detail || 'Failed to load model status')

        const predictData = await predictRes.json()
        if (!predictRes.ok) throw new Error(predictData.detail || 'Failed to load predictions')

        setStages(statusData.stages || {})

        const flagged = predictData.results.filter(
          (r) => r.status === 'ok' && r.flagged_for_review === true
        )
        setFlaggedCount(flagged.length)
        setFlaggedFactors(flagged.map((r) => r.top_contributing_factors || []))
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Real aggregate: how often each course was the TOP contributing factor
  // among flagged students, computed directly from the model's own
  // per-student breakdowns -- nothing here is invented.
  const factorCounts = {}
  flaggedFactors.forEach((factors) => {
    if (factors.length === 0) return
    const top = factors[0].feature
    factorCounts[top] = (factorCounts[top] || 0) + 1
  })
  const sortedFactors = Object.entries(factorCounts).sort((a, b) => b[1] - a[1])

  const stageEntries = Object.entries(stages)
  const reliableStages = stageEntries.filter(([, info]) => info.reliable === true)
  const liveStage = reliableStages[0] // the one actually used for real flags today

  return (
    <div className="grow">
      <Head>
        <title>Risk Analysis | AACN AI</title>
      </Head>

      <main className="h-full grow flex flex-col gap-6 overflow-auto">
        {loading && (
          <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center text-slate-500">
            Loading model validation results...
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4">{error}</div>
        )}

        {!loading && !error && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
                  <RiShieldCheckLine className="text-2xl text-blue-600" />
                </div>
                <p className="text-slate-500">Stages trained</p>
                <h2 className="text-3xl font-bold text-slate-900">{stageEntries.length}</h2>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                <div className="w-11 h-11 rounded-xl bg-green-50 flex items-center justify-center mb-3">
                  <RiCheckboxCircleLine className="text-2xl text-green-500" />
                </div>
                <p className="text-slate-500">Reliable stages</p>
                <h2 className="text-3xl font-bold text-green-500">{reliableStages.length}</h2>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center mb-3">
                  <RiAlarmWarningLine className="text-2xl text-red-500" />
                </div>
                <p className="text-slate-500">Flagged this run</p>
                <h2 className="text-3xl font-bold text-red-500">{flaggedCount}</h2>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
                  <RiShieldCheckLine className="text-2xl text-slate-600" />
                </div>
                <p className="text-slate-500">Live stage</p>
                <h2 className="text-2xl font-bold text-slate-900">{liveStage ? liveStage[0] : 'None'}</h2>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h2 className="text-2xl font-bold text-slate-900 mb-2 flex items-center">
                Stage Validation Results
                <HelpTip
                  title="What this table shows"
                  lines={[
                    'Each stage is a separate model trained on a different set of available courses.',
                    'Recall = of the truly high-risk students in that holdout batch, how many did this stage catch.',
                    'Only "Reliable" stages are actually used to produce a real flag today.',
                  ]}
                />
              </h2>
              <p className="text-sm text-slate-500 mb-6">
                Real performance measured on {DEPLOYMENT.subjectLabelPlural} never used in training.
              </p>

              <div className="space-y-3">
                {stageEntries.map(([name, info]) => (
                  <div key={name} className="border border-slate-200 rounded-xl p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-slate-900">{name}</span>
                        <span className="text-sm text-slate-500">{info.features.map(courseName).join(', ')}</span>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-semibold inline-flex items-center gap-1 ${
                          info.reliable
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {info.reliable ? <RiCheckboxCircleLine /> : <RiCloseCircleLine />}
                        {info.reliable ? 'Reliable' : 'Not reliable'}
                      </span>
                    </div>
                    {info.held_out_results && (
                      <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                        {Object.entries(info.held_out_results).map(([cohort, r]) => (
                          <span key={cohort}>
                            {cohort}: recall={r.recall}, precision={r.precision} (n={r.n})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h2 className="text-2xl font-bold text-slate-900 mb-2 flex items-center">
                Risk Factor Breakdown
                <HelpTip
                  title="How this is computed"
                  lines={[
                    'For each flagged student, the model identifies its single strongest contributing course (based on the model\'s own coefficients).',
                    'This counts how often each course was that top factor, across all flagged students in this run.',
                  ]}
                />
              </h2>
              <p className="text-sm text-slate-500 mb-6">
                Which courses most often drive a flag, based on real {DEPLOYMENT.subjectLabelPlural} scored this run.
              </p>

              {sortedFactors.length === 0 ? (
                <p className="text-slate-500">No flagged {DEPLOYMENT.subjectLabelPlural} to analyze.</p>
              ) : (
                <div className="space-y-3">
                  {sortedFactors.map(([feature, count]) => {
                    const pct = flaggedCount ? Math.round((count / flaggedCount) * 100) : 0
                    return (
                      <div key={feature} className="border border-slate-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold text-slate-900">{courseName(feature)}</p>
                          <p className="text-sm text-slate-500">
                            {count} of {flaggedCount} flagged {DEPLOYMENT.subjectLabelPlural} ({pct}%)
                          </p>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-3">
                          <div
                            className="h-3 rounded-full bg-red-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}