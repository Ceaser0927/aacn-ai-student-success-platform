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

  const baseClass = collapsed
    ? 'w-10 h-10 mx-auto flex items-center justify-center rounded-xl transition-all duration-200'
    : 'w-[95%] mx-auto p-3 flex items-center gap-3 rounded-xl transition-all duration-200'

  if (type === 'logout') {
    return (
      <div
        onClick={() => handleSignOut()}
        className={`${baseClass} cursor-pointer text-white hover:bg-white/10`}
      >
        {icon}
        {!collapsed && <p className="hidden md:block">{text}</p>}
      </div>
    )
  }

  return (
    <Link href={path}>
      <div
        className={`${baseClass} ${
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