import { logout } from "./auth.js";

const PAGE_BACK_LINKS = [
  { path: "employee_attendance.html", href: "./employee_home.html", label: "出勤管理へ戻る" },
  { path: "employee_history.html", href: "./employee_home.html", label: "出勤管理へ戻る" },
  { path: "employee_notifications.html", href: "./employee_home.html", label: "出勤管理へ戻る" },
  { path: "employee_shift.html", href: "./employee_home.html", label: "出勤管理へ戻る" },
  { path: "admin_shift_create.html", href: "./admin_home.html", label: "管理者メニューへ戻る" },
  { path: "admin_shift_attendance_all.html", href: "./admin_home.html", label: "管理者メニューへ戻る" },
  { path: "admin_late_early.html", href: "./admin_home.html", label: "管理者メニューへ戻る" },
  { path: "admin_notifications_create.html", href: "./admin_home.html", label: "管理者メニューへ戻る" },
  { path: "admin_students.html", href: "./admin_home.html", label: "管理者メニューへ戻る" },
  { path: "admin_work_plans.html", href: "./admin_home.html", label: "管理者メニューへ戻る" },
  { path: "wood/detail.html", href: "./index.html", label: "木材一覧へ戻る" },
  { path: "learning/subjects/subject.html", href: "../index.html", label: "学習情報一覧へ戻る" },
  { path: "learning/admin/dictionary.html", href: "../index.html", label: "学習情報一覧へ戻る" }
];

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

  shell.append(header);

  const currentPath = window.location.pathname;
  const backConfig = PAGE_BACK_LINKS.find((item) => currentPath.endsWith(item.path));
  if (backConfig) {
    const backRow = document.createElement("div");
    backRow.className = "app-page-back-row";
    const backLink = document.createElement("a");
    backLink.className = "app-page-back-link";
    backLink.href = backConfig.href;
    backLink.textContent = "← 戻る";
    backLink.setAttribute("aria-label", backConfig.label);
    backRow.append(backLink);
    shell.append(backRow);
  }

  const nav = document.createElement("nav");
  nav.className = "app-bottom-nav";
  nav.setAttribute("aria-label", "メインメニュー");

  for (const item of links) {
    const link = document.createElement("a");
    link.href = item.href;
    const icon = document.createElement("span");
    icon.className = "app-nav-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = item.icon || ({ home: "🏠", attendance: "🕒", learning: "📚", wood: "🪵" }[item.id] || "");
    const label = document.createElement("span");
    label.className = "app-nav-label";
    label.textContent = item.label;
    link.append(icon, label);
    link.className = item.id === active ? "app-nav-link is-active" : "app-nav-link";
    if (item.id === active) link.setAttribute("aria-current", "page");
    nav.append(link);
  }

  shell.append(nav);
  root.prepend(shell);
  document.body.classList.add("app-shell-ready");
  return shell;
}
