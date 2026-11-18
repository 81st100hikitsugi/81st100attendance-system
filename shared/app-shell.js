import { logout } from "./auth.js";

const DEFAULT_LINKS = [
  { id: "home", label: "ホーム", icon: "🏠", href: "../home.html" },
  { id: "attendance", label: "出勤", icon: "🕒", href: "../employee_home.html" },
  { id: "learning", label: "学習", icon: "📚", href: "../learning/index.html" },
  { id: "wood", label: "木材", icon: "🪵", href: "../wood/index.html" }
];

export function mountAppShell({
  active = "",
  profile = {},
  links = DEFAULT_LINKS,
  root = document.body,
  homeHref = "../home.html",
  logoutUrl = "../index.html"
} = {}) {
  const shell = document.createElement("div");
  shell.className = "app-shell";

  const header = document.createElement("header");
  header.className = "app-header";

  const brand = document.createElement("a");
  brand.className = "app-brand";
  brand.href = homeHref;
  brand.textContent = "業務管理";

  const userArea = document.createElement("div");
  userArea.className = "app-user-area";

  const userName = document.createElement("span");
  userName.className = "app-user-name";
  userName.textContent = profile.name || profile.email || "ユーザー";

  const logoutButton = document.createElement("button");
  logoutButton.className = "app-logout";
  logoutButton.type = "button";
  logoutButton.textContent = "ログアウト";
  logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    try {
      await logout(logoutUrl);
    } catch (error) {
      console.error("ログアウトに失敗しました:", error);
      logoutButton.disabled = false;
      alert("ログアウトに失敗しました。通信状態を確認してください。");
    }
  });

  userArea.append(userName, logoutButton);
  header.append(brand, userArea);

  const nav = document.createElement("nav");
  nav.className = "app-bottom-nav";
  nav.setAttribute("aria-label", "メインメニュー");

  for (const item of links) {
    const link = document.createElement("a");
    link.href = item.href;
    const icon = document.createElement("span");
    icon.className = "app-nav-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = item.icon || "";
    const label = document.createElement("span");
    label.className = "app-nav-label";
    label.textContent = item.label;
    link.append(icon, label);
    link.className = item.id === active ? "app-nav-link is-active" : "app-nav-link";
    if (item.id === active) link.setAttribute("aria-current", "page");
    nav.append(link);
  }

  shell.append(header, nav);
  root.prepend(shell);
  return shell;
}
