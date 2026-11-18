
const subjects = [
  "数学Ⅰ・Ⅱ",
  "現代の国語",
  "論理・表現Ⅰ",
  "情報Ⅰ",
  "保健",
  "言語文化",
  "数学A",
  "公共",
  "英語コミュニケーションⅠ",
  "生物基礎",
  "地理総合",
  "歴史総合",
  "その他"
];

// Firestoreから取得する学習情報
let learningInfos = [];

// 辞書データ
let dictionaryEntries = [];

// 教科一覧を作成
const subjectList = document.getElementById("subjectList");

subjects.forEach(subject => {
  const link = document.createElement("a");

  link.className = "subject-link";
  link.textContent = subject;
  link.href = "subjects/subject.html?subject=" +
    encodeURIComponent(subject);

  const arrow = document.createElement("span");
  arrow.textContent = "›";
  link.appendChild(arrow);

  subjectList.appendChild(link);
});

// 教科一覧の開閉
const subjectToggle = document.getElementById("subjectToggle");
const subjectToggleText =
  document.getElementById("subjectToggleText");
const subjectToggleIcon =
  document.getElementById("subjectToggleIcon");

subjectToggle.addEventListener("click", () => {
  const isOpen = subjectToggle.getAttribute("aria-expanded") === "true";

  subjectToggle.setAttribute("aria-expanded", String(!isOpen));
  subjectList.hidden = isOpen;

  subjectToggleText.textContent = isOpen
    ? "すべての教科を表示"
    : "教科一覧を閉じる";

  subjectToggleIcon.textContent = isOpen ? "▼" : "▲";
});

// 日付を年月日だけで扱う
function getDateOnly(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
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

// 辞書を取得
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

// Firestoreから学習情報を取得
async function loadLearningInfos() {
  try {
    // 辞書と学習情報を両方取得してから表示
    await loadSearchDictionary();

    const snapshot = await firebase.firestore()
      .collection("learningInfos")
      .get();

    learningInfos = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      // 削除済みの情報は表示しない
      .filter(info => !info.deletedAt);

    renderLearningInfos();

  } catch (error) {
    console.error("学習情報の取得に失敗しました:", error);

    const list = document.getElementById("learningInfoList");
    list.innerHTML = "";

    const message = document.createElement("p");
    message.className = "empty-message";
    message.textContent = "学習情報を取得できませんでした。";

    list.appendChild(message);
  }
}

// 期間フィルターの終了日を取得
function getPeriodEnd(period) {
  const today = getDateOnly(new Date());

  if (period === "today") {
    return today;
  }

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

// 表示対象を絞り込む
function getFilteredInfos() {
  const searchText = normalizeSearchText(
    document.getElementById("searchInput").value
  );

  const showSubmission =
    document.getElementById("filterSubmission").checked;

  const showTest =
    document.getElementById("filterTest").checked;

  const showExpired =
    document.getElementById("showExpired").checked;

  const period =
    document.getElementById("periodSelect").value;

  const today = getDateOnly(new Date());

  const expiredLimit = new Date(today);
  expiredLimit.setDate(expiredLimit.getDate() - 7);

  const periodEnd = getPeriodEnd(period);

  return learningInfos.filter(info => {
    // 分類による絞り込み
    if (info.category === "提出物" && !showSubmission) return false;
    if (info.category === "小テスト" && !showTest) return false;

    // トップページではNONEを表示しない
    if (info.category === "NONE") return false;

    // 情報名と辞書を使った検索
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

    // 期限切れは通常非表示。ONなら直近7日分だけ表示
    if (dueDate < today) {
      return showExpired && dueDate >= expiredLimit;
    }

    // 未来の期限は選択した期間で絞り込む
    if (periodEnd && dueDate > periodEnd) return false;

    return true;
  });
}

// 並び順：期限が早い順、同じ期限なら登録日時が新しい順
// 期限なしは最後
function sortInfos(infos) {
  return [...infos].sort((a, b) => {
    if (!a.dueDate && b.dueDate) return 1;
    if (a.dueDate && !b.dueDate) return -1;

    if (a.dueDate && b.dueDate) {
      const dateDifference = a.dueDate.localeCompare(b.dueDate);
      if (dateDifference !== 0) return dateDifference;
    }

    return getCreatedTime(b.createdAt) - getCreatedTime(a.createdAt);
  });
}

// 学習情報を画面に表示
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
    category.textContent = info.category;
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

      // 2行を超える場合だけ「続きを読む」を表示
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

    list.appendChild(card);
  });
}

// 各フィルターの変更を画面に反映
[
  "searchInput",
  "filterSubmission",
  "filterTest",
  "showExpired",
  "periodSelect"
].forEach(id => {
  document.getElementById(id).addEventListener("input", renderLearningInfos);
  document.getElementById(id).addEventListener("change", renderLearningInfos);
});

// 管理者ログイン状態の確認
const adminMenu = document.getElementById("adminMenu");
const adminLoginLink = document.getElementById("adminLoginLink");
const adminLogoutButton =
  document.getElementById("adminLogoutButton");

watchAdminLogin(isAdmin => {
  document.body.classList.toggle("admin-mode", isAdmin);

  adminMenu.hidden = !isAdmin;
  adminLoginLink.hidden = isAdmin;

  console.log(
    isAdmin
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

// 初回読み込み
loadLearningInfos();
