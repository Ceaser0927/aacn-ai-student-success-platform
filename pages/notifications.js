import { useEffect, useState } from 'react'
import { fetchWithAuth } from '../lib/auth'

export default function Notifications() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadNotifications() {
    setLoading(true)
    setError('')

    try {
      const res = await fetchWithAuth('/notifications')
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.detail || 'Failed to load notifications')
      }

      setItems(data.items || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function markAsRead(id) {
    try {
      await fetchWithAuth(`/notifications/read/${id}`, {
        method: 'POST',
      })

      await loadNotifications()
    } catch (err) {
      alert(err.message)
    }
  }

  useEffect(() => {
    loadNotifications()
  }, [])

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
      <p className="text-slate-500 mt-2">
        View system updates, recommendation alerts, and account notifications.
      </p>

      {loading && (
        <div className="text-slate-500 py-8">Loading notifications...</div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mt-4">
          {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="text-slate-500 py-8">No notifications yet.</div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="mt-6 space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={`border rounded-xl p-4 ${
                item.read
                  ? 'border-slate-200 bg-white'
                  : 'border-blue-200 bg-blue-50'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-slate-900">
                    {item.title}
                  </p>

                  <p className="text-sm text-slate-600 mt-1">
                    {item.body}
                  </p>

                  <p className="text-xs text-slate-400 mt-2">
                    {item.created_at}
                  </p>
                </div>

                {!item.read && (
                  <button
                    onClick={() => markAsRead(item.id)}
                    className="text-sm text-blue-600 font-semibold"
                  >
                    Mark read
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}