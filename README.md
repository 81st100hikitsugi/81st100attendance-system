# 統合業務管理システム

出勤管理・学習情報管理・木材管理を、共通ログインと共通ナビゲーションから利用するWebアプリケーションです。

## 開発ブランチ

- 開発・確認対象: `integration-development`
- 本番公開ブランチ: `main`
- 開発中の変更は `integration-development` に限定します。
- `main` へのマージ、GitHub Pagesの公開設定変更、Firebase Security Rulesのデプロイ、実データの移行は、事前確認と明示的な承認なしに行いません。

## 主な構成

- `index.html`: 共通ログイン
- `home.html`: 統合ホーム
- `employee_*.html`, `admin_*.html`: 出勤管理
- `tablet.html`: 共有タブレット打刻
- `learning/`: 学習情報管理
- `wood/`: 木材管理
- `shared/`: Firebase初期化、認証ガード、共通ナビゲーション
- `firestore.rules`: 開発用Rules案（本番適用済みではありません）
- `docs/`: 統合計画、実装状況、QA・セキュリティ確認資料

## ローカルでの確認

ES ModulesとService Workerを使用するため、HTMLファイルを直接開かず、HTTPサーバー経由で確認してください。

リポジトリのルートで次を実行します。

```powershell
py -m http.server 8000
```

ブラウザで `http://localhost:8000/` を開きます。Pythonランチャーが使えない場合は、Pythonを利用できる環境で同等の静的HTTPサーバーを起動してください。

Firebase Authenticationを使ったログインには、Firebase Authenticationの承認済みドメインに `localhost` が登録されている必要がある場合があります。Firebase設定を変更する前に、まず画面表示とブラウザのConsoleを確認してください。

## Firebaseとデータ

- 統合先Firebaseプロジェクト: `attendance-system-eb7d1`
- 旧学習情報Firebaseプロジェクト: `learning-info-site`
- 学習情報の移行対象: `learningInfos`、`searchDictionary`、`subjectDocuments`
- 移行ツールはバックアップ、ID照合、重複スキップ、コピー後照合を行い、旧データを削除しません。

Firebaseの実データ・認証アカウント・デプロイ済みRulesは、リポジトリのコードだけでは確認できません。移行・Rules適用前にFirebase Consoleまたはテスト環境で別途確認してください。

## 権限設計

- `role` は業務上の役職を表します。
- `isAdmin === true` はシステム管理者権限を表し、roleとは独立しています。
- 管理者は役職に関係なく管理機能を利用できます。
- 木材管理では一般ユーザーも個別木材の状態・担当者・備考等を更新できますが、まとめ行の作成・変更・削除は管理者のみです。
- 共有タブレットは既存運用を維持する方針です。現行Rules案との認証方式の不整合が解消されるまで、Rules案を本番適用しません。

## 確認資料

- `docs/integration-assessment.md`
- `docs/integration-qa-checklist.md`
- `docs/learning-integration-plan.md`
- `docs/wood-management-implementation.md`
- `docs/firestore-rules-review.md`
- `docs/tablet-attendance-qa.md`

## 開発時の注意

- 本番データを使った試験をしないでください。
- 認証パスワードや秘密情報をチャット・ソースコードへ追加しないでください。
- Firebase Security RulesはOR評価です。既存の広い許可ルールが残っていると、制限ルールを追加しても保護されません。
- 実Firebaseへの書き込み、データ移行、本番公開は、バックアップと確認を終えてから別工程として実施します。
