import '../styles/globals.css'
import { RecoilRoot } from 'recoil'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Container from '../components/Main/Container'
import { getClaims } from '../lib/auth'

const publicPages = [
  '/login',
  '/signup',
]

const studentPages = [
  '/my-recommendations',
  '/profile',
  '/settings',
  '/notifications',
]
const adminPages = [
  '/',
  '/students',
  '/risk-analysis',
  '/recommendations',
  '/reports',
  '/data-import',
  '/admin-users',
  '/profile',
  '/settings',
  '/notifications',
]

function AuthGate({ children }) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function checkAuth() {
      const path = router.pathname

      if (publicPages.includes(path)) {
        if (!cancelled) setChecking(false)
        return
      }

      const claims = await getClaims()
      const role = claims.role

      if (cancelled) return

      if (!role) {
        router.replace('/login')
        return
      }

      if (role === 'student' && !studentPages.includes(path)) {
        router.replace('/my-recommendations')
        return
      }

      if (role === 'admin' && !adminPages.includes(path)) {
        router.replace('/')
        return
      }

      setChecking(false)
    }

    setChecking(true)
    checkAuth()

    return () => {
      cancelled = true
    }
  }, [router.pathname])

  if (checking && !publicPages.includes(router.pathname)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Checking your session...
      </div>
    )
  }

  return children
}

function MyApp({ Component, pageProps }) {
  if (Component.getLayout) {
    return (
      <RecoilRoot>
        <AuthGate>
          {Component.getLayout(<Component {...pageProps} />)}
        </AuthGate>
      </RecoilRoot>
    )
  }

  return (
    <RecoilRoot>
      <AuthGate>
        <Container>
          <Component {...pageProps} />
        </Container>
      </AuthGate>
    </RecoilRoot>
  )
}

export default MyApp