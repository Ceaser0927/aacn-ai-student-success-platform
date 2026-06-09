import Head from 'next/head'
import {
  RiRobot2Line,
  RiUserHeartLine,
  RiCalendarCheckLine,
  RiBookOpenLine,
  RiMentalHealthLine,
  RiCheckboxCircleLine,
  RiTimeLine,
} from 'react-icons/ri'

const recommendationStats = [
  {
    title: 'AI Recommendations',
    value: 24,
    icon: <RiRobot2Line />,
    color: 'blue',
  },
  {
    title: 'Pending Review',
    value: 9,
    icon: <RiTimeLine />,
    color: 'orange',
  },
  {
    title: 'Approved Plans',
    value: 12,
    icon: <RiCheckboxCircleLine />,
    color: 'green',
  },
  {
    title: 'High Priority',
    value: 6,
    icon: <RiUserHeartLine />,
    color: 'red',
  },
]

const recommendations = [
  {
    student: 'Emily Johnson',
    risk: 'High',
    score: 92,
    category: 'Academic Support',
    recommendation: 'Schedule academic advising and create a weekly GPA recovery plan.',
    reason: 'Recent GPA decline and low exam performance.',
    priority: 'High',
    status: 'Pending Review',
    icon: <RiBookOpenLine />,
  },
  {
    student: 'Michael Lee',
    risk: 'Medium',
    score: 81,
    category: 'Attendance Intervention',
    recommendation: 'Assign attendance check-ins and notify faculty advisor.',
    reason: 'Repeated attendance drop across clinical sessions.',
    priority: 'High',
    status: 'Pending Review',
    icon: <RiCalendarCheckLine />,
  },
  {
    student: 'Sophia Martinez',
    risk: 'Medium',
    score: 76,
    category: 'Tutoring Support',
    recommendation: 'Recommend tutoring support for exam preparation.',
    reason: 'Exam score trend is below cohort average.',
    priority: 'Medium',
    status: 'Approved',
    icon: <RiBookOpenLine />,
  },
  {
    student: 'Olivia Davis',
    risk: 'Low',
    score: 34,
    category: 'Wellness Check',
    recommendation: 'Send optional wellness resource reminder.',
    reason: 'Student is stable but had minor engagement decrease.',
    priority: 'Low',
    status: 'Completed',
    icon: <RiMentalHealthLine />,
  },
]

const colorMap = {
  blue: {
    box: 'bg-blue-50',
    text: 'text-blue-600',
  },
  orange: {
    box: 'bg-orange-50',
    text: 'text-orange-500',
  },
  green: {
    box: 'bg-green-50',
    text: 'text-green-500',
  },
  red: {
    box: 'bg-red-50',
    text: 'text-red-500',
  },
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

const getPriorityBadge = (priority) => {
  switch (priority) {
    case 'High':
      return 'bg-red-100 text-red-600'
    case 'Medium':
      return 'bg-orange-100 text-orange-600'
    default:
      return 'bg-green-100 text-green-600'
  }
}

const getStatusBadge = (status) => {
  switch (status) {
    case 'Pending Review':
      return 'bg-orange-100 text-orange-600'
    case 'Approved':
      return 'bg-blue-100 text-blue-600'
    default:
      return 'bg-green-100 text-green-600'
  }
}

export default function Recommendations() {
  return (
    <div className="grow">
      <Head>
        <title>Recommendations | AACN AI</title>
      </Head>

      <main className="h-full grow flex flex-col gap-6 overflow-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {recommendationStats.map((item) => {
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
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              AI-Assisted Intervention Recommendations
            </h2>

            <p className="text-sm text-slate-500 mb-6">
              Suggested actions generated from student risk factors and current performance signals.
            </p>

            <div className="space-y-4">
              {recommendations.map((item) => (
                <div
                  key={`${item.student}-${item.category}`}
                  className="border border-slate-200 rounded-2xl p-5 hover:bg-slate-50 transition"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl shrink-0">
                      {item.icon}
                    </div>

                    <div className="flex-1">
                      <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 mb-2">
                        <h3 className="text-lg font-bold text-slate-900">
                          {item.student}
                        </h3>

                        <span
                          className={`w-fit px-3 py-1 rounded-full text-sm font-semibold ${getRiskBadge(
                            item.risk
                          )}`}
                        >
                          {item.risk} Risk
                        </span>

                        <span className="text-sm text-slate-500">
                          Score: {item.score}%
                        </span>
                      </div>

                      <p className="font-semibold text-slate-800">
                        {item.category}
                      </p>

                      <p className="text-slate-600 mt-1">
                        {item.recommendation}
                      </p>

                      <p className="text-sm text-slate-500 mt-2">
                        Reason: {item.reason}
                      </p>

                      <div className="flex flex-wrap gap-2 mt-4">
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-semibold ${getPriorityBadge(
                            item.priority
                          )}`}
                        >
                          {item.priority} Priority
                        </span>

                        <span
                          className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusBadge(
                            item.status
                          )}`}
                        >
                          {item.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex lg:flex-col gap-2">
                      <button className="px-4 py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition">
                        Review
                      </button>

                      <button className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-50 transition">
                        Assign
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Recommendation Types
            </h2>

            <p className="text-sm text-slate-500 mb-6">
              Common intervention categories used by the platform.
            </p>

            <div className="space-y-4">
              <div className="border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl">
                    <RiBookOpenLine />
                  </div>

                  <div>
                    <p className="font-semibold text-slate-900">
                      Academic Advising
                    </p>
                    <p className="text-sm text-slate-500">
                      GPA and exam support
                    </p>
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center text-xl">
                    <RiCalendarCheckLine />
                  </div>

                  <div>
                    <p className="font-semibold text-slate-900">
                      Attendance Check-in
                    </p>
                    <p className="text-sm text-slate-500">
                      Clinical and class attendance
                    </p>
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-50 text-green-500 flex items-center justify-center text-xl">
                    <RiMentalHealthLine />
                  </div>

                  <div>
                    <p className="font-semibold text-slate-900">
                      Wellness Support
                    </p>
                    <p className="text-sm text-slate-500">
                      Engagement and wellbeing resources
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="font-semibold text-blue-700">
                AI Note
              </p>

              <p className="text-sm text-slate-600 mt-1">
                Recommendations should be reviewed by faculty before being assigned to a student.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}