import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDtBjVT9p1JlwLZhKRLzq5secW2YyD1U0U",
  authDomain: "attendance-system-eb7d1.firebaseapp.com",
  projectId: "attendance-system-eb7d1",
  storageBucket: "attendance-system-eb7d1.firebasestorage.app",
  messagingSenderId: "803269635846",
  appId: "1:803269635846:web:6e12018f4b2db2c0747887"
};

// 既存ページとの共存を考慮し、初期化済みアプリがあれば再利用する。
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
