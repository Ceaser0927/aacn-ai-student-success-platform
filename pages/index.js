import Head from 'next/head'
import {
  RiUserHeartLine,
  RiAlarmWarningLine,
  RiBarChartBoxLine,
  RiShieldCheckLine
} from 'react-icons/ri'

export default function Dashboard() {
  return (
    <div className="grow">
      <Head>
        <title>AACN AI Dashboard</title>
      </Head>

      <main className="h-full grow flex flex-col gap-6 overflow-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
              <RiUserHeartLine className="text-2xl text-blue-600" />
            </div>
            <p className="text-slate-500">Total Students</p>
            <h2 className="text-3xl font-bold text-slate-900">128</h2>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
            <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center mb-3">
              <RiAlarmWarningLine className="text-2xl text-red-500" />
            </div>
            <p className="text-slate-500">High Risk</p>
            <h2 className="text-3xl font-bold text-red-500">18</h2>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
            <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center mb-3">
              <RiBarChartBoxLine className="text-2xl text-orange-500" />
            </div>
            <p className="text-slate-500">Medium Risk</p>
            <h2 className="text-3xl font-bold text-orange-500">31</h2>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
            <div className="w-11 h-11 rounded-xl bg-green-50 flex items-center justify-center mb-3">
              <RiShieldCheckLine className="text-2xl text-green-500" />
            </div>
            <p className="text-slate-500">Low Risk</p>
            <h2 className="text-3xl font-bold text-green-500">79</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-2xl font-bold mb-2 text-slate-900">
              Risk Overview
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              Current student risk distribution
            </p>

            <div className="flex flex-col lg:flex-row items-center gap-8">
              <div
                className="w-52 h-52 rounded-full flex items-center justify-center"
                style={{
                  background:
                    'conic-gradient(#22C55E 0deg 223deg, #F97316 223deg 309deg, #EF4444 309deg 360deg)',
                }}
              >
                <div className="w-32 h-32 rounded-full bg-white flex flex-col items-center justify-center shadow-inner">
                  <span className="text-3xl font-bold text-slate-900">
                    128
                  </span>
                  <span className="text-sm text-slate-500">
                    Students
                  </span>
                </div>
              </div>

              <div className="flex-1 w-full space-y-4">
                <div className="flex items-center justify-between bg-green-50 border border-green-100 rounded-xl p-4">
                  <div>
                    <p className="font-semibold text-slate-900">Low Risk</p>
                    <p className="text-sm text-slate-500">Stable students</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-500">79</p>
                    <p className="text-sm text-slate-500">62%</p>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-orange-50 border border-orange-100 rounded-xl p-4">
                  <div>
                    <p className="font-semibold text-slate-900">Medium Risk</p>
                    <p className="text-sm text-slate-500">Needs monitoring</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-orange-500">31</p>
                    <p className="text-sm text-slate-500">24%</p>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-red-50 border border-red-100 rounded-xl p-4">
                  <div>
                    <p className="font-semibold text-slate-900">High Risk</p>
                    <p className="text-sm text-slate-500">Needs intervention</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-red-500">18</p>
                    <p className="text-sm text-slate-500">14%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-2xl font-bold mb-2 text-slate-900">
              Weekly Risk Trend
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              Compared with last week
            </p>

            <div className="space-y-4">
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900">High Risk</p>
                  <p className="text-sm text-slate-500">
                    Increased from last week
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-3xl font-bold text-red-500">18</p>
                  <p className="font-semibold text-red-500">↑ 1 Student</p>
                </div>
              </div>

              <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900">Medium Risk</p>
                  <p className="text-sm text-slate-500">
                    Decreased from last week
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-3xl font-bold text-orange-500">31</p>
                  <p className="font-semibold text-orange-500">↓ 1 Student</p>
                </div>
              </div>

              <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900">Low Risk</p>
                  <p className="text-sm text-slate-500">
                    Decreased from last week
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-3xl font-bold text-green-500">79</p>
                  <p className="font-semibold text-green-500">↓ 2 Students</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
            <h2 className="text-2xl font-bold mb-4 text-slate-900">
              High Risk Alerts
            </h2>

            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2">Student</th>
                  <th className="text-left py-2">Risk</th>
                  <th className="text-left py-2">Reason</th>
                </tr>
              </thead>

              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="py-3">Emily Johnson</td>
                  <td className="text-red-500 font-semibold">92%</td>
                  <td>GPA Decline</td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="py-3">Michael Lee</td>
                  <td className="text-orange-500 font-semibold">81%</td>
                  <td>Attendance</td>
                </tr>

                <tr>
                  <td className="py-3">Sophia Martinez</td>
                  <td className="text-orange-500 font-semibold">76%</td>
                  <td>Exam Scores</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
            <h2 className="text-2xl font-bold mb-4 text-slate-900">
              Recent Interventions
            </h2>

            <div className="space-y-4">
              <div className="border border-slate-200 rounded-xl p-3 hover:bg-slate-50 transition">
                <p className="font-semibold">Academic Advising Scheduled</p>
                <p className="text-slate-500 text-sm">Emily Johnson</p>
              </div>

              <div className="border border-slate-200 rounded-xl p-3 hover:bg-slate-50 transition">
                <p className="font-semibold">Tutoring Support Assigned</p>
                <p className="text-slate-500 text-sm">Michael Lee</p>
              </div>

              <div className="border border-slate-200 rounded-xl p-3 hover:bg-slate-50 transition">
                <p className="font-semibold">Clinical Remediation Plan</p>
                <p className="text-slate-500 text-sm">Sophia Martinez</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}