// アプリと同じ Supabase（公開用の値なので、ここに書いて大丈夫）
const SUPABASE_URL = 'https://hnizwicvpmkggsppwbbh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qWWPg93NVJNjjtFVACYyaQ_CE32ariz';

// カレンダーに予定を書き込んでよいアプリのアカウント（Supabase のユーザーID）
const ALLOWED_USER_IDS = [
  '464f40a5-00d2-4ba7-969b-e6ac3a4894ad',
  'b5a409bb-88bd-4492-a5f8-f09cdeb8167d',
];

/**
 * ウェブアプリとして POST を受け取り、Google カレンダーに終日予定を追加する
 * 送る内容（JSON）: { "title": "牛乳を買う", "date": "2026-11-05", "token": "アプリのログインのアクセストークン" }
 * token を Supabase に確かめて、許可したアカウントのときだけ予定を作る
 * ブラウザから送るときは Content-Type を text/plain にすると、事前確認（CORS）で止まりません
 */
function doPost(e) {
  let data;
  try {
    data = JSON.parse(e && e.postData ? e.postData.contents : '');
  } catch (err) {
    return reply_('error: JSON を読み取れませんでした');
  }

  // ログインしている本人でなければ何もしない
  const userId = verifyUser_(data && data.token);
  if (!userId || ALLOWED_USER_IDS.indexOf(userId) === -1) {
    return reply_('ng');
  }

  const title = String(data.title || '').trim();
  if (!title) {
    return reply_('error: title がありません');
  }

  const date = parseDate_(data.date);
  if (!date) {
    return reply_('error: date は 2026-11-05 の形で送ってください');
  }

  CalendarApp.getDefaultCalendar().createAllDayEvent(title, date);
  return reply_('ok');
}

/**
 * ブラウザでこのウェブアプリの URL を開いたときの画面
 * （権限がまだなら、先に Google の許可画面が出ます）
 */
function doGet() {
  const name = CalendarApp.getDefaultCalendar().getName();
  // Supabase に問い合わせる権限も、ここで一緒に許可してもらう
  UrlFetchApp.fetch(SUPABASE_URL + '/auth/v1/health', { headers: { apikey: SUPABASE_ANON_KEY }, muteHttpExceptions: true });
  return reply_('OK: カレンダー「' + name + '」に予定を書き込めます。このページは閉じて大丈夫です。');
}

/**
 * GAS の編集画面から権限を許可するときは、この関数を実行してください
 */
function authorize() {
  doGet();
  Logger.log('カレンダーと Supabase の権限を許可しました');
}

/** アプリのアクセストークンを Supabase に確かめ、本物ならユーザーIDを返す（だめなら null） */
function verifyUser_(token) {
  if (!token || typeof token !== 'string') return null;
  const res = UrlFetchApp.fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) return null;
  try {
    return JSON.parse(res.getContentText()).id || null;
  } catch (err) {
    return null;
  }
}

/** "2026-11-05" → その日の Date（ありえない日付なら null） */
function parseDate_(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

/** 返す内容をテキストにする */
function reply_(text) {
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.TEXT);
}
