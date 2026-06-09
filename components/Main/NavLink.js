import React from 'react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { useRouter } from 'next/router'

const NavLink = ({ address, text, type, icon, collapsed }) => {
  const router = useRouter()

  const handleSignOut = () => {
    signOut()
    router.push('/login')
    localStorage.removeItem('userDoc')
  }

  const path = `${address || ''}`

  const isActive =
    (path === '/' && router.pathname === '/') ||
    router.pathname === path

  if (type === 'logout') {
    return (
      <div
        onClick={() => handleSignOut()}
        className="w-[95%] cursor-pointer mx-auto p-3 flex items-center gap-3 text-md hover:bg-white/10 rounded-xl transition-all duration-200"
      >
        {icon}
        {!collapsed && <p className="hidden md:block">{text}</p>}
      </div>
    )
  }

  return (
    <Link href={path}>
      <div
        className={`w-[95%] mx-auto p-3 flex items-center gap-3 rounded-xl transition-all duration-200 ${
          isActive
            ? 'bg-blue-500/20 text-blue-200 border border-blue-400/30 shadow-md'
            : 'text-white hover:bg-white/10'
        }`}
      >
        {icon}
        {!collapsed && <p className="hidden md:block font-medium">{text}</p>}
      </div>
    </Link>
  )
}

export default NavLink