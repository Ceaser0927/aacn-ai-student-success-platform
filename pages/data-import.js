import Head from 'next/head'
import { useState } from 'react'
import {
  RiUploadCloud2Line,
  RiCloseLine,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiQuestionLine,
} from 'react-icons/ri'

// Point this at wherever your FastAPI backend runs (same host/port as
// your existing /train, /predict routes).
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000/api'

// Smart defaults so most projects need zero manual tweaking to start.
const DEFAULT_EXCLUDED = ['Peds', 'MS5', 'Pharm', 'Foundation']
const DEFAULT_STAGE_GUESS = { CT1: 1, OB: 2, Comm: 3, Men: 3, MS: 4, CT2: 4, Leadership: 4 }

const parseCSVLine = (line) =>
  line.split(',').map((v) => v.replace(/^"|"$/g, '').trim())

export default function DataImport() {
  // Each uploaded file is one self-contained object: name, real File
  // reference (for upload), detected columns, and its train/holdout role.
  // This replaces several separate pieces of state from before.
  const [files, setFiles] = useState([])
  const [uploadError, setUploadError] = useState('')

  // Dataset configuration (business rules only -- no model settings here)
  const [projectName, setProjectName] = useState('nursing_risk_v1')
  const [idColumn, setIdColumn] = useState('Student_ID')
  const [targetColumn, setTargetColumn] = useState('Comprehensive')
  const [riskDirection, setRiskDirection] = useState('low_is_bad')
  const [riskThreshold, setRiskThreshold] = useState('75')
  const [featureConfig, setFeatureConfig] = useState({}) // { [col]: {included, stage} }

  // Training / results / publish
  const [training, setTraining] = useState(false)
  const [trainingError, setTrainingError] = useState('')
  const [stageResults, setStageResults] = useState(null)
  const [published, setPublished] = useState(false)

  // Custom confirm dialog (replaces the native browser confirm() so it
  // matches the rest of the UI). null = hidden.
  const [confirmDialog, setConfirmDialog] = useState(null) // { message, danger, onConfirm }

  // --- Upload ---
  const handleUpload = async (event) => {
    const selected = Array.from(event.target.files || []).filter((f) =>
      f.name.toLowerCase().endsWith('.csv')
    )
    event.target.value = ''
    if (selected.length === 0) {
      setUploadError('No CSV files were selected.')
      return
    }
    setUploadError('')
    setStageResults(null)
    setPublished(false)

    const parsed = []
    for (const file of selected) {
      const text = await file.text()
      const rows = text.split('\n').map((r) => r.trim()).filter(Boolean)
      if (rows.length < 2) continue // skip empty/broken files silently

      const headers = parseCSVLine(rows[0])
      // Cohort defaults to the filename (minus .csv), e.g.
      // "s5_master_dataset.csv" -> "s5_master_dataset". Each file is its
      // own cohort by default; rename if you want to group files together.
      const cohort = file.name.replace(/\.csv$/i, '')

      parsed.push({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        name: file.name,
        cohort,
        rows: rows.length - 1,
        columns: headers.length,
        headerNames: headers,
        role: 'train', // default; admin flips holdout ones explicitly
        rawFile: file,
      })
    }

    setFiles((prev) => {
      const combined = [...prev, ...parsed]
      const seen = new Set()
      return combined.filter((f) => (seen.has(f.id) ? false : seen.add(f.id)))
    })
  }

  const removeFile = (id) => setFiles((prev) => prev.filter((f) => f.id !== id))

  const setFileRole = (id, role) =>
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, role } : f)))

  const setCohortName = (id, cohort) =>
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, cohort } : f)))

  // --- Feature configuration, derived from real uploaded columns ---
  const detectedColumns = () => {
    const set = new Set()
    files.forEach((f) => f.headerNames.forEach((h) => set.add(h)))
    set.delete(idColumn)
    set.delete(targetColumn)
    return Array.from(set)
  }

  const featureState = (col) =>
    featureConfig[col] || {
      included: !DEFAULT_EXCLUDED.includes(col),
      stage: DEFAULT_STAGE_GUESS[col] || 1,
    }

  const toggleFeature = (col) => {
    const cur = featureState(col)
    setFeatureConfig((prev) => ({ ...prev, [col]: { ...cur, included: !cur.included } }))
  }

  const setFeatureStage = (col, stage) => {
    const cur = featureState(col)
    setFeatureConfig((prev) => ({ ...prev, [col]: { ...cur, stage } }))
  }

  // --- Train & Validate: create config -> upload files -> train -> evaluate ---
  const handleTrain = async () => {
    setTraining(true)
    setTrainingError('')
    setStageResults(null)
    setPublished(false)

    try {
      const included = []
      const excluded = []
      detectedColumns().forEach((col) => {
        const s = featureState(col)
        if (s.included) included.push({ feature: col, available_from_stage: parseInt(s.stage, 10) || 1 })
        else excluded.push(col)
      })

      const configRes = await fetch(`${API_BASE}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_name: projectName,
          id_column: idColumn,
          target_column: targetColumn,
          risk_direction: riskDirection,
          risk_threshold: parseFloat(riskThreshold),
          excluded_features: excluded,
          variable_relationships: included,
        }),
      })
      if (!configRes.ok) throw new Error((await configRes.json()).detail || 'Config failed')

      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file.rawFile)
        formData.append('cohort_name', file.cohort)
        formData.append('role', file.role)
        const res = await fetch(`${API_BASE}/projects/${projectName}/upload`, {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) throw new Error((await res.json()).detail || `Upload failed: ${file.name}`)
      }

      const trainRes = await fetch(`${API_BASE}/projects/${projectName}/train`, { method: 'POST' })
      if (!trainRes.ok) throw new Error((await trainRes.json()).detail || 'Training failed')

      const evalRes = await fetch(`${API_BASE}/projects/${projectName}/evaluate`, { method: 'POST' })
      const evalData = await evalRes.json()
      if (!evalRes.ok) throw new Error(evalData.detail || 'Evaluation failed')

      setStageResults(evalData.stages)
    } catch (err) {
      setTrainingError(err.message)
    } finally {
      setTraining(false)
    }
  }

  const handlePublish = () => {
    const anyReliable = stageResults && Object.values(stageResults).some((s) => s.reliable)
    const message = anyReliable
      ? 'This replaces the model used for real predictions. Continue?'
      : 'No stage passed validation. Publishing means no reliable screening will be available. Continue anyway?'

    setConfirmDialog({
      message,
      danger: !anyReliable,
      onConfirm: async () => {
        setConfirmDialog(null)
        try {
          const res = await fetch(`${API_BASE}/projects/${projectName}/publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirm: true }),
          })
          if (!res.ok) throw new Error((await res.json()).detail || 'Publish failed')
          setPublished(true)
        } catch (err) {
          setTrainingError(err.message)
        }
      },
    })
  }

  return (
    <div className="grow bg-slate-50 min-h-screen">
      <Head><title>Data Import | AACN AI</title></Head>

      <main className="max-w-7xl mx-auto px-8 py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Data Import</h1>
          <p className="text-slate-500 mt-2 text-base">
            Upload data, configure the dataset, and train a validated risk model.
          </p>
        </div>

        {/* Step 1: Upload */}
        <section className="bg-white rounded-2xl border border-slate-200 p-8">
          <h2 className="text-lg font-bold text-slate-900 mb-2 flex items-center">
            1. Upload data
            <HelpTip
              title="Training vs. Holdout batches"
              lines={[
                'Training batches teach the model. Holdout batches are kept completely separate, only used to check if it actually works.',
                'Example: upload last year\'s students as Training and this year\'s as Holdout to see if the model generalizes.',
                'You need at least one of each to get a trustworthy result.',
              ]}
            />
          </h2>
          <p className="text-slate-500 mb-5 max-w-3xl">
            Upload each batch of student/patient data as a CSV. Mark which batches are for
            training vs. holdout (validation) -- holdout data is never trained on; it checks
            whether the model actually works on subjects it has never seen.
          </p>

          <label className="inline-flex items-center gap-2 bg-blue-600 text-white rounded-xl px-5 py-2.5 text-sm font-medium cursor-pointer hover:bg-blue-700 transition">
            <RiUploadCloud2Line className="text-lg" />
            Select CSV files
            <input type="file" accept=".csv" multiple onChange={handleUpload} className="hidden" />
          </label>
          {uploadError && <p className="text-sm text-red-600 mt-3">{uploadError}</p>}

          {files.length > 0 && (
            <div className="mt-6 divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {files.map((f) => (
                <div key={f.id} className="flex items-center gap-4 p-4 text-sm">
                  <input
                    value={f.cohort}
                    onChange={(e) => setCohortName(f.id, e.target.value)}
                    className="w-48 border border-slate-300 rounded-lg px-3 py-1.5"
                  />
                  <span className="flex-1 text-slate-700">{f.name}</span>
                  <span className="text-slate-400">{f.rows} rows · {f.columns} cols</span>
                  <select
                    value={f.role}
                    onChange={(e) => setFileRole(f.id, e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-1.5"
                  >
                    <option value="train">Training</option>
                    <option value="holdout">Holdout</option>
                  </select>
                  <button onClick={() => removeFile(f.id)} className="text-red-500 hover:text-red-700 p-1">
                    <RiCloseLine className="text-lg" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Step 2: Configure */}
        {files.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-200 p-8">
            <h2 className="text-lg font-bold text-slate-900 mb-2 flex items-center">
              2. Configure the dataset
              <HelpTip
                title="Tell the system what this data means"
                lines={[
                  'ID column: which column names each student/patient (e.g. "Student_ID").',
                  'Outcome column: which column holds the real result (e.g. "Comprehensive" exam score).',
                  '"High risk means": whether a LOW score is bad (like an exam) or a HIGH score is bad (like a severity index).',
                ]}
              />
            </h2>
            <p className="text-slate-500 mb-5 max-w-3xl">
              Business facts only -- the model type and validation method are fixed and not
              configurable here.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
              <LabeledInput label="Project name" value={projectName} onChange={setProjectName} />
              <LabeledInput label="ID column" value={idColumn} onChange={setIdColumn} />
              <LabeledInput label="Outcome column" value={targetColumn} onChange={setTargetColumn} />
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1.5">High risk means</label>
                <select
                  value={riskDirection}
                  onChange={(e) => setRiskDirection(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="low_is_bad">Low score = high risk</option>
                  <option value="high_is_bad">High score = high risk</option>
                </select>
              </div>
              <LabeledInput label="Risk threshold" value={riskThreshold} onChange={setRiskThreshold} type="number" />
            </div>

            <p className="text-sm font-semibold text-slate-600 mb-3 flex items-center">
              Which columns are features, and when does each become available?
              <HelpTip
                title="Stage = WHEN the info becomes available"
                lines={[
                  'Not a category. Columns available at the same real-world moment get the same number.',
                  'Example: CT1 (semester 1) = stage 1. OB (semester 2) = stage 2. The system trains one model per stage automatically.',
                  'Unchecked columns are left out of training entirely.',
                ]}
              />
            </p>
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-w-2xl">
              {detectedColumns().map((col) => {
                const s = featureState(col)
                return (
                  <div key={col} className="flex items-center gap-4 p-3 text-sm">
                    <input type="checkbox" checked={s.included} onChange={() => toggleFeature(col)} className="w-4 h-4" />
                    <span className="flex-1 text-slate-700">{col}</span>
                    <input
                      type="number"
                      min="1"
                      value={s.stage}
                      disabled={!s.included}
                      onChange={(e) => setFeatureStage(col, e.target.value)}
                      className="w-20 border border-slate-300 rounded-lg px-2 py-1 disabled:opacity-30"
                    />
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Step 3: Train & Validate */}
        {files.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-200 p-8">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
              3. Train & validate
              <HelpTip
                title="Trains and checks each stage"
                lines={[
                  'One model gets trained per stage, using only Training batches.',
                  'Then each model is tested on the Holdout batches -- students it never saw -- to check if it actually works.',
                ]}
              />
            </h2>
            <button
              onClick={handleTrain}
              disabled={training}
              className="bg-slate-900 text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-slate-800 transition disabled:opacity-50"
            >
              {training ? 'Working...' : 'Train & Validate'}
            </button>
            {trainingError && <p className="text-sm text-red-600 mt-3">{trainingError}</p>}
          </section>
        )}

        {/* Step 4: Results + Publish */}
        {stageResults && (
          <section className="bg-white rounded-2xl border border-slate-200 p-8">
            <h2 className="text-lg font-bold text-slate-900 mb-2 flex items-center">
              4. Results
              <HelpTip
                title="Recall = did it catch the real cases?"
                lines={[
                  'Example: 3 students were truly high-risk and the model caught all 3 -- that\'s recall = 100%.',
                  'Reliable (green check) means recall was high enough on every Holdout batch tested.',
                  'No numbers shown = that stage couldn\'t even be tested (e.g. a needed column was missing).',
                  'Nothing affects real predictions until you click Publish.',
                ]}
              />
            </h2>
            <p className="text-slate-500 mb-6">
              Only stages marked Reliable give an actionable flag once published.
            </p>

            <div className="space-y-3 mb-8">
              {Object.entries(stageResults).map(([stage, info]) => (
                <div key={stage} className="flex items-center gap-4 text-sm border border-slate-100 rounded-xl p-4">
                  {info.reliable ? (
                    <RiCheckboxCircleLine className="text-green-600 text-xl" />
                  ) : (
                    <RiCloseCircleLine className="text-red-500 text-xl" />
                  )}
                  <span className="font-medium text-slate-800 w-20">{stage}</span>
                  <span className="text-slate-500 flex-1">{info.features.join(', ')}</span>
                  <span className="text-slate-400">
                    {info.held_out_results &&
                      Object.entries(info.held_out_results)
                        .map(([c, r]) => `${c}: recall=${r.recall}`)
                        .join(' · ')}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={handlePublish}
              disabled={published}
              className="bg-red-600 text-white rounded-xl px-6 py-2.5 text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50 disabled:bg-slate-400"
            >
              {published ? 'Published ✓' : 'Publish to Live'}
            </button>
          </section>
        )}
      </main>

      {/* Custom confirm modal -- replaces window.confirm() so it matches
          the rest of the app's look instead of a plain browser dialog. */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-5">
              {confirmDialog.danger ? (
                <RiCloseCircleLine className="text-red-500 text-2xl shrink-0 mt-0.5" />
              ) : (
                <RiCheckboxCircleLine className="text-amber-500 text-2xl shrink-0 mt-0.5" />
              )}
              <p className="text-slate-700 text-sm leading-relaxed">{confirmDialog.message}</p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function LabeledInput({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-600 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
      />
    </div>
  )
}

// Hover-to-show, hover-out-to-hide tooltip. Short title + a couple of
// concrete, scannable lines -- not a dense paragraph. `align="right"` is
// available if a tip ever sits near the right edge of the page.
function HelpTip({ title, lines, align = 'left' }) {
  const [visible, setVisible] = useState(false)
  return (
    <span
      className="relative inline-block ml-2 align-middle"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <span
        className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 inline-flex items-center justify-center align-middle cursor-help"
        aria-label="Help"
      >
        <RiQuestionLine className="text-xs" />
      </span>
      {visible && (
        <div
          className={`absolute z-20 top-7 w-80 bg-slate-800 text-white text-sm rounded-xl p-4 shadow-xl leading-relaxed ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <p className="text-white">{title}</p>
          {lines.map((line, i) => (
            <p key={i} className="text-slate-300 mt-1.5 text-xs">{line}</p>
          ))}
        </div>
      )}
    </span>
  )
}