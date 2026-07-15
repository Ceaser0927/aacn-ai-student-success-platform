export default function Settings() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
      <p className="text-slate-500 mt-2">
        Account and notification settings will appear here.
      </p>

      <div className="mt-6 space-y-4">
        <div className="border border-slate-200 rounded-xl p-4">
          <p className="font-semibold text-slate-900">Notifications</p>
          <p className="text-sm text-slate-500 mt-1">
            Manage email and portal notification preferences.
          </p>
        </div>

        <div className="border border-slate-200 rounded-xl p-4">
          <p className="font-semibold text-slate-900">Appearance</p>
          <p className="text-sm text-slate-500 mt-1">
            Theme and display settings will be added later.
          </p>
        </div>
      </div>
    </div>
  )
}