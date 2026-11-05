import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";

// 画面の部品
const message = document.getElementById("message");
const userBar = document.getElementById("user-bar");
const userEmail = document.getElementById("user-email");
const logoutButton = document.getElementById("logout-button");

const authSection = document.getElementById("auth-section");
const authForm = document.getElementById("auth-form");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const signupButton = document.getElementById("signup-button");

const appSection = document.getElementById("app-section");
const form = document.getElementById("task-form");
const input = document.getElementById("task-input");
const dateInput = document.getElementById("task-date");
const list = document.getElementById("task-list");

// 以前ブラウザ内に保存していたタスク（ログイン時にクラウドへ引き継ぐ）
const LOCAL_STORAGE_KEYS = ["mytool-tasks", "nytool-tasks"];

let supabase = null;
// Google カレンダーに予定を送る先（GAS のウェブアプリ）と合言葉。.env から読み込む
let gasUrl = "";
let gasSecret = "";
// タスクの一覧（例：{ id: 1, text: "牛乳を買う", done: false, due_date: "2026-11-05" }）
// due_date は日付がないときは null
let tasks = [];

// ---------- メッセージ表示 ----------

function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle("error", isError);
  message.hidden = false;
}

function hideMessage() {
  message.hidden = true;
}

// ---------- .env の読み込み ----------

// .env を直接読み込んで { キー: 値 } の形にする
async function loadEnv() {
  const response = await fetch("./.env", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(".env を読み込めませんでした");
  }

  const env = {};
  const lines = (await response.text()).split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // "値" や '値' のように囲まれていたら外す
    if (/^(["']).*\1$/.test(value)) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

// ---------- 画面の切り替え ----------

function showLoggedOut() {
  tasks = [];
  render();
  userBar.hidden = true;
  appSection.hidden = true;
  authSection.hidden = false;
}

async function showLoggedIn(user) {
  userEmail.textContent = user.email;
  userBar.hidden = false;
  authSection.hidden = true;
  appSection.hidden = false;

  await importLocalTasks();
  await fetchTasks();
}

// ---------- ログイン ----------

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideMessage();

  const { error } = await supabase.auth.signInWithPassword({
    email: authEmail.value.trim(),
    password: authPassword.value,
  });
  if (error) {
    showMessage("ログインできませんでした：" + error.message, true);
  }
});

signupButton.addEventListener("click", async () => {
  hideMessage();
  if (!authForm.reportValidity()) return;

  const { data, error } = await supabase.auth.signUp({
    email: authEmail.value.trim(),
    password: authPassword.value,
  });
  if (error) {
    showMessage("登録できませんでした：" + error.message, true);
  } else if (!data.session) {
    // メール確認が有効な場合はセッションがまだない
    showMessage("確認メールを送りました。メール内のリンクを開いてからログインしてください。");
  }
});

logoutButton.addEventListener("click", async () => {
  hideMessage();
  await supabase.auth.signOut();
});

// ---------- タスクのクラウド操作 ----------

// クラウドからタスク一覧を取得する
async function fetchTasks() {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, text, done, due_date")
    .order("created_at", { ascending: true });

  if (error) {
    showMessage("タスクを読み込めませんでした：" + error.message, true);
    return;
  }
  tasks = data;
  render();
}

// ブラウザ内に残っている古いタスクをクラウドへ移して消す
async function importLocalTasks() {
  let localTasks = [];
  for (const key of LOCAL_STORAGE_KEYS) {
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (Array.isArray(saved)) localTasks = localTasks.concat(saved);
    } catch (error) {
      // 読めないデータは無視する
    }
  }
  if (localTasks.length === 0) return;

  const rows = localTasks
    .filter((task) => task && typeof task.text === "string")
    .map((task) => ({ text: task.text, done: Boolean(task.done) }));

  const { error } = await supabase.from("tasks").insert(rows);
  if (error) {
    showMessage("以前のタスクを引き継げませんでした：" + error.message, true);
    return;
  }

  try {
    LOCAL_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    // 消せなくても続ける
  }
  showMessage(`以前のタスク ${rows.length} 件をクラウドに引き継ぎました。`);
}

// dueDate は "2026-11-05" の形。日付を選んでいなければ空文字
async function addTask(text, dueDate) {
  const { data, error } = await supabase
    .from("tasks")
    .insert({ text: text, due_date: dueDate || null })
    .select("id, text, done, due_date")
    .single();

  if (error) {
    showMessage("追加できませんでした：" + error.message, true);
    return false;
  }
  tasks.push(data);
  render();
  // カレンダーへの送信は待たない（失敗してもタスクの追加には影響しない）
  sendToCalendar(data.text, data.due_date);
  return true;
}

// 今日の日付を "2026-11-05" の形で返す
function todayString() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// GAS に送って、Google カレンダーに終日予定を作る。日付がなければ今日の予定にする
async function sendToCalendar(title, dueDate) {
  if (!gasUrl || !gasSecret) return; // .env に設定がなければ何もしない

  try {
    const response = await fetch(gasUrl, {
      method: "POST",
      // text/plain にすると、ブラウザの事前確認（CORS）で止められない
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ title: title, date: dueDate || todayString(), secret: gasSecret }),
    });
    const result = (await response.text()).trim();
    if (!response.ok || result !== "ok") {
      throw new Error(result || `HTTP ${response.status}`);
    }
  } catch (error) {
    showMessage("タスクは追加しましたが、カレンダーには登録できませんでした：" + error.message, true);
  }
}

async function updateTask(task, done) {
  const { error } = await supabase.from("tasks").update({ done: done }).eq("id", task.id);
  if (error) {
    showMessage("更新できませんでした：" + error.message, true);
  } else {
    task.done = done;
  }
  render();
}

async function deleteTask(task) {
  const { error } = await supabase.from("tasks").delete().eq("id", task.id);
  if (error) {
    showMessage("削除できませんでした：" + error.message, true);
    return;
  }
  tasks = tasks.filter((t) => t.id !== task.id);
  render();
}

// ---------- 表示 ----------

// "2026-11-05" → "11/5"（今年でなければ "2027/1/5"）
function formatDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  const md = `${month}/${day}`;
  return year === new Date().getFullYear() ? md : `${year}/${md}`;
}

// タスク一覧を画面に表示し直す
function render() {
  list.innerHTML = "";

  tasks.forEach((task) => {
    // タスク1件分：チェックボックス＋タスク名＋削除ボタン
    const item = document.createElement("li");
    item.classList.toggle("done", task.done);

    const label = document.createElement("label");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.done;
    checkbox.addEventListener("change", () => {
      checkbox.disabled = true;
      updateTask(task, checkbox.checked);
    });

    const span = document.createElement("span");
    span.textContent = task.text;

    label.appendChild(checkbox);
    label.appendChild(span);

    if (task.due_date) {
      const date = document.createElement("time");
      date.className = "task-date";
      date.dateTime = task.due_date;
      date.textContent = formatDate(task.due_date);
      label.appendChild(date);
    }

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-button";
    deleteButton.textContent = "削除";
    deleteButton.addEventListener("click", () => {
      deleteButton.disabled = true;
      deleteTask(task);
    });

    item.appendChild(label);
    item.appendChild(deleteButton);
    list.appendChild(item);
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const text = input.value.trim();
  if (text === "") return;

  const button = form.querySelector("button");
  button.disabled = true;
  const ok = await addTask(text, dateInput.value);
  button.disabled = false;

  if (ok) {
    input.value = "";
    dateInput.value = "";
  }
  input.focus();
});

// ---------- 起動 ----------

async function start() {
  let env;
  try {
    env = await loadEnv();
  } catch (error) {
    showMessage(
      ".env を読み込めませんでした。ファイルを直接開かず、ローカルサーバー経由（例：python -m http.server）で開いてください。",
      true
    );
    return;
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    showMessage(".env に SUPABASE_URL と SUPABASE_ANON_KEY を入力してください。", true);
    return;
  }

  supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  gasUrl = env.VITE_GAS_URL || "";
  gasSecret = env.VITE_GAS_SECRET || "";

  // ログイン状態が変わるたびに画面を切り替える
  let currentUserId = null;
  supabase.auth.onAuthStateChange((event, session) => {
    const user = session ? session.user : null;
    const userId = user ? user.id : null;
    if (userId === currentUserId && event !== "INITIAL_SESSION") return;
    currentUserId = userId;

    // この中で直接 Supabase を呼ぶと止まることがあるので、少し後で実行する
    setTimeout(() => {
      if (user) {
        showLoggedIn(user);
      } else {
        showLoggedOut();
      }
    }, 0);
  });
}

start();
