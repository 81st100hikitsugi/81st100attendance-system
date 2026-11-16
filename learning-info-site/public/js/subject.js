const params = new URLSearchParams(window.location.search);
const subjectName = params.get("subject") || "教科名";

// ページタイトル
document.getElementById("subjectTitle").textContent = subjectName;
document.title = subjectName + " - 学習情報管理";

// 同じサイト内から移動してきた場合は前のページに戻る
document.getElementById("backLink").addEventListener("click", event => {
  const referrer = document.referrer;

  if (referrer && new URL(referrer).origin === window.location.origin) {
    event.preventDefault();
    history.back();
  }
});

// 学習情報
let learningInfos = [];
let dictionaryEntries = [];
let isAdmin = false;
let editingInfoId = null;

// HTML要素：学習情報
const addInfoButton = document.getElementById("addInfoButton");
const addInfoForm = document.getElementById("addInfoForm");
const cancelInfoButton = document.getElementById("cancelInfoButton");
const saveInfoButton = document.getElementById("saveInfoButton");
const addInfoError = document.getElementById("addInfoError");

const nameInput = document.getElementById("newInfoName");
const categoryInput = document.getElementById("newInfoCategory");
const notesInput = document.getElementById("newInfoNotes");
const dueDateInput = document.getElementById("newInfoDueDate");

// HTML要素：管理者用資料
const editDocumentButton = document.getElementById("editDocumentButton");
const documentEditor = document.getElementById("documentEditor");
const documentContent = document.getElementById("documentContent");
const documentEditorArea = document.getElementById("documentEditorArea");
const documentError = document.getElementById("documentError");

const saveDocumentButton = document.getElementById("saveDocumentButton");
const cancelDocumentButton = document.getElementById("cancelDocumentButton");

const documentHeading = document.getElementById("documentHeading");
const documentBoldButton = document.getElementById("documentBoldButton");
const documentColor = document.getElementById("documentColor");
const documentColorButton = document.getElementById("documentColorButton");
const documentBulletButton = document.getElementById("documentBulletButton");
const documentNumberButton = document.getElementById("documentNumberButton");
const documentLinkButton = document.getElementById("documentLinkButton");

// 資料の保存内容
let savedDocumentHtml = "";

// 日付のみを取得
function getDateOnly(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// 期間フィルター
function getPeriodEnd(period) {
  const today = getDateOnly(new Date());

  if (period === "today") return today;

  if (period === "tomorrow") {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }

  if (period === "week") {
    const end = new Date(today);
    const daysUntilSunday = 7 - (today.getDay() || 7);
    end.setDate(end.getDate() + daysUntilSunday);
    return end;
  }

  if (period === "month") {
    return new Date(today.getFullYear(), today.getMonth() + 1, 0);
  }

  return null;
}

// 日付表示
function formatDate(dateString) {
  if (!dateString) return "";

  const [year, month, day] = dateString.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

// FirestoreのTimestampにも対応した日時取得
function getCreatedTime(value) {
  if (value && typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (value) {
    return new Date(value).getTime() || 0;
  }

  return 0;
}

// 検索用辞書を取得
async function loadSearchDictionary() {
  try {
    const snapshot = await firebase.firestore()
      .collection("searchDictionary")
      .get();

    dictionaryEntries = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

  } catch (error) {
    console.error("辞書の取得に失敗しました:", error);
    dictionaryEntries = [];
  }
}

// Firestoreから、この教科の情報を取得
async function loadLearningInfos() {
  try {
    await loadSearchDictionary();

    const snapshot = await firebase.firestore()
      .collection("learningInfos")
      .where("subject", "==", subjectName)
      .get();

    learningInfos = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .filter(info => !info.deletedAt);

    renderLearningInfos();

  } catch (error) {
    console.error("学習情報の取得に失敗しました:", error);
    alert("学習情報を取得できませんでした。");
  }
}

// 表示する学習情報を絞り込む
function getFilteredInfos() {
  const searchText = normalizeSearchText(
    document.getElementById("searchInput").value
  );

  const showSubmission =
    document.getElementById("filterSubmission").checked;

  const showTest =
    document.getElementById("filterTest").checked;

  const showNone =
    document.getElementById("filterNone").checked;

  const showExpired =
    document.getElementById("showExpired").checked;

  const period =
    document.getElementById("periodSelect").value;

  const today = getDateOnly(new Date());

  const expiredLimit = new Date(today);
  expiredLimit.setDate(expiredLimit.getDate() - 7);

  const periodEnd = getPeriodEnd(period);

  return learningInfos.filter(info => {
    if (info.subject !== subjectName) return false;

    if (info.category === "提出物" && !showSubmission) return false;
    if (info.category === "小テスト" && !showTest) return false;
    if (info.category === "NONE" && !showNone) return false;

    // 通常検索と辞書検索
    if (
      searchText &&
      !matchesDictionarySearch(
        info.name,
        searchText,
        dictionaryEntries
      )
    ) {
      return false;
    }

    // 期限なしは常に表示
    if (!info.dueDate) return true;

    const dueDate = getDateOnly(
      new Date(info.dueDate + "T00:00:00")
    );

    // 期限切れは直近7日分だけ表示
    if (dueDate < today) {
      return showExpired && dueDate >= expiredLimit;
    }

    if (periodEnd && dueDate > periodEnd) return false;

    return true;
  });
}

// 期限が早い順、同じ期限なら登録日時が新しい順
// 期限なしは最後
function sortInfos(infos) {
  return [...infos].sort((a, b) => {
    if (!a.dueDate && b.dueDate) return 1;
    if (a.dueDate && !b.dueDate) return -1;

    if (a.dueDate && b.dueDate) {
      const difference = a.dueDate.localeCompare(b.dueDate);
      if (difference !== 0) return difference;
    }

    return getCreatedTime(b.createdAt) - getCreatedTime(a.createdAt);
  });
}

// 追加・編集フォームを開く
function openInfoForm(info = null, mode = "add") {
  if (!isAdmin) return;

  editingInfoId = mode === "edit" && info ? info.id : null;

  addInfoError.hidden = true;
  addInfoForm.reset();

  if (info) {
    nameInput.value = info.name || "";
    categoryInput.value = info.category || "NONE";
    notesInput.value = info.notes || "";
    dueDateInput.value = info.dueDate || "";
  }

  saveInfoButton.textContent = "保存";
  addInfoForm.hidden = false;
  addInfoButton.hidden = true;

  nameInput.focus();
}

// フォームを閉じる
function closeInfoForm() {
  addInfoForm.reset();
  addInfoForm.hidden = true;
  addInfoButton.hidden = !isAdmin;
  addInfoError.hidden = true;
  editingInfoId = null;
  saveInfoButton.textContent = "保存";
}

// 学習情報を表示する
function renderLearningInfos() {
  const list = document.getElementById("learningInfoList");
  list.innerHTML = "";

  const infos = sortInfos(getFilteredInfos());

  if (infos.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-message";
    empty.textContent = "該当する情報はありません。";
    list.appendChild(empty);
    return;
  }

  const today = getDateOnly(new Date());

  infos.forEach(info => {
    const card = document.createElement("article");
    card.className = "learning-card";

    const title = document.createElement("h3");
    title.textContent = info.name;
    card.appendChild(title);

    const category = document.createElement("span");
    category.className = "category";
    category.textContent = info.category || "NONE";
    card.appendChild(category);

    if (info.dueDate) {
      const dueDate = document.createElement("p");
      dueDate.className = "due-date";

      const date = getDateOnly(
        new Date(info.dueDate + "T00:00:00")
      );

      if (date < today) {
        dueDate.classList.add("expired");
      }

      dueDate.textContent = "期限：" + formatDate(info.dueDate);
      card.appendChild(dueDate);
    }

    if (info.notes) {
      const note = document.createElement("p");
      note.className = "note-text collapsed";
      note.textContent = info.notes;
      card.appendChild(note);

      requestAnimationFrame(() => {
        if (note.scrollHeight > note.clientHeight + 1) {
          const toggle = document.createElement("button");
          toggle.className = "note-toggle";
          toggle.type = "button";
          toggle.textContent = "続きを読む";

          toggle.addEventListener("click", () => {
            const collapsed = note.classList.toggle("collapsed");
            toggle.textContent = collapsed ? "続きを読む" : "閉じる";
          });

          card.appendChild(toggle);
        }
      });
    }

    // 管理者専用の三点メニュー
    if (isAdmin) {
      const menuContainer = document.createElement("div");
      menuContainer.className = "info-menu-container";

      const menuButton = document.createElement("button");
      menuButton.type = "button";
      menuButton.className = "info-menu-button";
      menuButton.textContent = "⋮";
      menuButton.setAttribute("aria-label", "情報メニュー");

      const menu = document.createElement("div");
      menu.className = "info-menu";
      menu.hidden = true;

      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.textContent = "編集";
      editButton.addEventListener("click", () => {
        closeAllInfoMenus();
        openInfoForm(info, "edit");
      });

      const duplicateButton = document.createElement("button");
      duplicateButton.type = "button";
      duplicateButton.textContent = "複製";
      duplicateButton.addEventListener("click", () => {
        closeAllInfoMenus();
        openInfoForm(info, "duplicate");
      });

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.textContent = "削除";
      deleteButton.className = "delete-menu-button";
      deleteButton.addEventListener("click", async () => {
        closeAllInfoMenus();
        await deleteLearningInfo(info);
      });

      menu.appendChild(editButton);
      menu.appendChild(duplicateButton);
      menu.appendChild(deleteButton);

      menuButton.addEventListener("click", event => {
        event.stopPropagation();

        const willOpen = menu.hidden;
        closeAllInfoMenus();
        menu.hidden = !willOpen;
      });

      menuContainer.appendChild(menuButton);
      menuContainer.appendChild(menu);
      card.appendChild(menuContainer);
    }

    list.appendChild(card);
  });
}

// 開いているメニューをすべて閉じる
function closeAllInfoMenus() {
  document.querySelectorAll(".info-menu").forEach(menu => {
    menu.hidden = true;
  });
}

// 画面の別の場所をクリックしたらメニューを閉じる
document.addEventListener("click", closeAllInfoMenus);

// 学習情報を削除済みにする
async function deleteLearningInfo(info) {
  if (!isAdmin) {
    alert("管理者のみ削除できます。");
    return;
  }

  const confirmed = confirm(
    `「${info.name}」を削除しますか？\n削除した情報は通常の一覧に表示されなくなります。`
  );

  if (!confirmed) return;

  try {
    await firebase.firestore()
      .collection("learningInfos")
      .doc(info.id)
      .update({
        deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

    await loadLearningInfos();

    alert("情報を削除しました。");

  } catch (error) {
    console.error("削除に失敗しました:", error);
    alert("削除に失敗しました。時間をおいて再度お試しください。");
  }
}

// フィルターの変更を反映
[
  "searchInput",
  "filterSubmission",
  "filterTest",
  "filterNone",
  "showExpired",
  "periodSelect"
].forEach(id => {
  const element = document.getElementById(id);
  element.addEventListener("input", renderLearningInfos);
  element.addEventListener("change", renderLearningInfos);
});

// 追加ボタン
addInfoButton.addEventListener("click", () => {
  openInfoForm();
});

// フォームを閉じる
cancelInfoButton.addEventListener("click", closeInfoForm);

// 学習情報をFirestoreに保存
addInfoForm.addEventListener("submit", async event => {
  event.preventDefault();

  if (!isAdmin) {
    alert("管理者のみ保存できます。");
    return;
  }

  const name = nameInput.value.trim();
  const category = categoryInput.value;
  const notes = notesInput.value.trim();
  const dueDate = dueDateInput.value;

  if (!name) {
    addInfoError.textContent = "情報名を入力してください。";
    addInfoError.hidden = false;
    return;
  }

  saveInfoButton.disabled = true;
  saveInfoButton.textContent = "保存中...";

  const wasEditing = Boolean(editingInfoId);

  try {
    const db = firebase.firestore();
    const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp();

    if (editingInfoId) {
      // 既存情報を編集
      await db.collection("learningInfos")
        .doc(editingInfoId)
        .update({
          name,
          category,
          notes,
          dueDate: dueDate || null,
          updatedAt: serverTimestamp
        });

    } else {
      // 新規追加または複製
      await db.collection("learningInfos").add({
        name,
        subject: subjectName,
        category,
        notes,
        dueDate: dueDate || null,
        createdAt: serverTimestamp,
        updatedAt: serverTimestamp,
        deletedAt: null
      });
    }

    closeInfoForm();
    await loadLearningInfos();

    alert(wasEditing ? "学習情報を更新しました。" : "学習情報を保存しました。");

  } catch (error) {
    console.error("保存に失敗しました:", error);

    addInfoError.textContent =
      "保存に失敗しました。時間をおいて再度お試しください。";

    addInfoError.hidden = false;

  } finally {
    saveInfoButton.disabled = false;
    saveInfoButton.textContent = "保存";
  }
});


// ========================================
// 管理者用資料
// ========================================

// HTMLを安全な形式に変換する
function sanitizeDocumentHtml(html) {
  const parsed = new DOMParser().parseFromString(html, "text/html");

  const allowedTags = new Set([
    "P", "H2", "H3", "H4",
    "B", "STRONG", "SPAN", "BR",
    "UL", "OL", "LI", "A"
  ]);

  function cleanNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent);
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return document.createDocumentFragment();
    }

    const tag = node.tagName;

    // 危険な要素は中身ごと削除
    if ([
      "SCRIPT", "STYLE", "IFRAME",
      "OBJECT", "EMBED", "SVG", "MATH"
    ].includes(tag)) {
      return document.createDocumentFragment();
    }

    const children = Array.from(node.childNodes).map(cleanNode);

    // 許可していないタグはタグだけ外して中身を残す
    if (!allowedTags.has(tag)) {
      const fragment = document.createDocumentFragment();
      children.forEach(child => fragment.appendChild(child));
      return fragment;
    }

    const element = document.createElement(tag.toLowerCase());

    children.forEach(child => element.appendChild(child));

    // 文字色
    if (tag === "SPAN") {
      const color = node.style.color;

      if (
        /^#[0-9a-f]{3,8}$/i.test(color) ||
        /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/.test(color)
      ) {
        element.style.color = color;
      }
    }

    // リンク
    if (tag === "A") {
      const href = node.getAttribute("href");

      try {
        const url = new URL(href, location.origin);

        if (["http:", "https:"].includes(url.protocol)) {
          element.href = url.href;
          element.target = "_blank";
          element.rel = "noopener noreferrer";
        }
      } catch {
        // 不正なリンクは設定しない
      }
    }

    return element;
  }

  const result = document.createElement("div");

  Array.from(parsed.body.childNodes)
    .map(cleanNode)
    .forEach(node => result.appendChild(node));

  return result.innerHTML;
}

// 資料を画面に表示する
function renderSubjectDocument() {
  if (savedDocumentHtml) {
    documentContent.innerHTML = savedDocumentHtml;
  } else {
    documentContent.textContent = "資料はありません。";
  }
}

// Firestoreから管理者用資料を取得
async function loadSubjectDocument() {
  try {
    const docId = encodeURIComponent(subjectName);

    const snapshot = await firebase.firestore()
      .collection("subjectDocuments")
      .doc(docId)
      .get();

    if (snapshot.exists) {
      savedDocumentHtml = sanitizeDocumentHtml(
        snapshot.data().content || ""
      );
    } else {
      savedDocumentHtml = "";
    }

    renderSubjectDocument();

  } catch (error) {
    console.error("管理者用資料の取得に失敗しました:", error);
    documentContent.textContent = "資料を取得できませんでした。";
  }
}

// 編集画面を開く
editDocumentButton.addEventListener("click", () => {
  if (!isAdmin) return;

  documentError.hidden = true;

  // 保存済みの内容を編集欄に読み込む
  documentEditorArea.innerHTML = savedDocumentHtml;

  documentEditor.hidden = false;
  editDocumentButton.hidden = true;

  documentEditorArea.focus();
});

// 編集をキャンセルする
cancelDocumentButton.addEventListener("click", () => {
  documentEditor.hidden = true;
  editDocumentButton.hidden = !isAdmin;
  documentError.hidden = true;
});

// 見出し形式を変更
documentHeading.addEventListener("change", () => {
  documentEditorArea.focus();

  document.execCommand(
    "formatBlock",
    false,
    documentHeading.value
  );
});

// 太字
documentBoldButton.addEventListener("click", () => {
  documentEditorArea.focus();
  document.execCommand("bold", false, null);
});

// 文字色
documentColorButton.addEventListener("click", () => {
  documentEditorArea.focus();

  document.execCommand(
    "foreColor",
    false,
    documentColor.value
  );
});

// 箇条書き
documentBulletButton.addEventListener("click", () => {
  documentEditorArea.focus();
  document.execCommand("insertUnorderedList", false, null);
});

// 番号付きリスト
documentNumberButton.addEventListener("click", () => {
  documentEditorArea.focus();
  document.execCommand("insertOrderedList", false, null);
});

// リンク
documentLinkButton.addEventListener("click", () => {
  const url = prompt("リンク先のURLを入力してください。");

  if (!url) return;

  if (!/^https?:\/\//i.test(url)) {
    alert("https:// または http:// から始まるURLを入力してください。");
    return;
  }

  documentEditorArea.focus();
  document.execCommand("createLink", false, url);
});

// 資料をFirestoreに保存
saveDocumentButton.addEventListener("click", async () => {
  if (!isAdmin) {
    alert("管理者のみ保存できます。");
    return;
  }

  documentError.hidden = true;

  // HTMLを安全な形式に変換
  const safeHtml = sanitizeDocumentHtml(
    documentEditorArea.innerHTML
  );

  saveDocumentButton.disabled = true;
  saveDocumentButton.textContent = "保存中...";

  try {
    const docId = encodeURIComponent(subjectName);

    await firebase.firestore()
      .collection("subjectDocuments")
      .doc(docId)
      .set({
        subject: subjectName,
        content: safeHtml,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

    savedDocumentHtml = safeHtml;

    renderSubjectDocument();

    documentEditor.hidden = true;
    editDocumentButton.hidden = false;

    alert("資料を保存しました。");

  } catch (error) {
    console.error("資料の保存に失敗しました:", error);

    documentError.textContent =
      "保存に失敗しました。時間をおいて再度お試しください。";

    documentError.hidden = false;

  } finally {
    saveDocumentButton.disabled = false;
    saveDocumentButton.textContent = "保存";
  }
});


// ========================================
// 管理者ログイン状態の確認
// ========================================

const adminMenu = document.getElementById("adminMenu");
const adminLoginLink = document.getElementById("adminLoginLink");
const adminLogoutButton = document.getElementById("adminLogoutButton");

watchAdminLogin(admin => {
  isAdmin = admin;

  document.body.classList.toggle("admin-mode", admin);

  adminMenu.hidden = !admin;
  adminLoginLink.hidden = admin;
  addInfoButton.hidden = !admin;

  // 編集画面が開いている間は編集ボタンを隠す
  editDocumentButton.hidden = !admin || !documentEditor.hidden;

  renderLearningInfos();

  console.log(
    admin
      ? "管理者としてログインしています"
      : "一般ユーザーとして閲覧しています"
  );
});

// ログアウト
adminLogoutButton.addEventListener("click", async () => {
  try {
    await firebase.auth().signOut();
  } catch (error) {
    alert("ログアウトに失敗しました。");
    console.error(error);
  }
});


// ========================================
// 初回読み込み
// ========================================

loadLearningInfos();
loadSubjectDocument();