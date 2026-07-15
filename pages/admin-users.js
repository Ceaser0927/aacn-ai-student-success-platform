import Head from 'next/head'
import { useState, useEffect } from 'react'
import {
  RiShieldStarLine,
  RiShieldUserLine,
  RiSearchLine,
  RiAddLine,
  RiEditLine,
  RiDeleteBinLine,
} from 'react-icons/ri'
import { fetchWithAuth } from '../lib/auth'
import withAuth from '../components/withAuth'

function AdminUsers() {
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingUid, setUpdatingUid] = useState(null)
  const [myUid, setMyUid] = useState(null)

  const [showCreate, setShowCreate] = useState(false)
  const [editingUser, setEditingUser] = useState(null)

  const [form, setForm] = useState({
    email: '',
    password: '',
    role: 'student',
    subject_id: '',
    disabled: false,
  })

  useEffect(() => {
    loadUsers()

    import('../firebase').then(({ auth }) => {
      setMyUid(auth.currentUser?.uid || null)
    })
  }, [])

  async function loadUsers() {
    setLoading(true)
    setError('')

    try {
      const res = await fetchWithAuth('/admin/users')
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.detail || 'Failed to load users')
      }

      setUsers(data.users || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditingUser(null)
    setForm({
      email: '',
      password: '',
      role: 'student',
      subject_id: '',
      disabled: false,
    })
    setShowCreate(true)
  }

  function openEdit(user) {
    setShowCreate(false)
    setEditingUser(user)
    setForm({
      email: user.email || '',
      password: '',
      role: user.role || 'student',
      subject_id: user.subject_id || '',
      disabled: !!user.disabled,
    })
  }

  function closeModal() {
    setShowCreate(false)
    setEditingUser(null)
  }

  async function createUser() {
    setError('')

    try {
      const res = await fetchWithAuth('/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          role: form.role,
          subject_id: form.role === 'student' ? form.subject_id : null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.detail || 'Failed to create user')
      }

      closeModal()
      await loadUsers()
    } catch (err) {
      setError(err.message)
    }
  }

  async function updateUser() {
    if (!editingUser) return

    setUpdatingUid(editingUser.uid)
    setError('')

    try {
      const res = await fetchWithAuth('/admin/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: editingUser.uid,
          email: form.email,
          role: form.role,
          subject_id: form.role === 'student' ? form.subject_id : null,
          disabled: form.disabled,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.detail || 'Failed to update user')
      }

      closeModal()
      await loadUsers()
    } catch (err) {
      setError(err.message)
    } finally {
      setUpdatingUid(null)
    }
  }

  async function setRole(user, role) {
    setUpdatingUid(user.uid)
    setError('')

    let subjectId = user.subject_id || ''

    if (role === 'student') {
      subjectId = window.prompt(
        'Enter Subject ID for this student:',
        subjectId
      )

      if (!subjectId) {
        setUpdatingUid(null)
        return
      }
    }

    try {
      const res = await fetchWithAuth('/admin/users/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          role,
          subject_id: role === 'student' ? subjectId : null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.detail || 'Failed to update role')
      }

      await loadUsers()
    } catch (err) {
      setError(err.message)
    } finally {
      setUpdatingUid(null)
    }
  }

  async function deleteUser(user) {
    if (user.uid === myUid) {
      alert('You cannot delete your own account.')
      return
    }

    const confirmed = window.confirm(
      `Delete ${user.email}? This cannot be undone.`
    )

    if (!confirmed) return

    setUpdatingUid(user.uid)
    setError('')

    try {
      const res = await fetchWithAuth('/admin/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.detail || 'Failed to delete user')
      }

      await loadUsers()
    } catch (err) {
      setError(err.message)
    } finally {
      setUpdatingUid(null)
    }
  }

  const filteredUsers = users.filter((user) => {
    const keyword = search.toLowerCase().trim()

    if (!keyword) return true

    return (
      user.email?.toLowerCase().includes(keyword) ||
      user.role?.toLowerCase().includes(keyword) ||
      user.subject_id?.toString().toLowerCase().includes(keyword) ||
      user.display_name?.toLowerCase().includes(keyword)
    )
  })

  return (
    <div className="grow">
      <Head>
        <title>User Management | AACN AI</title>
      </Head>

      <main className="h-full grow flex flex-col gap-6 overflow-auto">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
            <p className="text-sm text-slate-500">
              {filteredUsers.length} of {users.length} users
            </p>

            <div className="flex gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-96">
                <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search email, role, or student ID..."
                  className="w-full border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                />
              </div>

              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 bg-blue-600 text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-blue-700"
              >
                <RiAddLine />
                Create User
              </button>
            </div>
          </div>

          {loading && (
            <div className="text-center text-slate-500 py-8">
              Loading users...
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mt-4">
              {error}
            </div>
          )}

          {!loading && !error && (
            <table className="w-full mt-4">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-sm text-slate-600">
                  <th className="text-left p-3 font-semibold">Email</th>
                  <th className="text-left p-3 font-semibold">Student ID</th>
                  <th className="text-left p-3 font-semibold">Role</th>
                  <th className="text-left p-3 font-semibold">Status</th>
                  <th className="text-left p-3 font-semibold">Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.uid} className="border-b border-slate-100">
                    <td className="p-3 font-medium text-slate-900">
                      {user.email || '--'}
                    </td>

                    <td className="p-3 text-slate-500">
                      {user.subject_id || '--'}
                    </td>

                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${
                          user.role === 'admin'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {user.role === 'admin' ? (
                          <RiShieldStarLine />
                        ) : (
                          <RiShieldUserLine />
                        )}
                        {user.role}
                      </span>
                    </td>

                    <td className="p-3">
                      {user.disabled ? (
                        <span className="text-red-600">Disabled</span>
                      ) : (
                        <span className="text-green-600">Active</span>
                      )}
                    </td>

                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        {user.role === 'admin' ? (
                          <button
                            onClick={() => setRole(user, 'student')}
                            disabled={updatingUid === user.uid || user.uid === myUid}
                            className="text-sm text-slate-600 border border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40"
                          >
                            Remove admin
                          </button>
                        ) : (
                          <button
                            onClick={() => setRole(user, 'admin')}
                            disabled={updatingUid === user.uid}
                            className="text-sm text-white bg-blue-600 rounded-lg px-3 py-1.5 hover:bg-blue-700 disabled:opacity-40"
                          >
                            Make admin
                          </button>
                        )}

                        <button
                          onClick={() => openEdit(user)}
                          disabled={updatingUid === user.uid}
                          className="inline-flex items-center gap-1 text-sm text-slate-700 border border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40"
                        >
                          <RiEditLine />
                          Edit
                        </button>

                        <button
                          onClick={() => deleteUser(user)}
                          disabled={updatingUid === user.uid || user.uid === myUid}
                          className="inline-flex items-center gap-1 text-sm text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 disabled:opacity-40"
                        >
                          <RiDeleteBinLine />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan="5" className="text-center text-slate-400 py-8">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {(showCreate || editingUser) && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-slate-900">
              {showCreate ? 'Create User' : 'Edit User'}
            </h2>

            <div className="space-y-4 mt-5">
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  className="w-full border border-slate-300 rounded-xl px-3 py-2"
                />
              </div>

              {showCreate && (
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, password: e.target.value }))
                    }
                    className="w-full border border-slate-300 rounded-xl px-3 py-2"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">
                  Role
                </label>
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, role: e.target.value }))
                  }
                  className="w-full border border-slate-300 rounded-xl px-3 py-2"
                >
                  <option value="student">Student</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {form.role === 'student' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">
                    Student ID
                  </label>
                  <input
                    type="text"
                    value={form.subject_id}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, subject_id: e.target.value }))
                    }
                    className="w-full border border-slate-300 rounded-xl px-3 py-2"
                  />
                </div>
              )}

              {editingUser && (
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={form.disabled}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, disabled: e.target.checked }))
                    }
                  />
                  Disable this user
                </label>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={closeModal}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700"
              >
                Cancel
              </button>

              <button
                onClick={showCreate ? createUser : updateUser}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
              >
                {showCreate ? 'Create' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default withAuth(AdminUsers, { role: 'admin' })