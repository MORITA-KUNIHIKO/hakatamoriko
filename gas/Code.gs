/**
 * わたしのタスク管理 → Google カレンダー 連携
 *
 * 未完了のタスクを終日予定としてカレンダーに入れます。
 * - 日付があるタスクは、その日の予定になります
 * - 日付がないタスクや、日付が過ぎても終わっていないタスクは「今日」に入り、毎日持ち越されます
 * - アプリで日付を変えると、予定の日付も変わります
 * - アプリでタスク名を変えると、予定の名前も変わります
 * - タスクを完了・削除すると、予定も消えます
 *
 * 準備（最初に1回だけ）:
 * 1. 「プロジェクトの設定」→「スクリプト プロパティ」に次を追加
 *      SUPABASE_URL       … .env の SUPABASE_URL と同じ
 *      SUPABASE_ANON_KEY  … .env の SUPABASE_ANON_KEY と同じ
 *      EMAIL              … アプリにログインするときのメールアドレス
 *      PASSWORD           … アプリにログインするときのパスワード
 *      CALENDAR_ID        … （省略可）入れたいカレンダーのID。省略するといつものカレンダー
 * 2. 関数「setupTrigger」を選んで実行（15分ごとに自動で同期されるようになります）
 */

// 予定に付ける目印。この目印が付いた予定だけを、このスクリプトが管理します
const TAG_KEY = 'mytoolTaskId';
const TITLE_PREFIX = '【タスク】';
// どの範囲の予定を「このスクリプトが作った予定」として探すか（今日から見て何日前〜何日後）
const SEARCH_DAYS_BACK = 60;
const SEARCH_DAYS_AHEAD = 400;

/** タスクとカレンダーを同期する（トリガーから自動で呼ばれます） */
function syncTasksToCalendar() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10 * 1000)) return; // 前回の同期がまだ動いている
  try {
    const config = getConfig_();
    const token = signIn_(config);
    const tasks = fetchTasks_(config, token); // 失敗したらここで止まるので、予定が消えることはありません
    const calendar = getCalendar_(config);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const events = findManagedEvents_(calendar, today);
    const tasksById = {};
    tasks.forEach(function (task) {
      tasksById[String(task.id)] = task;
    });

    // 既にある予定を更新・削除する
    Object.keys(events).forEach(function (taskId) {
      const event = events[taskId];
      const task = tasksById[taskId];
      if (!task || task.done) {
        event.deleteEvent();
        return;
      }
      const title = TITLE_PREFIX + task.text;
      const date = eventDate_(task, today);
      if (event.getTitle() !== title) event.setTitle(title);
      if (event.getAllDayStartDate().getTime() !== date.getTime()) event.setAllDayDate(date);
    });

    // まだ予定がない未完了タスクを追加する
    tasks.forEach(function (task) {
      const taskId = String(task.id);
      if (task.done || events[taskId]) return;
      const event = calendar.createAllDayEvent(TITLE_PREFIX + task.text, eventDate_(task, today), {
        description: 'わたしのタスク管理から自動で追加された予定です。\n完了したらアプリでチェックを入れてください。',
      });
      event.setTag(TAG_KEY, taskId);
    });
  } finally {
    lock.releaseLock();
  }
}

/** 15分ごとに同期するトリガーを作る（最初に1回だけ実行） */
function setupTrigger() {
  removeTrigger();
  ScriptApp.newTrigger('syncTasksToCalendar').timeBased().everyMinutes(15).create();
  syncTasksToCalendar(); // すぐに1回同期しておく
}

/** 自動同期をやめる */
function removeTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'syncTasksToCalendar') ScriptApp.deleteTrigger(trigger);
  });
}

// ---- ここから下は内部で使う関数 ----

function getConfig_() {
  const props = PropertiesService.getScriptProperties();
  const config = {
    url: (props.getProperty('SUPABASE_URL') || '').replace(/\/+$/, ''),
    anonKey: props.getProperty('SUPABASE_ANON_KEY'),
    email: props.getProperty('EMAIL'),
    password: props.getProperty('PASSWORD'),
    calendarId: props.getProperty('CALENDAR_ID'),
  };
  ['url', 'anonKey', 'email', 'password'].forEach(function (key) {
    if (!config[key]) {
      throw new Error('スクリプト プロパティが足りません。SUPABASE_URL / SUPABASE_ANON_KEY / EMAIL / PASSWORD を設定してください。');
    }
  });
  return config;
}

/** アプリと同じメール・パスワードでログインし、アクセストークンを受け取る */
function signIn_(config) {
  const res = UrlFetchApp.fetch(config.url + '/auth/v1/token?grant_type=password', {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: config.anonKey },
    payload: JSON.stringify({ email: config.email, password: config.password }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('Supabase へのログインに失敗しました: ' + res.getContentText());
  }
  return JSON.parse(res.getContentText()).access_token;
}

/** 自分のタスクを全部取ってくる */
function fetchTasks_(config, token) {
  const res = UrlFetchApp.fetch(config.url + '/rest/v1/tasks?select=id,text,done,due_date&order=created_at.asc', {
    headers: { apikey: config.anonKey, Authorization: 'Bearer ' + token },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('タスクの読み込みに失敗しました: ' + res.getContentText());
  }
  return JSON.parse(res.getContentText());
}

/** 予定を入れる日：タスクの日付（"2026-11-05" の形）。日付がない・過ぎているなら今日 */
function eventDate_(task, today) {
  if (!task.due_date) return today;
  const parts = task.due_date.split('-').map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return date.getTime() < today.getTime() ? today : date;
}

function getCalendar_(config) {
  if (!config.calendarId) return CalendarApp.getDefaultCalendar();
  const calendar = CalendarApp.getCalendarById(config.calendarId);
  if (!calendar) throw new Error('カレンダーが見つかりません: ' + config.calendarId);
  return calendar;
}

/** このスクリプトが作った予定を { タスクID: 予定 } の形で集める */
function findManagedEvents_(calendar, today) {
  const start = new Date(today.getTime());
  start.setDate(start.getDate() - SEARCH_DAYS_BACK);
  const end = new Date(today.getTime());
  end.setDate(end.getDate() + SEARCH_DAYS_AHEAD);

  const result = {};
  calendar.getEvents(start, end).forEach(function (event) {
    const taskId = event.getTag(TAG_KEY);
    if (!taskId) return;
    if (result[taskId]) {
      event.deleteEvent(); // 同じタスクの予定が2つあったら1つにする
      return;
    }
    result[taskId] = event;
  });
  return result;
}
