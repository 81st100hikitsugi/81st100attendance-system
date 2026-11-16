# 統合プロジェクト事前調査メモ

更新日: 2026-11-17
対象リポジトリ: 81st100hikitsugi/81st100attendance-system
調査ブランチ: integration-development

## 目的

既存の出勤管理を維持しながら、共通ログイン・共通ナビゲーションの下に「出勤」「学習」「木材」の各機能を統合する。既存の本番ブランチやFirebase実データを不用意に変更しない。

## リポジトリの現状

ルートにはHTML中心の静的Webアプリがあり、主なファイルは以下。

- ログイン: index.html
- ホーム: admin_home.html / employee_home.html
- 出勤: employee_attendance.html
- 打刻履歴: employee_history.html / admin_shift_attendance_all.html
- シフト: admin_shift_create.html / employee_shift.html
- 名簿: admin_students.html
- 通知: admin_notifications_create.html / employee_notifications.html
- 遅刻・早退: admin_late_early.html
- 共有タブレット: tablet.html
- PWA: manifest.json / service-worker.js
- 旧形式と思われる画面: admin.html / user.html

Firebase AuthenticationとFirestoreを使用し、フロントエンドはFirebase Web SDK 10.7.xのES Modulesをページごとに読み込んでいる。

## 現行データの読み取りで確認できたこと

- 共通ユーザー情報の参照先は students/{Firebase Auth UID}。
- 出勤・退勤とシフト予定は attendanceItems を使用する実装が中心。
- 週単位の補助情報は attendanceGroups/{YYYY-Www} に保存する。
- attendanceItems の主なフィールドは userId, date, shift, state, time, notes, check, history。
- シフト予定は state="出勤予定" として attendanceItems に保存される。
- 画面コードには notifications、weeklyShifts、attendance という別コレクション参照もある。実データの有無・現行利用状況は未確認であり、統合前にFirestore側と照合する必要がある。

## 統合前に解消すべき既存コード上の不整合

1. admin_home.html の「全生徒の打刻履歴」リンクは admin_attendance_all.html を指すが、リポジトリ内の実ファイル名は admin_shift_attendance_all.html。
2. index.html は students にユーザー情報がない場合 unknown_user.html へ遷移するが、そのファイルはリポジトリ内に見当たらない。
3. admin_late_early.html は weeklyShifts を参照する一方、週シフト作成画面は attendanceGroups と attendanceItems を使用している。データ形式の整合性確認が必要。
4. admin_shift_create.html は isAdmin が未設定の場合 role === "attendance" を管理者とみなす。またシフト対象者の抽出時に role が "attendance" または "admin" の人を除外する。roleと管理者権限を独立させる統合方針と矛盾するため、既存管理者を失わない移行手順を用意して整理する。
5. admin_home.html、admin_students.html、admin_notifications_create.html、admin_shift_attendance_all.html、admin_late_early.html 等は、画面コード上で管理者権限を十分に再確認していない。UIの制御だけでなくFirestore Security Rulesで強制する必要がある。
6. tablet.html はログイン処理なしで students を読み取り、選択されたユーザー名義で打刻を書き込む構造。共有タブレットの認証・本人確認方法と権限設計を確認するまで統合対象として有効化しない。
7. admin.html / user.html は attendanceItems ではなく attendance コレクションを使う旧実装に見える。現役利用の有無を確認してから扱う。
8. Service Workerは現在、旧キャッシュ削除と制御取得のみで、アプリ資産の事前キャッシュを行っていない。オフライン対応は別工程として設計する。
9. Firebase SDKのバージョン表記に10.7.0と10.7.1が混在している。共通化時に統一する。

## セキュリティ・移行上の注意

- このリポジトリには firestore.rules、firebase.json、.firebaserc が見当たらない。実際のFirestore Rulesと公開設定はFirebaseコンソール側で確認する必要がある。
- Security Rulesを確認・準備するまでは、本番データやルールを変更しない。
- studentsの既存UID対応を維持し、roleとisAdminを別々に扱う。
- 学習情報の移行は、論理削除データ・HTML本文・Timestampを含む全データを保持する計画にする。
- 既存Firebaseプロジェクト間の移行は、バックアップ・件数照合・移行後検証を行い、旧プロジェクトを直ちに削除しない。
- 本番デプロイやmainへのマージは、テストと明示的な確認の後に行う。

## 推奨する実装順序

### Phase 0: 現状把握
- 出勤管理の要件定義書・設計書と実装を照合する。
- Firestoreの実コレクション・Rules・Authentication構成を確認する。
- 学習情報管理の全ファイル・データ構造を取得し、移行対象を確定する。
- 既存の出勤機能のうち、現在使われている画面と旧画面を区別する。

### Phase 1: 共通基盤
- Firebase初期化、認証状態、ユーザー情報、権限判定を共通モジュール化する。
- isAdminとroleを独立させる。
- 共通レイアウトとスマホ下部ナビ／PCサイドナビを作る。
- 既存出勤機能を段階的に共通レイアウトへ移す。

### Phase 2: 共通ホーム
- 今日の全体作業予定、本人の今日のシフト、本人が予約した木材を表示する。
- 全体作業予定は木材データと分離した dailyWorkPlans として設計する。
- 作業予定を編集できるroleは確定後に権限へ反映する。

### Phase 3: 学習情報統合
- 旧学習情報データをバックアップし、attendance-system側へ移行する。
- 既存検索の正規化、科目資料、辞書、論理削除を維持する。
- データ件数と代表レコードを照合する。

### Phase 4: 木材管理
- woodGroups / woodItems / historyLogs を実装する。
- 一般ユーザーと管理者の権限をUIとSecurity Rulesの両方で強制する。
- 状態変更・一括操作・予約・履歴記録の整合性を検証する。

### Phase 5: セキュリティ・PWA・公開
- collection別Security Rulesをテスト環境で検証する。
- PWAキャッシュと通信エラー表示を整備する。
- スマホ・タブレット・PCでテスト後、承認を得て公開する。

## この時点での変更

このメモの追加以外、既存HTML、Firebase設定、Firestoreデータ、Security Rules、本番公開設定には変更を加えていない。
