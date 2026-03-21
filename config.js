/* =============================================================
   config.js  –  接続設定ファイル
   
   【使い方】
   1. Supabase (https://supabase.com) でプロジェクトを作成
   2. Project Settings > API から URL と anon key をコピー
   3. 下の YOUR_SUPABASE_URL と YOUR_SUPABASE_ANON_KEY を書き換える
   
   【Supabaseのテーブル設定】
   以下のSQLをSupabase > SQL Editorで実行してください:
   
   create table scenarios (
     id          uuid primary key default gen_random_uuid(),
     data        jsonb not null,
     updated_at  timestamptz default now()
   );
   
   -- リアルタイム同期を有効化
   alter table scenarios replica identity full;
   
   -- 誰でも読み書きできるようにする（研修内部利用想定）
   create policy "allow all" on scenarios for all using (true) with check (true);
   alter table scenarios enable row level security;
   
   【Supabaseを使わない場合】
   何も変更しなくてもOKです。ローカル保存（localStorage）のみで動作します。
   ============================================================= */

window.SUPABASE_URL      = 'YOUR_SUPABASE_URL';
window.SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
