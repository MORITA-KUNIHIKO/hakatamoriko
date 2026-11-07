// アプリの設定（公開しても問題ない値だけを書く）
// - SUPABASE_ANON_KEY は公開用のキー。データは Supabase の「本人のタスクしか読めない」設定で守られている
// - service_role key は、ここには絶対に書かない

export const SUPABASE_URL = "https://hnizwicvpmkggsppwbbh.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_qWWPg93NVJNjjtFVACYyaQ_CE32ariz";

// Google カレンダーに予定を送る先（GAS のウェブアプリ）
// 合言葉はログインした本人の Supabase のユーザー情報にあるので、URL が知られても他人は予定を作れない
export const GAS_URL =
  "https://script.google.com/macros/s/AKfycbznpQSiJqLp9lEelheywucI6Qdpq9woYLxsVwj9Nb4n3O40tg2Z_bZ2T3UWlnfZt2I/exec";
