// lib/auth.js
//
// Firebase-based auth helper. Firebase Auth handles the actual
// login/session/token refresh -- this file just wraps it with the
// register/login/logout/fetchWithAuth shape the rest of the app expects,
// plus fetching "role" (a custom claim only settable by the backend).

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { auth } from '../firebase'

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000/api'

// Registration is two steps: (1) create the Firebase Auth account on the
// client, (2) tell the backend about it so it can set role='student' +
// subject_id as custom claims (only the backend/Admin SDK can set custom
// claims -- there's no client-side way to do this, by design).
export async function register(email, password, subjectId) {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  const idToken = await cred.user.getIdToken()

  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ subject_id: subjectId }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Registration failed')

  // Custom claims set just now aren't in the token we already have --
  // force a refresh so getRole() reflects the new role immediately.
  await cred.user.getIdToken(true)

  return { role: data.role, subject_id: data.subject_id }
}

export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password)

  const idTokenResult = await cred.user.getIdTokenResult(true)

  return {
    role: idTokenResult.claims.role || 'student',
    subject_id: idTokenResult.claims.subject_id || null,
  }
}

export async function logout() {
  await signOut(auth)
}

// Returns a Promise that resolves with the current Firebase ID token, or
// null if nobody is logged in. Use this instead of reading localStorage.
export function getToken() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe()
      if (!user) return resolve(null)
      resolve(await user.getIdToken())
    })
  })
}

export function getCurrentFirebaseUser() {
  return auth.currentUser
}

// Reads role/subject_id from the current ID token's custom claims.
// Returns { role: null, subject_id: null } if nobody is logged in.
export function getClaims() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe()

      if (!user) {
        return resolve({ role: null, subject_id: null })
      }

      const result = await user.getIdTokenResult(true)

      resolve({
        role: result.claims.role || null,
        subject_id: result.claims.subject_id || null,
      })
    })
  })
}

export async function fetchWithAuth(path, options = {}) {
  const token = await getToken()
  const headers = {
    ...(options.headers || {}),
    Authorization: token ? `Bearer ${token}` : '',
  }
  return fetch(`${API_BASE}${path}`, { ...options, headers })
}