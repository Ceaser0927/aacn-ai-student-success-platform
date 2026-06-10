import Head from 'next/head'
import {
  RiAlarmWarningLine,
  RiBarChartBoxLine,
  RiShieldCheckLine,
  RiArrowUpLine,
  RiArrowDownLine,
  RiUserSearchLine,
} from 'react-icons/ri'

const riskFactors = [
  {
    factor: 'GPA Decline',
    students: 8,
    impact: 'High',
    trend: 'up',
    change: '+2',
  },
  {
    factor: 'Attendance Drop',
    students: 6,
    impact: 'High',
    trend: 'up',
    change: '+1',
  },
  {
    factor: 'Low Exam Scores',
    students: 5,
    impact: 'Medium',
    trend: 'down',
    change: '-1',
  },
  {
    factor: 'Clinical Performance Concern',
    students: 4,
    impact: 'Medium',
    trend: 'up',
    change: '+1',
  },
]

const highRiskStudents = [
  {
    name: 'Emily Johnson',
    score: 92,
    reason: 'GPA Decline',
    recommendation: 'Academic advising',
  },
  {
    name: 'Michael Lee',
    score: 81,
    reason: 'Attendance Drop',
    recommendation: 'Attendance check-in',
  },
  {
    name: 'Sophia Martinez',
    score: 76,
    reason: 'Exam Scores',
    recommendation: 'Tutoring support',
  },
]

export default function RiskAnalysis() {
  return (
    <div className="grow">
      <Head>
        <title>Risk Analysis | AACN AI</title>
      </Head>

      <main className="h-full grow flex flex-col gap-6 overflow-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
            <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center mb-3">
              <RiAlarmWarningLine className="text-2xl text-red-500" />
            </div>
            <p className="text-slate-500">High Risk Students</p>
            <h2 className="text-3xl font-bold text-red-500">18</h2>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
            <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center mb-3">
              <RiBarChartBoxLine className="text-2xl text-orange-500" />
            </div>
            <p className="text-slate-500">Average Risk Score</p>
            <h2 className="text-3xl font-bold text-orange-500">64</h2>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
              <RiUserSearchLine className="text-2xl text-blue-600" />
            </div>
            <p className="text-slate-500">Flagged Factors</p>
            <h2 className="text-3xl font-bold text-slate-900">12</h2>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
            <div className="w-11 h-11 rounded-xl bg-green-50 flex items-center justify-center mb-3">
              <RiShieldCheckLine className="text-2xl text-green-500" />
            </div>
            <p className="text-slate-500">Improved This Week</p>
            <h2 className="text-3xl font-bold text-green-500">7</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Risk Factor Breakdown
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              Most common factors contributing to student risk.
            </p>

            <div className="space-y-4">
              {riskFactors.map((item) => (
                <div
                  key={item.factor}
                  className="border border-slate-200 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {item.factor}
                      </p>
                      <p className="text-sm text-slate-500">
                        {item.students} students affected
                      </p>
                    </div>

                    <div
                      className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        item.impact === 'High'
                          ? 'bg-red-100 text-red-600'
                          : 'bg-orange-100 text-orange-600'
                      }`}
                    >
                      {item.impact}
                    </div>
                  </div>

                  <div className="w-full bg-slate-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${
                        item.impact === 'High'
                          ? 'bg-red-500'
                          : 'bg-orange-500'
                      }`}
                      style={{ width: `${item.students * 10}%` }}
                    />
                  </div>

                  <div className="flex items-center gap-2 mt-3 text-sm">
                    {item.trend === 'up' ? (
                      <RiArrowUpLine className="text-red-500" />
                    ) : (
                      <RiArrowDownLine className="text-green-500" />
                    )}

                    <span
                      className={
                        item.trend === 'up'
                          ? 'text-red-500'
                          : 'text-green-500'
                      }
                    >
                      {item.change}
                    </span>

                    <span className="text-slate-500">
                      compared with last week
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Risk Score Model
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              Current weighted factors used by the prototype model.
            </p>

            <div className="space-y-5">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="font-medium">Academic Performance</span>
                  <span className="font-semibold">35%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3">
                  <div className="bg-blue-600 h-3 rounded-full w-[35%]" />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span className="font-medium">Attendance</span>
                  <span className="font-semibold">25%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3">
                  <div className="bg-blue-500 h-3 rounded-full w-[25%]" />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span className="font-medium">Clinical Performance</span>
                  <span className="font-semibold">20%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3">
                  <div className="bg-blue-400 h-3 rounded-full w-[20%]" />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span className="font-medium">Engagement</span>
                  <span className="font-semibold">20%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3">
                  <div className="bg-blue-300 h-3 rounded-full w-[20%]" />
                </div>
              </div>
            </div>

            <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="font-semibold text-blue-700">
                AI Insight
              </p>
              <p className="text-sm text-slate-600 mt-1">
                GPA decline and attendance drop are currently the strongest
                indicators among high-risk students.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            Highest Priority Students
          </h2>

          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3">Student</th>
                <th className="text-left py-3">Risk Score</th>
                <th className="text-left py-3">Primary Factor</th>
                <th className="text-left py-3">Suggested Action</th>
              </tr>
            </thead>

            <tbody>
              {highRiskStudents.map((student) => (
                <tr
                  key={student.name}
                  className="border-b border-slate-100"
                >
                  <td className="py-4 font-medium">
                    {student.name}
                  </td>

                  <td className="py-4 text-red-500 font-semibold">
                    {student.score}%
                  </td>

                  <td className="py-4">
                    {student.reason}
                  </td>

                  <td className="py-4 text-blue-600 font-medium">
                    {student.recommendation}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}