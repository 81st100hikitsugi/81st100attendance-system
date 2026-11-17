# 木材管理 統合実装メモ

更新日: 2026-11-18  
対象ブランチ: `integration-development`

## 目的と仕様

木材管理を出勤管理・学習情報管理と同じログイン、プロフィール、共通ナビゲーションで利用できるようにする。既存の正式仕様を基準とし、以下を実装する。

- まとめ行: `woodGroups`
- 個別木材: `woodItems`
- 変更履歴: `historyLogs`
- 工程: 未着手 → 罫書き → 切断 → やすり → 組立 → 完了
- 進行: 予約／中／終了。未着手・完了では進行値を持たない
- 標準順以外の状態変更も許容し、変更前後を履歴に残す
- 代表状態はグループ内の最も古い現状態
- 担当範囲の制限は設けない
- 一般ユーザーは閲覧、履歴閲覧、個別木材の状態・担当者・備考・確認状態の更新、一括更新、予約操作が可能
- 一般ユーザーはまとめ行の登録・編集・削除、個別木材の追加・削除は不可
- 管理者は `isAdmin === true` により判定し、roleに関係なく全操作が可能

## 追加した画面

### `wood/index.html`

- グループ一覧
- 名称、素材、長さ、数量順、工程、進行、担当者、備考のフィルター
- 複数選択フィルターは同一フィルター内OR、異なるフィルター間AND
- 長さは範囲指定または数値＋誤差を選択
- 適用／クリア、複数選択フィルターの全選択／クリア
- 詳細画面から一覧に戻った際のフィルター条件保持（sessionStorage）
- 管理者によるまとめ行の登録・編集・削除
- まとめ行の登録時に数量分の個別木材を作成
- 数量変更時に個別木材数も調整

### `wood/detail.html`

- 個別木材の工程、進行、担当者、備考、確認状態、更新日時を表示
- 個別行の保存
- 選択した行だけの一括更新
- 予約／予約解除
- 変更履歴の一覧
- 管理者による個別木材の追加・削除
- 工程変更時は `woodItems.history` と `historyLogs` の両方に履歴を記録
- 変更後にグループの代表状態と確認状態を再計算
- 一括更新はFirestoreの書き込み上限を超えないよう200件単位で分割

## 主なフィールド

### woodGroups

`name`, `material`, `length`, `quantity`, `representativeState`, `notes`, `check`, `createdBy`, `createdAt`, `updatedAt`

### woodItems

`groupId`, `process`, `progress`, `assignee`, `assigneeName`, `updatedBy`, `updatedAt`, `notes`, `check`, `history`, `reservedBy`, `reservedAt`, `reservedName`

担当者は表示名文字列として保存する。更新者はFirebase Authentication UIDを `updatedBy` に保存する。

### historyLogs

`itemId`, `groupId`, `oldProcess`, `newProcess`, `oldProgress`, `newProgress`, `oldState`, `newState`, `updatedBy`, `updatedByName`, `updatedAt`, `notes`

## Security Rules案

`firestore.rules` の開発ブランチ案を更新した。

- 一般ユーザーはログイン後に木材情報を閲覧可能
- まとめ行の作成・削除は管理者のみ
- まとめ行の一般ユーザー更新は代表状態・確認状態・更新日時に限定
- 個別木材の一般ユーザー更新は工程・進行・担当者・備考・確認状態・予約情報・履歴等の許可フィールドに限定
- 工程・進行の値を検証
- 予約済み木材を他ユーザーが解除・上書きできないよう制限
- 履歴ログは一般ユーザーが追加できるが、編集・削除は管理者のみ

**このRulesは開発ブランチ上の案であり、Firebase本番環境にはデプロイしていない。**

## 未完了・要検証

- ブラウザでのFirebase接続・実際の読み書きテスト
- 既存Firestoreデータのフィールド名・内容との互換性確認
- Firestore Rules Emulatorでの一般ユーザー／管理者別テスト
- グループ代表状態の表示とフィルター結果の境界ケース
- 大量件数での一括更新・削除
- オフライン時は更新操作を無効化し、Firestore IndexedDBキャッシュからの読み取りを試みる。キャッシュ未取得データは表示できない場合がある
- PWAキャッシュとスマートフォン・PC表示

旧データや本番データの変更、Rulesのデプロイ、mainへのマージ、本番公開は行っていない。


## オフライン対応

- `shared/firebase.js` でFirestoreのマルチタブIndexedDB永続キャッシュを初期化する。
- 木材一覧・詳細はオンライン時に取得し、通信不可時はキャッシュ読み取りへフォールバックする。
- オフライン中は木材の更新・予約・管理操作を無効化する。
- `service-worker.js` は統合ホーム、木材画面、学習画面、共通モジュール等の静的ファイルをキャッシュする。
- キャッシュが存在しないデータや、ブラウザがIndexedDBを利用できない環境ではオフライン表示できない場合がある。
