import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD4_no5RVBewR9vSXToRNcXr02LESmAx30",
  authDomain: "aacn-caf18.firebaseapp.com",
  projectId: "aacn-caf18",
  storageBucket: "aacn-caf18.firebasestorage.app",
  messagingSenderId: "1094672628859",
  appId: "1:1094672628859:web:32e3f42c658a8953c576de",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;