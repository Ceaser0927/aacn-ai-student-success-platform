import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import {
  RiHeartPulseFill,
  RiHome5Fill,
  RiTeamFill,
  RiFileChartFill,
  RiRobot2Fill,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiUploadCloud2Line,
} from 'react-icons/ri'
import { MdWarning } from 'react-icons/md'
import NavLink from './NavLink'
import { getClaims } from '../../lib/auth'

const adminMenuItems = [
  {
    text: 'Home',
    address: '/',
    icon: <RiHome5Fill />,
  },
  {
    text: 'Students',
    address: '/students',
    icon: <RiTeamFill />,
  },
  {
    text: 'Risk Analysis',
    address: '/risk-analysis',
    icon: <MdWarning />,
  },
  {
    text: 'Recommendations',
    address: '/recommendations',
    icon: <RiRobot2Fill />,
  },
  {
    text: 'Reports',
    address: '/reports',
    icon: <RiFileChartFill />,
  },
  {
    text: 'Data Import',
    address: '/data-import',
    icon: <RiUploadCloud2Line />,
  },
  {
    text: 'User Management',
    address: '/admin-users',
    icon: <RiTeamFill />,
  },
]

const studentMenuItems = [
  {
    text: 'My Recommendations',
    address: '/my-recommendations',
    icon: <RiRobot2Fill />,
  },
]

const Navbar = () => {
  const [collapsed, setCollapsed] = useState(false)
  const [role, setRole] = useState(null)
  const [loadingRole, setLoadingRole] = useState(true)

  useEffect(() => {
    let mounted = true

    getClaims()
      .then((claims) => {
        if (!mounted) return
        setRole(claims.role || 'student')
      })
      .catch(() => {
        if (!mounted) return
        setRole('student')
      })
      .finally(() => {
        if (!mounted) return
        setLoadingRole(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  const menuItems = role === 'admin' ? adminMenuItems : studentMenuItems

  return (
    <div
      className={`bg-[#0F172A] md:h-screen h-auto flex items-center md:items-start md:flex-col gap-4 overflow-hidden transition-all duration-300 border-r border-slate-800 ${
        collapsed ? 'md:w-[82px]' : 'md:w-[250px]'
      }`}
    >
      <div
        className={`md:w-full md:mt-4 flex items-center text-white p-4 ${
          collapsed ? 'justify-center' : 'justify-between'
        }`}
      >
        {!collapsed && (
          <Link href={role === 'admin' ? '/' : '/my-recommendations'}>
            <div className="flex gap-2 text-2xl items-center cursor-pointer">
              <RiHeartPulseFill className="text-2xl shrink-0 text-blue-400" />

              <span className="font-semibold tracking-wide">
                AACN AI
              </span>
            </div>
          </Link>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex bg-white/5 hover:bg-white/10 rounded-lg p-1 border border-white/10"
        >
          {collapsed ? (
            <RiArrowRightSLine className="text-2xl text-white" />
          ) : (
            <RiArrowLeftSLine className="text-2xl text-white" />
          )}
        </button>
      </div>

      <div className="flex md:flex-col ml-auto mr-5 text-white items-center md:items-stretch md:w-full md:gap-2 md:py-4 md:px-3">
        {!loadingRole &&
          menuItems.map((item) => (
            <NavLink
              key={item.address}
              text={item.text}
              address={item.address}
              icon={item.icon}
              collapsed={collapsed}
            />
          ))}
      </div>
    </div>
  )
}

export default Navbar