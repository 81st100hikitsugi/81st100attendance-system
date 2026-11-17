import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db, persistenceReady } from "./firebase.js";

export async function getUserProfile(user) {
  if (!user) return null;
  const snapshot = await getDoc(doc(db, "students", user.uid));
  if (!snapshot.exists()) return null;
  return { uid: user.uid, ...snapshot.data() };
}

/**
 * 新しい統合画面用の認証ガード。
 * roleは業務上の役職、isAdminはシステム管理者権限として独立させる。
 * isAdminがtrueのときだけ管理者と判定し、role名から推測しない。
 */
export function requireUser({ loginUrl = "../index.html", onReady, onError } = {}) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.replace(loginUrl);
      return;
    }

    try {
      const profile = await getUserProfile(user);
      if (!profile) {
        if (onError) onError(new Error("ユーザー情報が登録されていません。"));
        else window.location.replace(loginUrl);
        return;
      }
      if (onReady) await onReady({ user, profile });
    } catch (error) {
      console.error("ユーザー情報の取得に失敗しました:", error);
      if (onError) onError(error);
    }
  });
}

export function requireAdmin({ loginUrl = "../index.html", deniedUrl = "../employee_home.html", onReady, onError } = {}) {
  return requireUser({
    loginUrl,
    onReady: async (context) => {
      if (context.profile.isAdmin !== true) {
        window.location.replace(deniedUrl);
        return;
      }
      if (onReady) await onReady(context);
    },
    onError
  });
}

export async function logout(redirectUrl = "../index.html") {
  await signOut(auth);
  window.location.replace(redirectUrl);
}
