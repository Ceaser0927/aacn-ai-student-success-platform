import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getClaims } from '../lib/auth'

export default function withAuth(Component, { role } = {}) {
  return function ProtectedPage(props) {
    const router = useRouter()
    const [checked, setChecked] = useState(false)

    useEffect(() => {
      let cancelled = false

      async function checkAuth() {
        const { role: currentRole } = await getClaims()

        if (cancelled) return

        if (!currentRole) {
          router.replace('/login')
          return
        }

        if (role && currentRole !== role) {
          router.replace(
            currentRole === 'admin' ? '/' : '/my-recommendations'
          )
          return
        }

        setChecked(true)
      }

      checkAuth()

      return () => {
        cancelled = true
      }
    }, [router])

    if (!checked) {
      return (
        <div className="min-h-screen flex items-center justify-center text-slate-400">
          Checking your session...
        </div>
      )
    }

    return <Component {...props} />
  }
}