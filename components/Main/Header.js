import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  RiNotification3Line,
  RiUser3Line,
  RiArrowUpSLine,
  RiArrowDownSLine,
  RiLogoutBoxRLine,
  RiSettings3Line,
  RiShieldUserLine,
  RiRobot2Line,
  RiUserSettingsLine,
} from 'react-icons/ri'
import { getClaims, getCurrentFirebaseUser, logout, fetchWithAuth } from '../../lib/auth'

const Header = () => {
  const router = useRouter()
  const menuRef = useRef(null)

  const [collapsed, setCollapsed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [role, setRole] = useState('')
  const [email, setEmail] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)

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
    '/my-recommendations': {
      title: 'My Recommendations',
      subtitle: 'View your personalized academic recommendations.',
    },
    '/admin-users': {
      title: 'User Management',
      subtitle: 'Manage student accounts, admin roles, and access permissions.',
    },
    '/profile': {
      title: 'My Profile',
      subtitle: 'View your account information.',
    },
    '/settings': {
      title: 'Settings',
      subtitle: 'Manage account and notification preferences.',
    },
    '/notifications': {
      title: 'Notifications',
      subtitle: 'View system updates and account notifications.',
    },
  }

  const currentPage = pageMap[router.pathname] || {
    title: 'Page',
    subtitle: '',
  }

  useEffect(() => {
    async function loadUser() {
      const claims = await getClaims()
      const user = getCurrentFirebaseUser()

      setRole(claims.role || 'student')
      setSubjectId(claims.subject_id || '')
      setEmail(user?.email || '')
    }

    async function loadNotifications() {
      try {
        const res = await fetchWithAuth('/notifications')
        const data = await res.json()

        if (res.ok) {
          setUnreadCount(data.unread_count || 0)
        }
      } catch {
        setUnreadCount(0)
      }
    }

    loadUser()
    loadNotifications()
  }, [router.pathname])

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  async function handleLogout() {
    await logout()
    router.replace('/login')
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
            <Link
              href={role === 'student' ? '/my-recommendations' : '/'}
              className="hover:text-blue-600"
            >
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
          <button
            onClick={() => router.push('/notifications')}
            className="relative bg-white border border-slate-200 hover:bg-slate-50 rounded-xl p-2 shadow-sm"
          >
            <RiNotification3Line className="text-xl text-slate-700" />

            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-blue-600 text-white text-[10px] rounded-full flex items-center justify-center border-2 border-white">
                {unreadCount}
              </span>
            )}
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm hover:bg-slate-50"
            >
              <RiUser3Line className="text-slate-700" />

              <div className="hidden sm:block text-left">
                <p className="text-sm font-semibold text-slate-900 capitalize">
                  {role || 'User'}
                </p>
                <p className="text-xs text-slate-400 max-w-[180px] truncate">
                  {email || 'No email'}
                </p>
              </div>

              <RiArrowDownSLine className="text-slate-500" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <p className="font-semibold text-slate-900 capitalize">
                    {role || 'User'}
                  </p>

                  <p className="text-sm text-slate-500 truncate">
                    {email || 'No email'}
                  </p>

                  {subjectId && (
                    <p className="text-xs text-slate-400 mt-1">
                      Subject ID: {subjectId}
                    </p>
                  )}
                </div>

                <div className="p-2">
                  {role === 'student' && (
                    <button
                      onClick={() => {
                        setMenuOpen(false)
                        router.push('/my-recommendations')
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <RiRobot2Line />
                      My Recommendations
                    </button>
                  )}

                  {role === 'admin' && (
                    <button
                      onClick={() => {
                        setMenuOpen(false)
                        router.push('/admin-users')
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <RiUserSettingsLine />
                      User Management
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      router.push('/profile')
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <RiShieldUserLine />
                    My Profile
                  </button>

                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      router.push('/notifications')
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <RiNotification3Line />
                    Notifications
                  </button>

                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      router.push('/settings')
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <RiSettings3Line />
                    Settings
                  </button>
                </div>

                <div className="p-2 border-t border-slate-100">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-red-600 hover:bg-red-50"
                  >
                    <RiLogoutBoxRLine />
                    Logout
                  </button>
                </div>
              </div>
            )}
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