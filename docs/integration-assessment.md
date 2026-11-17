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


## 追加調査: 主要画面の実装確認

### ログイン・遷移
- index.html はメールアドレス・パスワードでFirebase Authenticationにログインし、students/{uid}を取得して遷移先を決定する。
- 管理者判定は isAdmin がbooleanならその値、未設定なら role === "attendance" を使用する。統合方針ではこのフォールバックを段階的に廃止する必要がある。
- students/{uid} がない場合 unknown_user.html に遷移するが、現ブランチのファイル一覧には unknown_user.html がない。
- Service Workerはindex.htmlから登録される。

### 管理者ホーム
- admin_home.html はログイン状態だけを確認し、管理者かどうかを検証していない。
- 「全生徒の打刻履歴」のリンク先は admin_attendance_all.html だが、実在するファイルは admin_shift_attendance_all.html。
- 管理者ホームは従業員機能と管理者機能を一画面に縦並びで配置している。

### 管理者向け機能の権限
- admin_students.html、admin_notifications_create.html、admin_shift_attendance_all.html、admin_late_early.html は、ログイン確認はあるが管理者権限の検証がない。
- これらは統合時に共通の権限判定へ置き換える。ただし最終的な保護はFirestore Security Rules側で行う。

### シフト・遅刻早退
- admin_shift_create.html は attendanceGroups/{weekId} に週情報を保存し、attendanceItems に state="出勤予定" のレコードを作成・削除する。
- employee_shift.html は attendanceItems から対象週の state="出勤予定" を取得する構造。
- admin_late_early.html は weeklyShifts コレクションを参照しており、シフト作成画面とデータモデルが一致していない。現行運用データを調べずに単純置換しない。
- admin_shift_create.html は role が "attendance" または "admin" のユーザーをシフト対象から除外する。roleとisAdminの分離方針に合わせて見直す必要がある。

### 通知
- admin_notifications_create.html は notifications に title, message, target, date を追加する。
- employee_notifications.html は target == ログインUID で取得する。
- 通知作成画面に管理者権限検証がない。

### 共有タブレット
- tablet.html はFirebase Authenticationを使わず、students一覧を読み込み、選択されたUIDを使ってattendanceItemsへ直接書き込む。
- 現行Firestore Rulesが未認証書き込みを許可している場合にのみ動作する設計と考えられる。安全な代替フローを決めるまで統合版でそのまま再利用しない。

### 旧画面
- admin.html / user.html はFirebase SDK 10.7.0を使用し、user.htmlはattendanceコレクションへ記録する旧形式。
- 現行のemployee_attendance.htmlはattendanceItemsへ記録する。旧画面が利用中か確認し、未使用と確認できた後に整理する。

## 要件定義書・設計書について

リポジトリには次の2つのDOCXファイルが存在することを確認した。
- 📘 出勤管理システム 要件定義書 Ver.docx
- 📗 出勤管理システム 実装向け設計書 Ver.docx

ただしGitHub Connectorのファイル取得ではDOCXのバイナリ本文をテキストとして解析できなかったため、内容の照合は未完了。正確に照合するため、この2ファイルだけをこのチャットに添付してもらう必要がある。

## 追加調査後の判断

ここでは既存の画面・データを変更していない。特に権限・シフトデータ・共有タブレットの挙動は、要件書と実データを確認してから修正方針を確定する。


## 追加作業: 共通基盤の初期ファイルを追加

2026-11-17に、既存ページを変更せず、統合版で再利用するための共通ファイルを開発ブランチへ追加した。

- shared/firebase.js: attendance-system Firebase初期化を共通化。初期化済みFirebase Appを再利用する。
- shared/auth.js: students/{uid}から共通プロフィールを取得し、認証・管理者ガードを提供する。
- shared/app-shell.js: ホーム／出勤／学習／木材のナビゲーションとログアウト表示を生成する。
- shared/app-shell.css: スマホ下部ナビゲーションとPC向け横並びナビゲーションの基本スタイル。

### 権限判定の重要事項

新規共通基盤では管理者判定を profile.isAdmin === true に限定し、role名から管理者権限を推測しない。これは「roleとisAdminは独立」という統合方針に沿ったもの。

ただし、既存データのうち isAdmin が未設定で role === "attendance" のアカウントが管理者として運用されている可能性がある。新しい管理者画面へ切り替える前に、該当UIDのisAdmin値を安全に棚卸しし、必要なアカウントだけ移行する。現段階ではFirestoreデータを変更しない。

### 現時点の適用範囲

この4ファイルは追加済みだが、既存のindex.html、admin_home.html、employee_home.htmlその他の画面からはまだ読み込んでいない。したがって既存画面の挙動には影響しない。ナビゲーションのリンク先（home.html、learning/index.html、wood/index.html）は統合ページを実装する段階で作成・接続する。

### 学習情報管理のソースについて（2026-11-17更新）

学習情報管理のソース一式がintegration-developmentのlearning-info-site/public/へ追加されたため、主要HTML・JavaScript・CSS・Service Workerの調査を開始した。調査結果と移行計画はdocs/learning-integration-plan.mdを参照。旧Firebaseプロジェクト、Firestore実データ、Security Rulesは未変更であり、実データ移行と権限切替は未実施。


## 木材管理の統合実装状況（2026-11-18更新）

木材管理の初期画面を `wood/` に追加した。

- `wood/index.html`: グループ一覧、一覧フィルター、管理者によるまとめ行CRUD
- `wood/detail.html`: 個別木材の状態・担当・備考・確認更新、一括更新、予約、履歴、管理者による個別行追加・削除
- `docs/wood-management-implementation.md`: 仕様、データ項目、実装範囲、未検証事項
- `firestore.rules`: 木材の一般ユーザー更新を許可する開発用Rules案を追加。個別木材の許可フィールド、工程・進行値、予約者、履歴追加を検証する。

共通ナビゲーションの木材リンクと、統合ホームの予約中木材表示から接続できる構成にした。

現時点では静的JavaScript構文チェックまで。Firebase実機接続、Rules Emulator、既存データ互換性、オフライン読み取り専用化は未検証。Rulesデプロイ、実データ変更、mainへのマージ、本番公開は行っていない。


## 共通ログイン・ホームの接続更新（2026-11-18）

- `index.html` のログイン後遷移先を管理者／一般ユーザー共通で `home.html` に統一した。
- `home.html` に管理者向けショートカットを追加し、`isAdmin === true` のユーザーだけに表示する。
- `admin_work_plans.html` を追加し、`dailyWorkPlans` の登録・編集・削除を管理者が行えるようにした。共通ホームには当日分の予定を表示する。
- 木材画面は共通ホーム・共通ナビゲーションから利用可能。

旧 `admin_home.html` と `employee_home.html` は出勤管理内のメニューとして保持している。共通ログインからは直接遷移しない。
