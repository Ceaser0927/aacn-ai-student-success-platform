import React, { useState } from 'react'
import { useRouter } from 'next/router'
import { register } from '../../lib/auth'
import {
  RiHeartPulseFill,
  RiArrowRightLine,
  RiMailLine,
  RiLockPasswordLine,
  RiUserLine,
} from 'react-icons/ri'

const SignUp = () => {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await register(email, password, subjectId)
      router.push('/my-risk')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc] flex">
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(37,99,235,0.22),transparent_30%),radial-gradient(circle_at_75%_75%,rgba(14,165,233,0.12),transparent_32%)]" />

        <div className="absolute inset-0 opacity-[0.06] bg-[linear-gradient(rgba(255,255,255,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.8)_1px,transparent_1px)] bg-[size:64px_64px]" />

        <div className="relative z-10 w-full p-14 flex flex-col justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/25">
              <RiHeartPulseFill className="text-2xl" />
            </div>

            <div>
              <div className="text-3xl font-bold text-white tracking-tight">
                AACN AI
              </div>
              <div className="text-xs font-semibold tracking-[0.28em] text-blue-200 uppercase">
                Medical Intelligence
              </div>
            </div>
          </div>

          <div className="max-w-2xl mb-20">
            <h1 className="text-6xl font-bold leading-tight tracking-tight text-white">
              Create your secure workspace.
            </h1>

            <p className="text-xl text-slate-300 leading-8 mt-6 max-w-xl">
              Access predictive insights and AI-assisted recommendations through
              a protected AACN AI account.
            </p>

            <div className="mt-10 h-1.5 w-40 rounded-full bg-blue-500" />
          </div>

          <div className="text-sm text-slate-500">
            Secure access · Predictive analytics · AI assistance
          </div>
        </div>
      </div>

      <div className="w-full lg:w-[520px] flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center">
              <RiHeartPulseFill className="text-xl" />
            </div>

            <div>
              <div className="text-2xl font-bold text-slate-950">
                AACN AI
              </div>
              <div className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase">
                Medical Intelligence
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-8">
            <h1 className="text-3xl font-bold text-slate-950">
              Create account
            </h1>

            <p className="text-slate-500 mt-2 mb-8">
              Register to access your workspace.
            </p>

            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1.5">
                  Email
                </label>

                <div className="relative">
                  <RiMailLine className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1.5">
                  Password
                </label>

                <div className="relative">
                  <RiLockPasswordLine className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
                    placeholder="Minimum 6 characters"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1.5">
                  Subject ID
                </label>

                <div className="relative">
                  <RiUserLine className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    placeholder="Example: S5-001"
                    className="w-full border border-slate-300 rounded-xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
                  />
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="group w-full bg-slate-950 text-white rounded-xl px-4 py-3 font-semibold hover:bg-blue-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? 'Creating account...' : 'Create account'}
                {!loading && (
                  <RiArrowRightLine className="transition group-hover:translate-x-1" />
                )}
              </button>
            </form>

            <p className="text-sm text-slate-500 mt-6 text-center">
              Already have an account?{' '}
              <a href="/login" className="text-blue-600 font-semibold hover:underline">
                Log in
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SignUp