# 学習情報管理ソース調査・統合計画

調査日: 2026-11-17
対象ブランチ: integration-development
対象ディレクトリ: learning-info-site/public/

## 1. ソース取得状況

学習情報管理のHTML・JavaScript・CSS・Service WorkerをGitHub上で確認できた。既存ファイルは保持し、旧サイトの公開環境・Firebaseプロジェクトには変更を加えない。

主な画面:
- index.html: 教科一覧、全教科横断の学習情報一覧、検索・期間フィルター
- subjects/subject.html: 教科別一覧、学習情報の追加・編集・複製・論理削除、管理者用資料
- admin/login.html: 旧学習情報専用ログイン
- admin/dictionary.html: 検索辞書の登録・編集・削除

主なスクリプト:
- js/firebase-config.js
- js/common.js
- js/top.js
- js/subject.js
- js/login.js
- js/dictionary.js

## 2. 維持する既存機能

### 検索
- NFKCによる全角・半角等の正規化
- 小文字化
- ひらがなをカタカナへ寄せる正規化
- 通常の部分一致検索
- searchDictionaryの基準ワード・別表記を使った検索

### 一覧・絞り込み
- 教科一覧（現在の13項目）
- 提出物／小テスト／NONEの分類フィルター
- 今日、明日まで、今週、今月の期間指定
- 期限切れ情報は直近7日間を選択表示
- 期限順、同一期限内は登録日時の新しい順、期限なしは末尾

### 管理機能
- 学習情報の追加・編集・複製
- deletedAtを使う論理削除（物理削除しない）
- 教科ごとの管理者用資料
- 資料編集（見出し、太字、文字色、箇条書き、番号付きリスト、リンク）
- 検索辞書の登録・編集・削除

## 3. Firestoreデータ構造（ソースから確認）

### learningInfos
利用フィールド:
- name
- subject
- category
- notes
- dueDate（未設定時はnull）
- createdAt
- updatedAt
- deletedAt（未削除はnull、削除時はserverTimestamp）

編集時はname/category/notes/dueDate/updatedAtを更新。削除時はdeletedAtとupdatedAtのみ更新する。既存レコードIDは参照関係がない限り維持する。

### searchDictionary
利用フィールド:
- baseWord
- alternativeWords（文字列配列）
- createdAt
- updatedAt

### subjectDocuments
ドキュメントIDはencodeURIComponent(subjectName)。利用フィールド:
- subject
- content（サニタイズ済みHTML文字列）
- updatedAt

HTML本文はデータ移行時に文字列として完全保持し、移行後に既存の許可タグ・属性ルールを再確認する。

## 4. 認証・権限に関する重要な差分

旧学習情報サイトはlearning-info-site Firebase Authenticationを使用し、専用ログイン画面と固定された管理者アカウント情報でログインする構成。旧サイトのwatchAdminLoginは「認証済みユーザーなら管理者」として扱う。

統合版ではこの方式を使用しない。
- 認証はattendance-systemの共通Firebase Authenticationに統一する。
- ユーザー情報はstudents/{uid}から取得する。
- 管理者UIはprofile.isAdmin === trueで判定する。
- roleは業務上の役職であり、管理者権限の代用にしない。
- 旧学習専用ログイン画面は統合版から外し、共通ログインへ誘導する。
- 辞書管理画面も認証済みかどうかだけでなくisAdminを確認する。

画面側の表示制御だけでは権限保護にならない。learningInfos、searchDictionary、subjectDocumentsの書き込み権限はFirestore Security Rulesで強制する必要がある。現時点ではRulesの内容を取得できていないため、Rulesの作成・変更・デプロイは行わない。

### 管理者アカウント移行の注意
既存のattendance-system利用者のうち、isAdminが未設定でrole名によって管理者運用されているアカウントが存在する可能性がある。既存管理者の棚卸し・承認・isAdmin設定が完了するまで、管理者機能の本番利用を切り替えない。ユーザーデータは変更しない。

## 5. 統合実装方針

1. learning/配下に統合版画面を作成し、shared/firebase.js・shared/auth.js・shared/app-shell.jsを利用する。
2. 旧画面のHTML/CSSを可能な限り再利用し、ページ構造や操作感を不必要に変更しない。
3. Firebaseアクセスをattendance-system側のFirestoreに向ける。旧プロジェクトの設定・認証を統合版から参照しない。
4. 共通ナビゲーションの「学習」をactiveにし、学習内の教科一覧・辞書管理等の機能導線を設ける。
5. 一般ユーザーは学習情報・辞書・資料を閲覧でき、管理者だけが学習情報の変更、資料編集、辞書変更を行える構成とする（最終的にはRulesで強制）。
6. 旧サイトのService Workerはルートパス・キャッシュ名が旧サイト固有のため、そのままコピーしない。統合アプリのルートに合わせて別途設計する。

## 6. データ移行手順（未実施）

移行前に旧Firestoreのバックアップを取得し、次の3コレクションをattendance-system側へ移行する。
- learningInfos
- searchDictionary
- subjectDocuments

移行時は以下を守る。
- ドキュメントIDを維持する。
- 全フィールドを保持し、特にTimestamp、null、deletedAt、HTML本文を欠落させない。
- 旧データの件数をコレクション別に記録する。
- 移行後に件数・代表レコード・論理削除データ・辞書配列・資料本文を照合する。
- 旧Firestoreのデータは移行完了後も削除しない。
- データの書き込み・Rules変更・本番切替は、対象と手順を提示して明示的な承認を得てから行う。

現状、GitHubソースからはFirestore実データ、Security Rules、Firebaseコンソール設定を取得できない。したがって本計画の作成時点でデータ移行は実施していない。

## 7. テスト項目

- 未ログイン時に共通ログインへ遷移する。
- 一般ユーザーは閲覧できるが管理操作は表示・実行できない。
- isAdmin=trueのユーザーだけが学習情報・辞書・資料を変更できる。
- 通常検索、全角半角、大小文字、ひらがな／カタカナ、辞書検索が従来どおり動く。
- 教科・分類・期限フィルター、期限切れ表示、並び順が従来どおり動く。
- 追加・編集・複製・論理削除が正しく動き、削除データが通常一覧から除外される。
- 資料HTMLの表示・編集・保存で許可外タグや危険な属性が実行されない。
- 辞書の登録・編集・削除が動く。
- スマートフォン・PCで共通ナビゲーションと各ページが崩れない。

## 8. 現在の作業境界

- 作業ブランチはintegration-developmentのみ。
- mainへのマージ、PR作成、本番デプロイは行わない。
- 旧学習サイト、旧Firebaseプロジェクト、Firestoreデータ、Rulesは変更しない。
- この文書はソース調査と安全な移行計画であり、データ移行や本番切替が完了したことを意味しない。


## 統合画面・移行ツールの実装状況（2026-11-17）

- `learning/index.html` と `learning/subjects/subject.html` を統合先Firebase・共通ログインに接続。
- 教科ページに管理者向けの学習情報追加・編集・複製・論理削除、教科資料の編集・保存を実装。
- `learning/admin/dictionary.html` で検索辞書の追加・編集・削除を実装。
- 管理者判定は `students/{uid}.isAdmin === true`。業務上の `role` とは分離。
- `learning/admin/migrate.html` に旧Firebaseからのコピー補助を実装。対象3コレクションをプレビューし、JSONバックアップを保存・確認した後、移行先の同一ID・同一内容はスキップし、同一ID・異なる内容は中止する。IDを維持して400件単位でコピーし、完了後に全対象を再照合する。途中失敗後は同一内容の既存分をスキップして再開できる。旧データは削除しない。
- 移行ツールは旧システムの管理者認証をブラウザ上で行う。パスワードをチャットへ送らないこと。
- Firestore Security Rules の監査・更新、ブラウザでの実機テスト、バックアップ検証、実データ移行、公開環境への反映は未実施。書き込みがRulesで拒否された場合は、Rulesを確認してから別途対応する。
- 移行処理は400件ごとのバッチ。再実行時は移行先の同一ID・同一内容をスキップし、異なる内容の同一IDがあれば書き込み前に中止する。移行後に全対象を再照合する。実Firebaseでの途中失敗・再開テストは未実施。
