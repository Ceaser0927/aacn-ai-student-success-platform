import { useState } from 'react'

const studentsData = [
  {
    id: 1,
    name: 'Emily Johnson',
    risk: 'High',
    score: 92,
    cohort: 'BSN-2026',
  },
  {
    id: 2,
    name: 'Michael Lee',
    risk: 'Medium',
    score: 81,
    cohort: 'BSN-2025',
  },
  {
    id: 3,
    name: 'Sophia Martinez',
    risk: 'Medium',
    score: 76,
    cohort: 'BSN-2026',
  },
  {
    id: 4,
    name: 'Olivia Davis',
    risk: 'Low',
    score: 34,
    cohort: 'BSN-2027',
  },
  {
    id: 5,
    name: 'James Wilson',
    risk: 'Low',
    score: 28,
    cohort: 'BSN-2025',
  },
]

export default function Students() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')

  const filteredStudents = studentsData.filter((student) => {
    const matchesSearch = student.name
      .toLowerCase()
      .includes(search.toLowerCase())

    const matchesFilter =
      filter === 'All' || student.risk === filter

    return matchesSearch && matchesFilter
  })

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

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          <input
            type="text"
            placeholder="Search student..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-slate-200 rounded-xl px-4 py-2 w-full md:w-80 outline-none"
          />

          <div className="flex gap-2">
            {['All', 'High', 'Medium', 'Low'].map((item) => (
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

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left p-4">Student</th>
              <th className="text-left p-4">Risk</th>
              <th className="text-left p-4">Score</th>
              <th className="text-left p-4">Cohort</th>
              <th className="text-left p-4">Action</th>
            </tr>
          </thead>

          <tbody>
            {filteredStudents.map((student) => (
              <tr
                key={student.id}
                className="border-b border-slate-100 hover:bg-slate-50 transition"
              >
                <td className="p-4 font-medium">
                  {student.name}
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

                <td className="p-4 font-semibold">
                  {student.score}
                </td>

                <td className="p-4">
                  {student.cohort}
                </td>

                <td className="p-4">
                  <button className="text-blue-600 font-medium hover:text-blue-800">
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}