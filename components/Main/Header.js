import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  RiNotification3Line,
  RiUser3Line,
  RiArrowUpSLine,
  RiArrowDownSLine
} from 'react-icons/ri'

const Header = () => {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  const pageMap = {
    '/': {
      title: 'Home',
      subtitle: 'Overview of student risk, trends, and recent interventions.',
    },
    '/students': {
      title: 'Students',
      subtitle: 'Manage and monitor student risk levels.',
    },
    '/risk-analysis': {
      title: 'Risk Analysis',
      subtitle: 'Identify major risk factors and prioritize student interventions.',
    },
    '/recommendations': {
      title: 'Recommendations',
      subtitle: 'Review AI-assisted intervention recommendations.',
    },
    '/reports': {
      title: 'Reports',
      subtitle: 'Generate summaries and export student success reports.',
    },
    '/data-import': {
      title: 'Data Import',
      subtitle: 'Upload course CSV files and generate prototype risk results.',
    },
  }

  const currentPage = pageMap[router.pathname] || {
    title: 'Page',
    subtitle: '',
  }

  if (collapsed) {
    return (
      <div className="flex items-center border-b border-slate-200 pb-3">
        <h3 className="text-lg font-productSansBold text-blue-700">
          {currentPage.title}
        </h3>

        <button
          onClick={() => setCollapsed(false)}
          className="ml-auto bg-white border border-slate-200 hover:bg-slate-50 rounded-xl p-2 shadow-sm"
        >
          <RiArrowDownSLine className="text-xl text-slate-700" />
        </button>
      </div>
    )
  }

  return (
    <div className="border-b border-slate-200 pb-4">
      <div className="flex items-start gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
            <Link href="/" className="hover:text-blue-600">
              Home
            </Link>

            {router.pathname !== '/' && (
              <>
                <span>/</span>
                <span className="text-blue-700 font-semibold">
                  {currentPage.title}
                </span>
              </>
            )}
          </div>

          <h1 className="text-3xl font-productSansBold text-slate-900">
            {currentPage.title}
          </h1>

          {currentPage.subtitle && (
            <p className="text-slate-500 mt-1">
              {currentPage.subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <button className="bg-white border border-slate-200 hover:bg-slate-50 rounded-xl p-2 shadow-sm">
            <RiNotification3Line className="text-xl text-slate-700" />
          </button>

          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
            <RiUser3Line className="text-slate-700" />
            <span className="text-sm font-semibold hidden sm:block">
              Admin
            </span>
          </div>

          <button
            onClick={() => setCollapsed(true)}
            className="bg-white border border-slate-200 hover:bg-slate-50 rounded-xl p-2 shadow-sm"
          >
            <RiArrowUpSLine className="text-xl text-slate-700" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default Header