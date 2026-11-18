
// Firebaseに登録した管理者のメールアドレス
const ADMIN_EMAIL = "hina_takahashi@icloud.com";

const loginForm = document.getElementById("loginForm");
const passwordInput = document.getElementById("passwordInput");
const errorMessage = document.getElementById("errorMessage");
const loginButton = document.getElementById("loginButton");

loginForm.addEventListener("submit", async event => {
  event.preventDefault();

  const password = passwordInput.value;

  errorMessage.hidden = true;
  loginButton.disabled = true;
  loginButton.textContent = "ログイン中...";

  try {
    await firebase.auth().signInWithEmailAndPassword(
      ADMIN_EMAIL,
      password
    );

    // ログイン前に開いていたページへ戻る
    const referrer = document.referrer;
    let returnUrl = new URL("../index.html", window.location.href);

    if (referrer) {
      const previousUrl = new URL(referrer);

      if (
        previousUrl.origin === window.location.origin &&
        !previousUrl.pathname.endsWith("/admin/login.html")
      ) {
        returnUrl = previousUrl;
      }
    }

    window.location.replace(returnUrl.href);

  } catch (error) {
    errorMessage.textContent =
      "パスワードが正しくありません。もう一度入力してください。";

    errorMessage.hidden = false;
    passwordInput.value = "";
    passwordInput.focus();

  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "ログイン";
  }
});
