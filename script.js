const DURATIONS = { focus: 25 * 60, break: 5 * 60 };
const CIRCUMFERENCE = 2 * Math.PI * 90;

const card = document.querySelector(".card");
const timeEl = document.getElementById("time");
const progressEl = document.getElementById("progress");
const startBtn = document.getElementById("start");
const pauseBtn = document.getElementById("pause");
const resetBtn = document.getElementById("reset");

let mode = "focus";
let remaining = DURATIONS.focus;
let endTime = null;
let timerId = null;
let audioCtx = null;

function render() {
  const m = String(Math.floor(remaining / 60)).padStart(2, "0");
  const s = String(remaining % 60).padStart(2, "0");
  timeEl.textContent = `${m}:${s}`;
  document.title = `${m}:${s} · Focus Flow`;
  progressEl.style.strokeDashoffset = CIRCUMFERENCE * (remaining / DURATIONS[mode]);
  card.dataset.mode = mode;
  const running = timerId !== null;
  startBtn.disabled = running;
  pauseBtn.disabled = !running;
}

function tick() {
  remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
  render();
  if (remaining === 0) complete();
}

function start() {
  if (timerId !== null) return;
  // Create the audio context on a user click so browsers allow the beep later
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  endTime = Date.now() + remaining * 1000;
  timerId = setInterval(tick, 250);
  render();
}

function stop() {
  clearInterval(timerId);
  timerId = null;
}

function pause() {
  stop();
  render();
}

function reset() {
  stop();
  mode = "focus";
  remaining = DURATIONS.focus;
  render();
}

function complete() {
  stop();
  beep();
  if (mode === "focus") {
    recordSession();
    mode = "break";
    remaining = DURATIONS.break;
    start(); // break begins automatically
  } else {
    mode = "focus";
    remaining = DURATIONS.focus;
    render(); // ready for the next focus session
  }
}

function beep() {
  if (!audioCtx) return;
  [0, 0.25, 0.5].forEach((offset) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const t = audioCtx.currentTime + offset;
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  });
}

startBtn.addEventListener("click", start);
pauseBtn.addEventListener("click", pause);
resetBtn.addEventListener("click", reset);

/* ---------- Stats (reset every new day) ---------- */
const STATS_KEY = "focusflow.stats";
const sessionsEl = document.getElementById("stat-sessions");
const minutesEl = document.getElementById("stat-minutes");

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function loadStats() {
  try {
    const saved = JSON.parse(localStorage.getItem(STATS_KEY));
    if (saved && saved.date === todayKey()) return saved;
  } catch (e) {}
  return { date: todayKey(), sessions: 0, minutes: 0 };
}

function saveStats() {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch (e) {}
}

function renderStats() {
  sessionsEl.textContent = stats.sessions;
  minutesEl.textContent = stats.minutes;
}

function recordSession() {
  stats = loadStats(); // picks up a new day if the page was left open overnight
  stats.sessions += 1;
  stats.minutes += DURATIONS.focus / 60;
  saveStats();
  renderStats();
}

let stats = loadStats();

/* ---------- Tasks ---------- */
const TASKS_KEY = "focusflow.tasks";
const taskInput = document.getElementById("task-input");
const taskList = document.getElementById("task-list");
let newTaskId = null; // the task that should animate in on the next render

function loadTasks() {
  try { return JSON.parse(localStorage.getItem(TASKS_KEY)) || []; } catch (e) { return []; }
}

function saveTasks() {
  try { localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)); } catch (e) {}
}

function renderTasks() {
  taskList.innerHTML = "";
  if (tasks.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No tasks yet. Type one above and press Enter.";
    taskList.appendChild(empty);
    return;
  }
  tasks.forEach((task) => {
    const li = document.createElement("li");
    li.className = "task" + (task.done ? " done" : "") + (task.id === newTaskId ? " enter" : "");
    li.dataset.id = task.id;

    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = task.done;
    check.setAttribute("aria-label", "Mark done");

    const label = document.createElement("span");
    label.className = "label";
    label.textContent = task.text;

    const del = document.createElement("button");
    del.className = "delete";
    del.textContent = "×";
    del.setAttribute("aria-label", "Delete task");

    li.append(check, label, del);
    taskList.appendChild(li);
  });
  newTaskId = null;
}

function addTask(text) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  newTaskId = id;
  tasks.push({ id, text, done: false });
  saveTasks();
  renderTasks();
  taskList.scrollTop = taskList.scrollHeight;
}

taskInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const text = taskInput.value.trim();
  if (!text) return;
  addTask(text);
  taskInput.value = "";
});

taskList.addEventListener("click", (e) => {
  const li = e.target.closest(".task");
  if (!li) return;
  if (e.target.matches(".delete")) {
    tasks = tasks.filter((t) => t.id !== li.dataset.id);
  } else if (e.target.matches("input[type=checkbox]")) {
    const task = tasks.find((t) => t.id === li.dataset.id);
    task.done = e.target.checked;
  } else {
    return;
  }
  saveTasks();
  renderTasks();
});

let tasks = loadTasks();

/* ---------- Theme ---------- */
const THEME_KEY = "focusflow.theme";
const THEME_COLORS = { dark: "#12101a", light: "#f3f0fa" };
const themeBtn = document.getElementById("theme-toggle");
const themeColorMeta = document.querySelector('meta[name="theme-color"]');

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeBtn.textContent = theme === "dark" ? "\u2600" : "\u263E";
  themeBtn.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
  themeColorMeta.setAttribute("content", THEME_COLORS[theme]);
}

themeBtn.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  applyTheme(next);
  try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
});

applyTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");

/* ---------- Spacebar shortcut ---------- */
// Skip when typing, or when Space should tick a checkbox or press Delete
const SPACE_IGNORED = "input, textarea, select, .delete, [contenteditable]";

document.addEventListener("keydown", (e) => {
  if (e.code !== "Space" || e.target.closest(SPACE_IGNORED)) return;
  e.preventDefault(); // stops page scroll and focused-button clicks
  if (e.repeat) return;
  if (timerId === null) start(); else pause();
});

document.addEventListener("keyup", (e) => {
  if (e.code === "Space" && !e.target.closest(SPACE_IGNORED)) e.preventDefault();
});

render();
renderStats();
renderTasks();
