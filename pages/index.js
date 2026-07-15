import Head from 'next/head'
import { useState, useEffect } from 'react'
import {
  RiUserHeartLine,
  RiAlarmWarningLine,
  RiBarChartBoxLine,
  RiShieldCheckLine,
} from 'react-icons/ri'

// --- Everything specific to THIS deployment lives here. ---
// To point this same page at a different project (e.g. a future hospital
// deployment), only this block needs to change.
const DEPLOYMENT = {
  apiBase: 'http://127.0.0.1:8000/api',
  projectName: 'nursing_risk_v1',
  cohortName: 's5_master_dataset',
  subjectLabel: 'student', // lowercase, used inline in sentences; e.g. "patient" for a hospital deployment
  subjectLabelPlural: 'students',
  subjectIdLabel: 'ID',
}

// Student/Patient IDs often arrive as "34746.0" because the CSV column got
// read as a float. This only affects display.
function formatId(id) {
  const num = Number(id)
  if (!Number.isNaN(num) && Number.isInteger(num)) return String(num)
  return id
}

export default function Dashboard() {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(
          `${DEPLOYMENT.apiBase}/projects/${DEPLOYMENT.projectName}/predict_cohort/${DEPLOYMENT.cohortName}`,
          { method: 'POST' }
        )
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || 'Failed to load predictions')
        setResults(data.results)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const scored = results.filter((r) => r.status === 'ok')
  const flagged = scored.filter((r) => r.flagged_for_review === true)
  const notFlagged = scored.filter((r) => r.flagged_for_review === false)
  const notScored = results.filter((r) => r.status !== 'ok')

  const total = results.length
  const flaggedPct = total ? Math.round((flagged.length / total) * 100) : 0
  const notFlaggedPct = total ? Math.round((notFlagged.length / total) * 100) : 0
  const notScoredPct = total ? Math.round((notScored.length / total) * 100) : 0

  // Top alerts: flagged students, sorted by probability, highest first
  const topAlerts = [...flagged]
    .sort((a, b) => b.probability_high_risk - a.probability_high_risk)
    .slice(0, 5)

  return (
    <div className="grow">
      <Head>
        <title>AACN AI Dashboard</title>
      </Head>

      <main className="h-full grow flex flex-col gap-6 overflow-auto">
        {loading && (
          <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center text-slate-500">
            Scoring {DEPLOYMENT.subjectLabelPlural} against the published model...
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4">
            {error} -- make sure a model has been trained, validated, and
            published for project &quot;{DEPLOYMENT.projectName}&quot; in Data Import.
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
                  <RiUserHeartLine className="text-2xl text-blue-600" />
                </div>
                <p className="text-slate-500">Total Scored</p>
                <h2 className="text-3xl font-bold text-slate-900">{total}</h2>
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center mb-3">
                  <RiAlarmWarningLine className="text-2xl text-red-500" />
                </div>
                <p className="text-slate-500">Flagged for review</p>
                <h2 className="text-3xl font-bold text-red-500">{flagged.length}</h2>
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                <div className="w-11 h-11 rounded-xl bg-green-50 flex items-center justify-center mb-3">
                  <RiShieldCheckLine className="text-2xl text-green-500" />
                </div>
                <p className="text-slate-500">Not flagged</p>
                <h2 className="text-3xl font-bold text-green-500">{notFlagged.length}</h2>
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center mb-3">
                  <RiBarChartBoxLine className="text-2xl text-orange-500" />
                </div>
                <p className="text-slate-500">Not scored (insufficient data)</p>
                <h2 className="text-3xl font-bold text-orange-500">{notScored.length}</h2>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h2 className="text-2xl font-bold mb-2 text-slate-900">Screening Overview</h2>
              <p className="text-sm text-slate-500 mb-6">
                Based on the most recently published model, scored against cohort &quot;{DEPLOYMENT.cohortName}&quot;.
              </p>

              <div className="space-y-4">
                <div className="flex items-center justify-between bg-red-50 border border-red-100 rounded-xl p-4">
                  <div>
                    <p className="font-semibold text-slate-900">Flagged</p>
                    <p className="text-sm text-slate-500">Recommended for faculty review</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-red-500">{flagged.length}</p>
                    <p className="text-sm text-slate-500">{flaggedPct}%</p>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-green-50 border border-green-100 rounded-xl p-4">
                  <div>
                    <p className="font-semibold text-slate-900">Not flagged</p>
                    <p className="text-sm text-slate-500">No screening concern raised</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-500">{notFlagged.length}</p>
                    <p className="text-sm text-slate-500">{notFlaggedPct}%</p>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-orange-50 border border-orange-100 rounded-xl p-4">
                  <div>
                    <p className="font-semibold text-slate-900">Not scored</p>
                    <p className="text-sm text-slate-500">Not enough course data yet for a reliable result</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-orange-500">{notScored.length}</p>
                    <p className="text-sm text-slate-500">{notScoredPct}%</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
              <h2 className="text-2xl font-bold mb-4 text-slate-900">High Priority Alerts</h2>
              {topAlerts.length === 0 ? (
                <p className="text-slate-500">No flagged {DEPLOYMENT.subjectLabelPlural} in this cohort.</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2">{DEPLOYMENT.subjectIdLabel}</th>
                      <th className="text-left py-2">Probability</th>
                      <th className="text-left py-2">Features used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topAlerts.map((r) => (
                      <tr key={r.subject_id} className="border-b border-slate-200">
                        <td className="py-3">{formatId(r.subject_id)}</td>
                        <td className="text-red-500 font-semibold">
                          {(r.probability_high_risk * 100).toFixed(1)}%
                        </td>
                        <td>{r.features_used.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="text-xs text-slate-400 mt-4">
                This is a screening signal, not a diagnosis -- flagged {DEPLOYMENT.subjectLabelPlural} are
                recommended for faculty review.
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  )
}