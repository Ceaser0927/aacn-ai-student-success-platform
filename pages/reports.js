import Head from 'next/head'
import { useState } from 'react'
import { RiDownload2Line, RiFileTextLine } from 'react-icons/ri'

const DEPLOYMENT = {
  apiBase: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000/api',
  projectName: 'nursing_risk_v1',
  cohortName: 's5_master_dataset',
  subjectIdLabel: 'Student ID',
}

function formatId(id) {
  const num = Number(id)
  if (!Number.isNaN(num) && Number.isInteger(num)) return String(num)
  return id
}

function toCsv(rows, headers) {
  const escape = (val) => {
    const s = val === null || val === undefined ? '' : String(val)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.map(escape).join(',')]
  rows.forEach((row) => {
    lines.push(headers.map((h) => escape(row[h])).join(','))
  })
  return lines.join('\n')
}

function downloadCsv(filename, csvString) {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function Reports() {
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [lastExportCount, setLastExportCount] = useState(null)

  const exportStudentsCsv = async () => {
    setExporting(true)
    setError('')
    try {
      const res = await fetch(
        `${DEPLOYMENT.apiBase}/projects/${DEPLOYMENT.projectName}/predict_cohort/${DEPLOYMENT.cohortName}`,
        { method: 'POST' }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to load predictions')

      const rows = data.results.map((r) => ({
        [DEPLOYMENT.subjectIdLabel]: formatId(r.subject_id),
        status: r.status,
        flagged: r.status === 'ok' ? (r.flagged_for_review ? 'yes' : 'no') : '',
        probability_percent: r.status === 'ok' ? (r.probability_high_risk * 100).toFixed(1) : '',
        confidence: r.confidence || '',
        stage_used: r.stage_used || '',
        top_factor: r.top_contributing_factors?.[0]?.feature || '',
      }))

      const headers = [
        DEPLOYMENT.subjectIdLabel,
        'status',
        'flagged',
        'probability_percent',
        'confidence',
        'stage_used',
        'top_factor',
      ]

      const csv = toCsv(rows, headers)
      const dateStr = new Date().toISOString().slice(0, 10)
      downloadCsv(`${DEPLOYMENT.cohortName}_predictions_${dateStr}.csv`, csv)
      setLastExportCount(rows.length)
    } catch (err) {
      setError(err.message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="grow">
      <Head>
        <title>Reports | AACN AI</title>
      </Head>

      <main className="h-full grow flex flex-col gap-6 overflow-auto">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
              <RiFileTextLine className="text-2xl text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Export Screening Results</h2>
              <p className="text-sm text-slate-500">
                Downloads the current predictions for cohort &quot;{DEPLOYMENT.cohortName}&quot;
                exactly as scored by the published model -- not a cached or historical report.
              </p>
            </div>
          </div>

          <button
            onClick={exportStudentsCsv}
            disabled={exporting}
            className="mt-4 inline-flex items-center gap-2 bg-blue-600 text-white rounded-xl px-5 py-2.5 font-medium hover:bg-blue-700 transition disabled:opacity-50"
          >
            <RiDownload2Line />
            {exporting ? 'Preparing export...' : 'Export as CSV'}
          </button>

          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
          {lastExportCount !== null && !error && (
            <p className="text-sm text-green-600 mt-3">
              Exported {lastExportCount} rows.
            </p>
          )}
        </div>

        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-2xl p-4">
          <strong>What this page doesn&apos;t do yet:</strong> there is no saved report
          history, no PDF generation, and no cohort/date-range filtering -- those aren&apos;t
          built. Approval/rejection decisions made on the Recommendations page also aren&apos;t
          included here, since those aren&apos;t saved anywhere yet either. This page currently
          does exactly one real thing: exports the model&apos;s current predictions.
        </div>
      </main>
    </div>
  )
}