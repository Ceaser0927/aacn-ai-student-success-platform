import Head from 'next/head'
import { useState } from 'react'
import {
  RiUploadCloud2Line,
  RiFileTextLine,
  RiShieldCheckLine,
  RiAlarmWarningLine,
  RiBarChartBoxLine,
} from 'react-icons/ri'

const getRiskLevel = (score) => {
  if (score >= 80) return 'Low'
  if (score >= 70) return 'Medium'
  return 'High'
}

const getRiskBadge = (risk) => {
  switch (risk) {
    case 'High':
      return 'bg-red-100 text-red-600'
    case 'Medium':
      return 'bg-orange-100 text-orange-600'
    default:
      return 'bg-green-100 text-green-600'
  }
}

const parseCSVLine = (line) => {
  return line
    .split(',')
    .map((value) => value.replace(/^"|"$/g, '').trim())
}

const calculateAverage = (values) => {
  const numbers = values
    .map((value) => Number(value))
    .filter((value) => !Number.isNaN(value))

  if (numbers.length === 0) return null

  const total = numbers.reduce((sum, value) => sum + value, 0)

  return Number((total / numbers.length).toFixed(2))
}

export default function DataImport() {
  const [fileName, setFileName] = useState('')
  const [students, setStudents] = useState([])
  const [importType, setImportType] = useState('')

  const handleFileUpload = (event) => {
    const file = event.target.files[0]

    if (!file) return

    setFileName(file.name)

    const reader = new FileReader()

    reader.onload = (e) => {
      const text = e.target.result
      const rows = text
        .split('\n')
        .map((row) => row.trim())
        .filter(Boolean)

      if (rows.length < 2) {
        setStudents([])
        return
      }

      const headers = parseCSVLine(rows[0])
      const normalizedHeaders = headers.map((header) =>
        header.toLowerCase().trim()
      )

      const idIndex = normalizedHeaders.findIndex((header) =>
        ['id', 'student id', 'studentid'].includes(header)
      )

      const scoreIndex = normalizedHeaders.findIndex((header) =>
        ['score', 'final score', 'final', 'total'].includes(header)
      )

      if (idIndex === -1) {
        setStudents([])
        setImportType('Unsupported file: missing ID column')
        return
      }

      const parsedStudents = rows
        .slice(1)
        .map((row) => {
          const columns = parseCSVLine(row)
          const id = columns[idIndex]?.trim()

          if (!id) return null

          let score = null
          let source = ''

          if (scoreIndex !== -1) {
            score = Number(columns[scoreIndex])
            source = headers[scoreIndex]

            if (Number.isNaN(score)) return null
          } else {
            const numericValues = columns.filter((value, index) => {
              if (index === idIndex) return false
              return !Number.isNaN(Number(value)) && value !== ''
            })

            score = calculateAverage(numericValues)
            source = 'Average of numeric columns'

            if (score === null) return null
          }

          return {
            id,
            score,
            risk: getRiskLevel(score),
            source,
          }
        })
        .filter(Boolean)

      if (scoreIndex !== -1) {
        setImportType(`Simple CSV detected: using "${headers[scoreIndex]}" column`)
      } else {
        setImportType('Complex CSV detected: using average of numeric grade columns')
      }

      setStudents(parsedStudents)
    }

    reader.readAsText(file)
  }

  const totalStudents = students.length
  const highRisk = students.filter((student) => student.risk === 'High').length
  const mediumRisk = students.filter((student) => student.risk === 'Medium').length
  const lowRisk = students.filter((student) => student.risk === 'Low').length

  return (
    <div className="grow">
      <Head>
        <title>Data Import | AACN AI</title>
      </Head>

      <main className="h-full grow flex flex-col gap-6 overflow-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
              <RiFileTextLine className="text-2xl text-blue-600" />
            </div>
            <p className="text-slate-500">Imported Students</p>
            <h2 className="text-3xl font-bold text-slate-900">
              {totalStudents}
            </h2>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
            <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center mb-3">
              <RiAlarmWarningLine className="text-2xl text-red-500" />
            </div>
            <p className="text-slate-500">High Risk</p>
            <h2 className="text-3xl font-bold text-red-500">
              {highRisk}
            </h2>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
            <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center mb-3">
              <RiBarChartBoxLine className="text-2xl text-orange-500" />
            </div>
            <p className="text-slate-500">Medium Risk</p>
            <h2 className="text-3xl font-bold text-orange-500">
              {mediumRisk}
            </h2>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
            <div className="w-11 h-11 rounded-xl bg-green-50 flex items-center justify-center mb-3">
              <RiShieldCheckLine className="text-2xl text-green-500" />
            </div>
            <p className="text-slate-500">Low Risk</p>
            <h2 className="text-3xl font-bold text-green-500">
              {lowRisk}
            </h2>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-4xl mb-4">
              <RiUploadCloud2Line />
            </div>

            <h2 className="text-2xl font-bold text-slate-900">
              Upload Course CSV
            </h2>

            <p className="text-slate-500 mt-2 max-w-xl">
              Upload a simple grade file with ID and Score columns, or a detailed course file with multiple numeric grade columns.
            </p>

            <label className="mt-6 bg-blue-600 text-white rounded-xl px-5 py-2 font-medium hover:bg-blue-700 transition cursor-pointer">
              Select CSV File
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {fileName && (
              <p className="text-sm text-slate-500 mt-4">
                Selected file: <span className="font-semibold">{fileName}</span>
              </p>
            )}

            {importType && (
              <p className="text-sm text-blue-600 mt-2 font-medium">
                {importType}
              </p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200">
            <h2 className="text-2xl font-bold text-slate-900">
              Imported Student Risk Results
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              The system calculates risk based on the selected score column or the average of numeric grade columns.
            </p>
          </div>

          {students.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No data imported yet.
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left p-4">Student ID</th>
                  <th className="text-left p-4">Calculated Score</th>
                  <th className="text-left p-4">Risk Level</th>
                  <th className="text-left p-4">Score Source</th>
                </tr>
              </thead>

              <tbody>
                {students.map((student) => (
                  <tr
                    key={student.id}
                    className="border-b border-slate-100 hover:bg-slate-50 transition"
                  >
                    <td className="p-4 font-medium">
                      {student.id}
                    </td>

                    <td className="p-4 font-semibold">
                      {student.score}
                    </td>

                    <td className="p-4">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskBadge(
                          student.risk
                        )}`}
                      >
                        {student.risk}
                      </span>
                    </td>

                    <td className="p-4 text-slate-500">
                      {student.source}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}