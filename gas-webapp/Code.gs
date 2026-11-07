// 合言葉（SECRET）は secret.gs に書きます（Git には入れません）
// アプリは、ログインした本人の Supabase のユーザー情報（user_metadata.gas_secret）から合言葉を読んで送ってきます

/**
 * ウェブアプリとして POST を受け取り、Google カレンダーに終日予定を追加する
 * 送る内容（JSON）: { "title": "牛乳を買う", "date": "2026-11-05", "secret": "合言葉" }
 * ブラウザから送るときは Content-Type を text/plain にすると、事前確認（CORS）で止まりません
 */
function doPost(e) {
  let data;
  try {
    data = JSON.parse(e && e.postData ? e.postData.contents : '');
  } catch (err) {
    return reply_('error: JSON を読み取れませんでした');
  }

  // 合言葉が違うときは何もしない
  if (!data || data.secret !== SECRET) {
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
  return reply_('OK: カレンダー「' + name + '」に予定を書き込めます。このページは閉じて大丈夫です。');
}

/**
 * GAS の編集画面から権限を許可するときは、この関数を実行してください
 */
function authorize() {
  Logger.log('カレンダー: ' + CalendarApp.getDefaultCalendar().getName() + ' に書き込めます');
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
