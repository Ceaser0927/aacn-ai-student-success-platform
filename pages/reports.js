import Head from 'next/head'
import {
  RiFileChartLine,
  RiDownload2Line,
  RiCalendarLine,
  RiTeamLine,
  RiAlarmWarningLine,
  RiRobot2Line,
  RiCheckboxCircleLine,
  RiFileTextLine,
} from 'react-icons/ri'

const reportStats = [
  {
    title: 'Generated Reports',
    value: 18,
    icon: <RiFileChartLine />,
    color: 'blue',
  },
  {
    title: 'High Risk Cases',
    value: 18,
    icon: <RiAlarmWarningLine />,
    color: 'red',
  },
  {
    title: 'AI Plans Created',
    value: 24,
    icon: <RiRobot2Line />,
    color: 'purple',
  },
  {
    title: 'Resolved Cases',
    value: 7,
    icon: <RiCheckboxCircleLine />,
    color: 'green',
  },
]

const recentReports = [
  {
    title: 'Weekly Student Risk Summary',
    type: 'Weekly Report',
    date: 'Mar 28, 2026',
    cohort: 'All Cohorts',
    status: 'Ready',
  },
  {
    title: 'High Risk Intervention Report',
    type: 'Risk Report',
    date: 'Mar 25, 2026',
    cohort: 'BSN-2026',
    status: 'Ready',
  },
  {
    title: 'Cohort Performance Overview',
    type: 'Cohort Report',
    date: 'Mar 21, 2026',
    cohort: 'BSN-2025',
    status: 'Ready',
  },
  {
    title: 'AI Recommendation Audit',
    type: 'AI Report',
    date: 'Mar 18, 2026',
    cohort: 'All Cohorts',
    status: 'Draft',
  },
]

const exportOptions = [
  {
    title: 'Student Risk CSV',
    description: 'Export student risk scores and current risk levels.',
    icon: <RiFileTextLine />,
  },
  {
    title: 'Weekly Summary PDF',
    description: 'Generate a faculty-facing weekly intervention summary.',
    icon: <RiFileChartLine />,
  },
  {
    title: 'Cohort Report',
    description: 'Download cohort-level academic and risk trends.',
    icon: <RiTeamLine />,
  },
]

const colorMap = {
  blue: {
    box: 'bg-blue-50',
    text: 'text-blue-600',
  },
  red: {
    box: 'bg-red-50',
    text: 'text-red-500',
  },
  purple: {
    box: 'bg-purple-50',
    text: 'text-purple-500',
  },
  green: {
    box: 'bg-green-50',
    text: 'text-green-500',
  },
}

const getStatusBadge = (status) => {
  switch (status) {
    case 'Ready':
      return 'bg-green-100 text-green-600'
    case 'Draft':
      return 'bg-orange-100 text-orange-600'
    default:
      return 'bg-slate-100 text-slate-600'
  }
}

export default function Reports() {
  return (
    <div className="grow">
      <Head>
        <title>Reports | AACN AI</title>
      </Head>

      <main className="h-full grow flex flex-col gap-6 overflow-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {reportStats.map((item) => {
            const color = colorMap[item.color]

            return (
              <div
                key={item.title}
                className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200"
              >
                <div
                  className={`w-11 h-11 rounded-xl ${color.box} ${color.text} flex items-center justify-center mb-3 text-2xl`}
                >
                  {item.icon}
                </div>

                <p className="text-slate-500">
                  {item.title}
                </p>

                <h2 className={`text-3xl font-bold ${color.text}`}>
                  {item.value}
                </h2>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Recent Reports
                </h2>

                <p className="text-sm text-slate-500 mt-1">
                  Generated summaries for faculty review and program monitoring.
                </p>
              </div>

              <button className="md:ml-auto bg-blue-600 text-white rounded-xl px-4 py-2 font-medium hover:bg-blue-700 transition flex items-center gap-2 w-fit">
                <RiDownload2Line />
                Export All
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left p-4">Report</th>
                    <th className="text-left p-4">Type</th>
                    <th className="text-left p-4">Cohort</th>
                    <th className="text-left p-4">Date</th>
                    <th className="text-left p-4">Status</th>
                    <th className="text-left p-4">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {recentReports.map((report) => (
                    <tr
                      key={report.title}
                      className="border-b border-slate-100 hover:bg-slate-50 transition"
                    >
                      <td className="p-4 font-medium text-slate-900">
                        {report.title}
                      </td>

                      <td className="p-4 text-slate-600">
                        {report.type}
                      </td>

                      <td className="p-4 text-slate-600">
                        {report.cohort}
                      </td>

                      <td className="p-4 text-slate-600">
                        {report.date}
                      </td>

                      <td className="p-4">
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusBadge(
                            report.status
                          )}`}
                        >
                          {report.status}
                        </span>
                      </td>

                      <td className="p-4">
                        <button className="text-blue-600 font-medium hover:text-blue-800">
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Generate Report
            </h2>

            <p className="text-sm text-slate-500 mb-6">
              Create a new summary for a selected cohort and date range.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Report Type
                </label>

                <select className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-2 bg-white outline-none">
                  <option>Weekly Risk Summary</option>
                  <option>High Risk Intervention Report</option>
                  <option>Cohort Performance Overview</option>
                  <option>AI Recommendation Audit</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Cohort
                </label>

                <select className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-2 bg-white outline-none">
                  <option>All Cohorts</option>
                  <option>BSN-2025</option>
                  <option>BSN-2026</option>
                  <option>BSN-2027</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Date Range
                </label>

                <div className="mt-2 flex items-center gap-2 border border-slate-200 rounded-xl px-4 py-2 bg-white">
                  <RiCalendarLine className="text-slate-500" />
                  <span className="text-slate-600 text-sm">
                    Last 7 days
                  </span>
                </div>
              </div>

              <button className="w-full bg-blue-600 text-white rounded-xl px-4 py-2 font-medium hover:bg-blue-700 transition">
                Generate Report
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Export Options
          </h2>

          <p className="text-sm text-slate-500 mb-6">
            Quick export tools for faculty, advisors, and program administrators.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {exportOptions.map((option) => (
              <div
                key={option.title}
                className="border border-slate-200 rounded-2xl p-5 hover:bg-slate-50 transition"
              >
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 text-2xl">
                  {option.icon}
                </div>

                <h3 className="font-bold text-slate-900">
                  {option.title}
                </h3>

                <p className="text-sm text-slate-500 mt-2">
                  {option.description}
                </p>

                <button className="mt-4 text-blue-600 font-medium hover:text-blue-800 flex items-center gap-2">
                  <RiDownload2Line />
                  Export
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}