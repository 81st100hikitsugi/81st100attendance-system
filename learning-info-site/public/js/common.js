// 全角・半角、大文字・小文字、ひらがな・カタカナを
// できるだけ同じ形式にそろえる
function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ぁ-ゖ]/g, char =>
      String.fromCharCode(char.charCodeAt(0) + 0x60)
    )
    .trim();
}

// 通常の検索と辞書を使った検索をまとめて判定する
function matchesDictionarySearch(infoName, query, dictionaryEntries) {
  const normalizedName = normalizeSearchText(infoName);
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return true;
  }

  // 通常の検索（情報名に検索語が含まれる場合）
  if (normalizedName.includes(normalizedQuery)) {
    return true;
  }

  // 辞書の別表記から基準ワードを探す
  return dictionaryEntries.some(entry => {
    const baseWord = normalizeSearchText(entry.baseWord);

    if (!baseWord || !normalizedName.includes(baseWord)) {
      return false;
    }

    const alternatives = entry.alternativeWords || [];

    return alternatives.some(alternative => {
      const normalizedAlternative = normalizeSearchText(alternative);

      return normalizedAlternative.includes(normalizedQuery);
    });
  });
}

// 管理者のログイン状態を監視する
function watchAdminLogin(callback) {
  firebase.auth().onAuthStateChanged(user => {
    callback(Boolean(user));
  });
}