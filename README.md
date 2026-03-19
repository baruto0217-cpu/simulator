# 救急シミュレーション管理システム

救急救命士向けのシミュレーション管理・活動評価アプリです。  
GitHub Pages で静的ホスティングでき、外部サービスなしでも動作します。

---

## ファイル構成

```
ems-simulator/
├── index.html      # メインページ（UI全体）
├── app.js          # アプリロジック
├── config.js       # 接続設定（Supabase キーをここに記入）
├── manifest.json   # PWA設定
├── icons/          # アプリアイコン（任意）
│   ├── icon-192.png
│   └── icon-512.png
└── README.md
```

---

## GitHub Pages への公開手順

1. GitHubで新しいリポジトリを作成する
2. このフォルダのファイルをすべてアップロード（またはgit push）
3. リポジトリの **Settings → Pages → Source** で `main` ブランチを選択
4. 数分後に `https://ユーザー名.github.io/リポジトリ名/` で公開される

---

## データ保存の仕組み

| 機能 | 説明 |
|------|------|
| **localStorage** | ブラウザにデータを保存。オフラインでも動作。端末をまたいでの共有は不可。 |
| **Supabase（任意）** | クラウドに保存し、複数端末でリアルタイム同期。無料枠で十分に使用可能。 |

Supabaseを設定しない場合でも、ローカル保存のみで全機能が使えます。

---

## Supabase のセットアップ（複数端末で同期したい場合）

### 1. Supabase プロジェクトを作成

1. [https://supabase.com](https://supabase.com) でアカウント作成・ログイン
2. **New project** をクリックしてプロジェクトを作成（無料）
3. **Project Settings → API** を開く
4. `Project URL` と `anon public` キーをコピーしておく

### 2. テーブルを作成

Supabase のダッシュボードで **SQL Editor** を開き、以下を実行：

```sql
-- シナリオ保存テーブル
create table scenarios (
  id          uuid primary key default gen_random_uuid(),
  data        jsonb not null,
  updated_at  timestamptz default now()
);

-- リアルタイム同期を有効化
alter table scenarios replica identity full;

-- RLS（行レベルセキュリティ）の設定（研修内利用想定）
create policy "allow all" on scenarios for all using (true) with check (true);
alter table scenarios enable row level security;
```

### 3. config.js を書き換える

```js
window.SUPABASE_URL      = 'https://xxxxxxxxxxxx.supabase.co';
window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIs...（長いキー）';
```

### 4. index.html に Supabase SDK を追加

`index.html` の `<script src="config.js">` の前に以下を追記：

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
```

これで複数のiPad・PC間でリアルタイムにデータが同期されます。

---

## 主な機能

- **事前情報表示**：指令内容・コールバック・現病歴・現場状況
- **フェーズ管理**：接触時・現場活動・車内収容など複数フェーズ対応
- **ABCDE評価**：各フェーズの系統的評価をモニター表示
- **バイタルサイン**：JCS・脈拍・血圧・呼吸数・体温・SpO2・心電図
- **活動評価表**：OK/NG判定・NGのみフィードバック表示
- **Take-home Message**：実習まとめ
- **データ入出力**：JSONテキストでのエクスポート/インポート
- **PWA対応**：ホーム画面追加でアプリとして起動可能（iOS/Android）
- **iOS最適化**：Safe Area・フォームズーム防止・タッチ操作改善

---

## オフライン対応（PWA）

このアプリはService Workerを使ったPWA（Progressive Web App）です。

**初回アクセス後はオフラインで動作します。**

| 機能 | オフライン時の動作 |
|------|------------------|
| シナリオ表示・編集 | ✅ 動作する |
| localStorage 保存 | ✅ 動作する |
| Supabase 同期 | ❌ 同期されない（再接続時に手動保存） |

### ホーム画面に追加（アプリとして使う）

**iPhoneの場合**
1. Safariでアプリを開く
2. 画面下の共有ボタン（□↑）をタップ
3.「ホーム画面に追加」を選択

**Androidの場合**
1. Chromeでアプリを開く
2. アドレスバー右の「⋮」→「ホーム画面に追加」

ホーム画面からはフルスクリーンのアプリとして起動します。

### キャッシュの更新

アプリを更新した場合、`sw.js` の `CACHE_NAME` を `'ems-sim-v2'` のようにバージョンアップしてください。次回アクセス時に自動で新しいキャッシュに切り替わります。

---



- iOS Safari 15以上
- Android Chrome 90以上
- PC Chrome / Edge / Firefox（最新版）

---

## ライセンス

MIT License
