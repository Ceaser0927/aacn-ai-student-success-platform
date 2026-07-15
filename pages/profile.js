import { useEffect, useState } from 'react'
import { getClaims, getCurrentFirebaseUser } from '../lib/auth'

export default function Profile() {
  const [role, setRole] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    async function load() {
      const claims = await getClaims()
      const user = getCurrentFirebaseUser()

      setRole(claims.role || 'student')
      setSubjectId(claims.subject_id || '')
      setEmail(user?.email || '')
    }

    load()
  }, [])

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
      <p className="text-slate-500 mt-2">View your account information.</p>

      <div className="mt-6 space-y-4">
        <div>
          <p className="text-sm text-slate-500">Email</p>
          <p className="font-semibold text-slate-900">{email || '--'}</p>
        </div>

        <div>
          <p className="text-sm text-slate-500">Role</p>
          <p className="font-semibold text-slate-900 capitalize">{role || '--'}</p>
        </div>

        {subjectId && (
          <div>
            <p className="text-sm text-slate-500">Subject ID</p>
            <p className="font-semibold text-slate-900">{subjectId}</p>
          </div>
        )}
      </div>
    </div>
  )
}