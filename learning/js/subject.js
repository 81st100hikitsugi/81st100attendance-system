import { db, persistenceReady } from "../../shared/firebase.js";
import { requireUser } from "../../shared/auth.js";
import { mountAppShell } from "../../shared/app-shell.js?v=20261120-8";
import {
  collection, getDocs, getDocsFromCache, query, where, doc, getDoc,
  getDocFromCache, addDoc, updateDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const $ = id => document.getElementById(id);
const subject = new URLSearchParams(location.search).get("subject") || "教科名";
let infos = [], dictionary = [], isAdmin = false, editingId = null, savedDocumentHtml = "";

$("subjectTitle").textContent = subject;
document.title = subject + " - 学習情報";
const links = [
  {id:"home",label:"ホーム",href:"../../home.html"},
  {id:"attendance",label:"出勤",href:"../../employee_home.html"},
  {id:"learning",label:"学習",href:"../index.html"},
  {id:"wood",label:"木材",href:"../../wood/index.html"}
];

function norm(value) {
  return String(value ?? "").normalize("NFKC").toLowerCase()
    .replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 96)).trim();
}
function matches(name, q) {
  if (!q) return true;
  const normalized = norm(name);
  if (normalized.includes(q)) return true;
  return dictionary.some(entry => {
    const base = norm(entry.baseWord);
    return base && normalized.includes(base) &&
      (entry.alternativeWords || []).some(word => norm(word).includes(q));
  });
}
function day(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
function periodEnd(period) {
  const today = day(new Date());
  if (period === "today") return today;
  if (period === "tomorrow") { today.setDate(today.getDate() + 1); return today; }
  if (period === "week") { today.setDate(today.getDate() + (7 - (today.getDay() || 7))); return today; }
  if (period === "month") return new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return null;
}
function millis(value) {
  return value?.toMillis?.() ?? (value ? new Date(value).getTime() || 0 : 0);
}
function dateText(value) {
  if (!value) return "";
  const [year, month, date] = value.split("-");
  return year + "年" + Number(month) + "月" + Number(date) + "日";
}
function safeHtml(html) {
  const parsed = new DOMParser().parseFromString(html || "", "text/html");
  const allowed = new Set(["P","H2","H3","H4","B","STRONG","SPAN","BR","UL","OL","LI","A"]);
  function clean(node) {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent);
    if (node.nodeType !== Node.ELEMENT_NODE) return document.createDocumentFragment();
    if (["SCRIPT","STYLE","IFRAME","OBJECT","EMBED","SVG","MATH"].includes(node.tagName)) return document.createDocumentFragment();
    const children = [...node.childNodes].map(clean);
    if (!allowed.has(node.tagName)) {
      const fragment = document.createDocumentFragment();
      children.forEach(child => fragment.append(child));
      return fragment;
    }
    const element = document.createElement(node.tagName.toLowerCase());
    children.forEach(child => element.append(child));
    if (node.tagName === "SPAN" && /^#[0-9a-f]{3,8}$/i.test(node.style.color)) element.style.color = node.style.color;
    if (node.tagName === "A") {
      try {
        const url = new URL(node.getAttribute("href"), location.origin);
        if (["http:","https:"].includes(url.protocol)) {
          element.href = url.href; element.target = "_blank"; element.rel = "noopener noreferrer";
        }
      } catch {}
    }
    return element;
  }
  const output = document.createElement("div");
  [...parsed.body.childNodes].map(clean).forEach(node => output.append(node));
  return output.innerHTML;
}

function closeAllInfoMenus() {
  document.querySelectorAll(".info-menu").forEach(menu => { menu.hidden = true; });
}
function closeInfoForm() {
  $("addInfoForm").reset();
  $("addInfoForm").hidden = true;
  $("addInfoButton").hidden = !isAdmin;
  $("infoError").hidden = true;
  $("infoError").textContent = "";
  editingId = null;
}
function openInfo(info = null) {
  if (!isAdmin) return;
  editingId = info?.id || null;
  $("addInfoForm").reset();
  $("infoDialogTitle").textContent = editingId ? "学習情報を編集" : info ? "学習情報を複製" : "学習情報の追加";
  $("infoName").value = info?.name || "";
  $("infoCategory").value = info?.category || "NONE";
  $("infoDueDate").value = info?.dueDate || "";
  $("infoNotes").value = info?.notes || "";
  $("infoError").hidden = true;
  $("infoError").textContent = "";
  $("addInfoForm").hidden = false;
  $("addInfoButton").hidden = true;
  $("infoName").focus();
}

function render() {
  const q = norm($("searchInput").value);
  const today = day(new Date());
  const expiredLimit = new Date(today);
  expiredLimit.setDate(expiredLimit.getDate() - 7);
  const endDate = periodEnd($("periodSelect").value);
  const rows = infos.filter(info => {
    if (info.subject !== subject) return false;
    if (info.category === "提出物" && !$("filterSubmission").checked) return false;
    if (info.category === "小テスト" && !$("filterTest").checked) return false;
    if (info.category === "NONE" && !$("filterNone").checked) return false;
    if (!matches(info.name, q)) return false;
    if (!info.dueDate) return true;
    const due = day(new Date(info.dueDate + "T00:00:00"));
    if (due < today) return $("showExpired").checked && due >= expiredLimit;
    return !endDate || due <= endDate;
  }).sort((a,b) => {
    if (!a.dueDate && !b.dueDate) return millis(b.createdAt) - millis(a.createdAt);
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate) || millis(b.createdAt) - millis(a.createdAt);
  });

  const list = $("learningInfoList");
  list.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "empty-message";
    empty.textContent = "該当する情報はありません。";
    list.append(empty);
    return;
  }

  rows.forEach(info => {
    const card = document.createElement("article");
    card.className = "learning-card";
    const title = document.createElement("h3");
    title.textContent = info.name || "（名称未設定）";
    card.append(title);

    const category = document.createElement("span");
    category.className = "category";
    category.textContent = info.category || "NONE";
    card.append(category);

    if (info.dueDate) {
      const due = document.createElement("p");
      due.className = "due-date";
      if (day(new Date(info.dueDate + "T00:00:00")) < today) due.classList.add("expired");
      due.textContent = "期限：" + dateText(info.dueDate);
      card.append(due);
    }
    if (info.notes) {
      const note = document.createElement("p");
      note.className = "note-text collapsed";
      note.textContent = info.notes;
      card.append(note);
      requestAnimationFrame(() => {
        if (note.scrollHeight > note.clientHeight + 1) {
          const toggle = document.createElement("button");
          toggle.type = "button";
          toggle.className = "note-toggle";
          toggle.textContent = "続きを読む";
          toggle.addEventListener("click", () => {
            const collapsed = note.classList.toggle("collapsed");
            toggle.textContent = collapsed ? "続きを読む" : "閉じる";
          });
          card.append(toggle);
        }
      });
    }

    if (isAdmin) {
      const container = document.createElement("div");
      container.className = "info-menu-container";
      const menuButton = document.createElement("button");
      menuButton.type = "button";
      menuButton.className = "info-menu-button";
      menuButton.textContent = "⋮";
      menuButton.setAttribute("aria-label", "情報メニュー");
      const menu = document.createElement("div");
      menu.className = "info-menu";
      menu.hidden = true;

      const edit = document.createElement("button");
      edit.type = "button";
      edit.textContent = "編集";
      edit.addEventListener("click", () => { closeAllInfoMenus(); openInfo(info); });

      const duplicate = document.createElement("button");
      duplicate.type = "button";
      duplicate.textContent = "複製";
      duplicate.addEventListener("click", () => {
        closeAllInfoMenus();
        openInfo({...info, id:null, name:(info.name || "") + "（コピー）"});
      });

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "delete-menu-button";
      remove.textContent = "削除";
      remove.addEventListener("click", () => { closeAllInfoMenus(); softDelete(info); });

      menu.append(edit, duplicate, remove);
      menuButton.addEventListener("click", event => {
        event.stopPropagation();
        const willOpen = menu.hidden;
        closeAllInfoMenus();
        menu.hidden = !willOpen;
      });
      container.append(menuButton, menu);
      card.append(container);
    }
    list.append(card);
  });
}

async function readDocs(reference) {
  try { return await getDocs(reference); }
  catch (error) { if (!navigator.onLine) return await getDocsFromCache(reference); throw error; }
}
async function readDoc(reference) {
  try { return await getDoc(reference); }
  catch (error) { if (!navigator.onLine) return await getDocFromCache(reference); throw error; }
}
async function load() {
  try {
    await persistenceReady;
    const [infoSnapshot, dictionarySnapshot, documentSnapshot] = await Promise.all([
      readDocs(query(collection(db, "learningInfos"), where("subject", "==", subject))),
      readDocs(collection(db, "searchDictionary")),
      readDoc(doc(db, "subjectDocuments", encodeURIComponent(subject)))
    ]);
    infos = infoSnapshot.docs.map(item => ({id:item.id, ...item.data()})).filter(item => !item.deletedAt);
    dictionary = dictionarySnapshot.docs.map(item => item.data());
    render();
    savedDocumentHtml = documentSnapshot.exists() ? safeHtml(documentSnapshot.data().content || "") : "";
    $("documentContent").innerHTML = savedDocumentHtml || "資料はありません。";
  } catch (error) {
    console.error(error);
    $("learningInfoList").textContent = "学習情報を読み込めませんでした。";
    $("documentContent").textContent = "資料を読み込めませんでした。";
    $("learningStatus").textContent = "アクセス権限を確認してください。";
  }
}
async function softDelete(info) {
  if (!isAdmin || !confirm("「" + info.name + "」を削除しますか？\n削除した情報は通常の一覧に表示されなくなります。")) return;
  try {
    await updateDoc(doc(db, "learningInfos", info.id), {
      deletedAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    await load();
  } catch (error) {
    console.error(error);
    $("learningStatus").textContent = "削除に失敗しました。Firestoreの権限を確認してください。";
  }
}

$("addInfoButton").addEventListener("click", () => openInfo());
$("cancelInfoButton").addEventListener("click", closeInfoForm);
$("addInfoForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!isAdmin) return;
  const data = {
    name:$("infoName").value.trim(), subject,
    category:$("infoCategory").value, notes:$("infoNotes").value.trim(),
    dueDate:$("infoDueDate").value || null, updatedAt:serverTimestamp()
  };
  if (!data.name) {
    $("infoError").textContent = "情報名を入力してください。";
    $("infoError").hidden = false;
    return;
  }
  const button = $("saveInfoButton");
  button.disabled = true;
  button.textContent = "保存中...";
  try {
    if (editingId) {
      await updateDoc(doc(db, "learningInfos", editingId), data);
    } else {
      await addDoc(collection(db, "learningInfos"), {
        ...data, createdAt:serverTimestamp(), deletedAt:null
      });
    }
    closeInfoForm();
    await load();
  } catch (error) {
    console.error(error);
    $("infoError").textContent = "保存に失敗しました。Firestoreの権限を確認してください。";
    $("infoError").hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = "保存";
  }
});

$("editDocumentButton").addEventListener("click", () => {
  if (!isAdmin) return;
  $("documentEditorArea").innerHTML = savedDocumentHtml;
  $("documentEditor").hidden = false;
  $("editDocumentButton").hidden = true;
});
$("cancelDocumentButton").addEventListener("click", () => {
  $("documentEditor").hidden = true;
  $("editDocumentButton").hidden = false;
});
function command(name, value = null) {
  $("documentEditorArea").focus();
  document.execCommand(name, false, value);
}
$("documentHeading").addEventListener("change", () => command("formatBlock", $("documentHeading").value));
$("documentBoldButton").addEventListener("click", () => command("bold"));
$("documentColorButton").addEventListener("click", () => command("foreColor", $("documentColor").value));
$("documentBulletButton").addEventListener("click", () => command("insertUnorderedList"));
$("documentNumberButton").addEventListener("click", () => command("insertOrderedList"));
$("documentLinkButton").addEventListener("click", () => {
  const url = prompt("https:// または http:// から始まるURLを入力してください。");
  if (url && /^https?:\/\//i.test(url)) command("createLink", url);
  else if (url) alert("URLを確認してください。");
});
$("saveDocumentButton").addEventListener("click", async () => {
  if (!isAdmin) return;
  const content = safeHtml($("documentEditorArea").innerHTML);
  const button = $("saveDocumentButton");
  button.disabled = true;
  try {
    await setDoc(doc(db, "subjectDocuments", encodeURIComponent(subject)), {
      subject, content, updatedAt:serverTimestamp()
    });
    savedDocumentHtml = content;
    $("documentContent").innerHTML = content || "資料はありません。";
    $("documentEditor").hidden = true;
    $("editDocumentButton").hidden = false;
    $("documentError").textContent = "";
  } catch (error) {
    console.error(error);
    $("documentError").textContent = "保存に失敗しました。Firestoreの権限を確認してください。";
  } finally {
    button.disabled = false;
  }
});

["searchInput","filterSubmission","filterTest","filterNone","showExpired","periodSelect"].forEach(id => {
  $(id).addEventListener("input", render);
  $(id).addEventListener("change", render);
});
document.addEventListener("click", closeAllInfoMenus);

requireUser({
  loginUrl:"../../index.html",
  onReady:async ({profile}) => {
    isAdmin = profile?.isAdmin === true;
    mountAppShell({active:"learning",profile,links,homeHref:"../../home.html",logoutUrl:"../../index.html"});
    $("addInfoButton").hidden = !isAdmin;
    $("documentAdminTools").hidden = !isAdmin;
    await load();
  },
  onError:() => { $("learningStatus").textContent = "ユーザー情報を確認できませんでした。"; }
});
