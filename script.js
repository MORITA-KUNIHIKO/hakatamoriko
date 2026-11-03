const form = document.getElementById("task-form");
const input = document.getElementById("task-input");
const list = document.getElementById("task-list");

const STORAGE_KEY = "mytool-tasks";
const OLD_STORAGE_KEY = "nytool-tasks"; // 以前の保存名（引き継ぎ用）

// タスクの一覧（例：{ text: "牛乳を買う", done: false }）
let tasks = loadTasks();

// ブラウザに保存されたタスクを読み込む
function loadTasks() {
  try {
    // 新しい保存名にデータがなければ、以前の保存名から引き継ぐ
    let raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      raw = localStorage.getItem(OLD_STORAGE_KEY);
      if (raw !== null) {
        localStorage.setItem(STORAGE_KEY, raw);
        localStorage.removeItem(OLD_STORAGE_KEY);
      }
    }
    const saved = JSON.parse(raw);
    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    return [];
  }
}

// 今のタスク一覧をブラウザに保存する
function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (error) {
    // 保存できない環境でも画面の操作は続けられるようにする
  }
}

// タスク一覧を画面に表示し直す
function render() {
  list.innerHTML = "";

  tasks.forEach((task, index) => {
    // タスク1件分：チェックボックス＋タスク名＋削除ボタン
    const item = document.createElement("li");
    item.classList.toggle("done", task.done);

    const label = document.createElement("label");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.done;
    checkbox.addEventListener("change", () => {
      task.done = checkbox.checked;
      saveTasks();
      render();
    });

    const span = document.createElement("span");
    span.textContent = task.text;

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-button";
    deleteButton.textContent = "削除";
    deleteButton.addEventListener("click", () => {
      tasks.splice(index, 1);
      saveTasks();
      render();
    });

    label.appendChild(checkbox);
    label.appendChild(span);
    item.appendChild(label);
    item.appendChild(deleteButton);
    list.appendChild(item);
  });
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const text = input.value.trim();
  if (text === "") return;

  tasks.push({ text: text, done: false });
  saveTasks();
  render();

  input.value = "";
  input.focus();
});

render();
