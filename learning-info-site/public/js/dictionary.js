// Firebase
const db = firebase.firestore();
const auth = firebase.auth();

// HTML要素
const dictionaryForm = document.getElementById("dictionaryForm");
const baseWordInput = document.getElementById("baseWord");
const alternativeWordsInput = document.getElementById("alternativeWords");
const dictionaryError = document.getElementById("dictionaryError");
const dictionaryList = document.getElementById("dictionaryList");
const saveDictionaryButton = document.getElementById("saveDictionaryButton");
const cancelDictionaryButton = document.getElementById("cancelDictionaryButton");

// Firestoreのコレクション名
const dictionaryCollection = db.collection("searchDictionary");

// 編集中の辞書ID
let editingDictionaryId = null;

// 別表記を配列に変換
function parseAlternativeWords(text) {
  return [...new Set(
    text
      .split(/[、,，\n]/)
      .map(word => word.trim())
      .filter(word => word !== "")
  )];
}

// エラーメッセージ表示
function showDictionaryError(message) {
  dictionaryError.textContent = message;
  dictionaryError.hidden = false;
}

// エラーメッセージを消す
function clearDictionaryError() {
  dictionaryError.textContent = "";
  dictionaryError.hidden = true;
}

// フォームを初期状態に戻す
function resetDictionaryForm() {
  dictionaryForm.reset();
  editingDictionaryId = null;
  saveDictionaryButton.textContent = "登録";
  cancelDictionaryButton.hidden = true;
  clearDictionaryError();
}

// 登録済み辞書を表示
async function loadDictionaryList() {
  dictionaryList.textContent = "読み込み中...";

  try {
    const snapshot = await dictionaryCollection.get();

    if (snapshot.empty) {
      dictionaryList.textContent = "辞書はまだ登録されていません。";
      return;
    }

    const dictionaries = [];

    snapshot.forEach(doc => {
      dictionaries.push({
        id: doc.id,
        ...doc.data()
      });
    });

    dictionaries.sort((a, b) =>
      (a.baseWord || "").localeCompare(b.baseWord || "", "ja")
    );

    dictionaryList.replaceChildren();

    dictionaries.forEach(dictionary => {
      const item = document.createElement("div");
      item.className = "dictionary-item";

      const title = document.createElement("h3");
      title.textContent = dictionary.baseWord || "（基準ワードなし）";

      const alternatives = document.createElement("p");
      alternatives.textContent =
        "別表記：" +
        ((dictionary.alternativeWords || []).join("、") || "なし");

      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.textContent = "編集";
      editButton.addEventListener("click", () => {
        startDictionaryEdit(dictionary);
      });

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.textContent = "削除";
      deleteButton.addEventListener("click", () => {
        deleteDictionary(dictionary.id, dictionary.baseWord);
      });

      item.append(title, alternatives, editButton, deleteButton);
      dictionaryList.appendChild(item);
    });

  } catch (error) {
    console.error(error);
    dictionaryList.textContent = "辞書の読み込みに失敗しました。";
  }
}

// 辞書を登録・更新
dictionaryForm.addEventListener("submit", async event => {
  event.preventDefault();
  clearDictionaryError();

  const baseWord = baseWordInput.value.trim();
  const alternativeWords = parseAlternativeWords(
    alternativeWordsInput.value
  );

  if (!baseWord) {
    showDictionaryError("基準ワードを入力してください。");
    return;
  }

  if (baseWord.length > 100) {
    showDictionaryError("基準ワードは100文字以内で入力してください。");
    return;
  }

  const data = {
    baseWord,
    alternativeWords,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  saveDictionaryButton.disabled = true;

  try {
    if (editingDictionaryId) {
      await dictionaryCollection
        .doc(editingDictionaryId)
        .update(data);
    } else {
      data.createdAt =
        firebase.firestore.FieldValue.serverTimestamp();

      await dictionaryCollection.add(data);
    }

    resetDictionaryForm();
    await loadDictionaryList();

  } catch (error) {
    console.error(error);
    showDictionaryError(
      "保存に失敗しました。管理者としてログインしているか確認してください。"
    );
  } finally {
    saveDictionaryButton.disabled = false;
  }
});

// 編集を開始
function startDictionaryEdit(dictionary) {
  editingDictionaryId = dictionary.id;

  baseWordInput.value = dictionary.baseWord || "";
  alternativeWordsInput.value =
    (dictionary.alternativeWords || []).join("、");

  saveDictionaryButton.textContent = "更新";
  cancelDictionaryButton.hidden = false;
  clearDictionaryError();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

// 編集をキャンセル
cancelDictionaryButton.addEventListener("click", () => {
  resetDictionaryForm();
});

// 辞書を削除
async function deleteDictionary(id, baseWord) {
  const confirmed = window.confirm(
    `「${baseWord}」の辞書を削除しますか？`
  );

  if (!confirmed) return;

  try {
    await dictionaryCollection.doc(id).delete();
    await loadDictionaryList();

  } catch (error) {
    console.error(error);
    showDictionaryError(
      "削除に失敗しました。管理者としてログインしているか確認してください。"
    );
  }
}

// ログイン状態を確認
auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  loadDictionaryList();
});