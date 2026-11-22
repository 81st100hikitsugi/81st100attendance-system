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
  { id: "home", label: "ホーム", icon: "home", href: "../home.html" },
  { id: "attendance", label: "出勤", icon: "attendance", href: "../employee_home.html" },
  { id: "learning", label: "学習", icon: "learning", href: "../learning/index.html" },
  { id: "wood", label: "木材", icon: "wood", href: "../wood/index.html" }
];

const NAV_ICON_FILES = {
  home: "home.svg",
  attendance: "attendance.svg",
  learning: "learning.svg",
  wood: "wood.svg"
};
const NAV_ICON_BASE = new URL("../assets/icons/", import.meta.url);

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
  const currentPath = window.location.pathname;
  const backConfig = PAGE_BACK_LINKS.find((item) => currentPath.endsWith(item.path));

  if (backConfig) {
    // 下層ページ：戻るボタンとページ名を一体化したヘッダー
    header.className = "app-page-header";

    const backLink = document.createElement("a");
    backLink.className = "app-page-back-link";
    backLink.href = backConfig.href;
    backLink.textContent = "＜";
    backLink.title = backConfig.label;
    backLink.setAttribute("aria-label", backConfig.label);

    const pageTitle = document.createElement("h1");
    pageTitle.className = "app-page-header-title";
    pageTitle.textContent = (document.title || "ページ").split(" - ")[0].trim();

    header.append(backLink, pageTitle);
  } else {
    // 各システムのホーム：ユーザー情報欄を廃止し、システム名だけを表示
    header.className = "app-home-header";
    const title = document.createElement("h1");
    title.className = "app-home-header-title";

    if (currentPath.endsWith("/learning/index.html")) {
      title.textContent = "学習情報管理";
    } else if (currentPath.endsWith("/wood/index.html")) {
      title.textContent = "木材管理";
    } else if (currentPath.endsWith("/employee_home.html") || currentPath.endsWith("/admin_home.html")) {
      title.textContent = "出勤管理";
    } else {
      title.textContent = "業務管理";
    }
    header.append(title);
  }
  shell.append(header);

  const nav = document.createElement("nav");
  nav.className = "app-bottom-nav";
  nav.setAttribute("aria-label", "メインメニュー");

  for (const item of links) {
    const link = document.createElement("a");
    link.href = item.href;
    const icon = document.createElement("img");
    icon.className = "app-nav-icon";
    icon.alt = "";
    icon.setAttribute("aria-hidden", "true");
    const iconKey = item.icon || item.id;
    const iconFile = NAV_ICON_FILES[iconKey];
    if (iconFile) { const iconUrl = new URL(iconFile, NAV_ICON_BASE); if (iconKey === "wood") iconUrl.searchParams.set("v", "20261122-3"); icon.src = iconUrl.href; }
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
