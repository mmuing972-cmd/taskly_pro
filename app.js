/* Taskly Pro - World-Class Productivity App */

// ===== STATE MANAGEMENT =====
const Store = {
    get: (key, def = null) => {
        try { return JSON.parse(localStorage.getItem(`taskly_${key}`)) || def; }
        catch { return def; }
    },
    set: (key, val) => localStorage.setItem(`taskly_${key}`, JSON.stringify(val)),
    remove: (key) => localStorage.removeItem(`taskly_${key}`)
};

const State = {
    tasks: Store.get('tasks', []),
    notes: Store.get('notes', []),
    habits: Store.get('habits', []),
    stats: Store.get('stats', {
        points: 0, level: 1, streak: 0, bestStreak: 0,
        lastActive: null, completedTasks: 0, pomodoroSessions: 0, focusMinutes: 0,
        weeklyData: [0, 0, 0, 0, 0, 0, 0]
    }),
    theme: Store.get('theme', 'dark'),
    currentTab: 'tasks',
    editingTask: null,
    editingNote: null,
    selectedPriority: 'low'
};

// ===== UTILITIES =====
const genId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const safeSet = (sel, prop, val) => { const el = $(sel); if (el) el[prop] = val; };
const safeText = (sel, val) => safeSet(sel, 'textContent', val);
const today = () => new Date().toISOString().split('T')[0];
const isToday = (d) => d && d === today();
const isOverdue = (d) => d && new Date(d) < new Date(today());

// Debounce utility to prevent rapid clicks causing lag
const debounce = (fn, delay = 300) => {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
};

// Throttle utility for scroll/resize events
const throttle = (fn, limit = 100) => {
    let waiting = false;
    return (...args) => {
        if (!waiting) {
            fn(...args);
            waiting = true;
            setTimeout(() => waiting = false, limit);
        }
    };
};

function formatDate(d) {
    if (!d) return '';
    const date = new Date(d);
    return date.toLocaleDateString('ar-SA', { weekday: 'short', month: 'short', day: 'numeric' });
}

function showToast(msg, type = 'info') {
    const container = $('#toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// ===== THEME =====
function initTheme() {
    document.documentElement.setAttribute('data-theme', State.theme);
}
function toggleTheme() {
    State.theme = State.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', State.theme);
    Store.set('theme', State.theme);
}

// ===== NAVIGATION =====
function switchTab(tab) {
    State.currentTab = tab;
    $$('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    $$('.tab-content').forEach(c => c.classList.toggle('active', c.id === `${tab}Tab`));

    switch (tab) {
        case 'tasks': renderTasks(); break;
        case 'notes': renderNotes(); break;
        case 'habits': renderHabits(); break;
        case 'stats': renderStats(); break;
        case 'pomodoro': break;
    }
}

// ===== TASKS =====
function getFilteredTasks(cat = 'all') {
    let tasks = [...State.tasks];
    switch (cat) {
        case 'today': return tasks.filter(t => !t.completed && isToday(t.dueDate));
        case 'upcoming': return tasks.filter(t => !t.completed && t.dueDate && !isToday(t.dueDate) && !isOverdue(t.dueDate));
        case 'important': return tasks.filter(t => !t.completed && (t.priority === 'urgent' || t.priority === 'high'));
        case 'completed': return tasks.filter(t => t.completed);
        default: return tasks.filter(t => !t.completed);
    }
}

function renderTasks() {
    const cat = $('.cat-tab.active')?.dataset.category || 'all';
    const tasks = getFilteredTasks(cat);
    const list = $('#tasksList');
    const empty = $('#tasksEmptyState');

    if (tasks.length === 0) {
        list.innerHTML = '';
        empty.classList.remove('hidden');
        empty.style.display = 'flex';
    } else {
        empty.classList.add('hidden');
        empty.style.display = 'none';
        list.innerHTML = tasks.map(t => createTaskHTML(t)).join('');
    }
    updateCounts();
}

function createTaskHTML(task) {
    const priorityClass = task.priority ? `priority-${task.priority}` : '';
    const completedClass = task.completed ? 'completed' : '';

    let tags = '';
    if (task.dueDate) {
        if (isOverdue(task.dueDate) && !task.completed) {
            tags += `<span class="task-tag overdue">⚠️ متأخر</span>`;
        } else if (isToday(task.dueDate)) {
            tags += `<span class="task-tag today">📅 اليوم</span>`;
        } else {
            tags += `<span class="task-tag">📅 ${formatDate(task.dueDate)}</span>`;
        }
    }
    if (task.recurrence && task.recurrence !== 'none') {
        tags += `<span class="task-tag recurring">🔄 متكرر</span>`;
    }

    let subtasksHTML = '';
    if (task.subtasks && task.subtasks.length > 0) {
        const done = task.subtasks.filter(s => s.done).length;
        const pct = (done / task.subtasks.length) * 100;
        subtasksHTML = `
            <div class="subtask-progress">
                <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
                <span class="progress-text">${done}/${task.subtasks.length}</span>
            </div>`;
    }

    return `
        <li class="task-item ${priorityClass} ${completedClass}" data-id="${task.id}">
            <label class="task-checkbox">
                <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask('${task.id}')">
                <span class="checkmark"></span>
            </label>
            <div class="task-content" onclick="openTaskModal('${task.id}')">
                <h4 class="task-title">${escapeHTML(task.title)}</h4>
                ${task.notes ? `<p class="task-desc">${escapeHTML(task.notes)}</p>` : ''}
                <div class="task-meta">${tags}</div>
                ${subtasksHTML}
            </div>
            <div class="task-actions">
                <button class="task-action" onclick="event.stopPropagation(); openTaskModal('${task.id}')" title="تعديل">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                        <path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button>
                <button class="task-action delete" onclick="event.stopPropagation(); deleteTask('${task.id}')" title="حذف">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                    </svg>
                </button>
            </div>
        </li>`;
}

function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function addTask() {
    const input = $('#taskInput');
    const title = input.value.trim();
    if (!title) { showToast('أدخل عنوان المهمة', 'error'); return; }

    const task = {
        id: genId(),
        title,
        notes: $('#taskNotes')?.value.trim() || '',
        dueDate: $('#taskDueDate')?.value || null,
        dueTime: $('#taskDueTime')?.value || null,
        priority: State.selectedPriority,
        recurrence: $('#taskRecurrence')?.value || 'none',
        customDays: getSelectedDays('#customDaysGroup'),
        subtasks: [],
        completed: false,
        createdAt: new Date().toISOString()
    };

    State.tasks.unshift(task);
    saveTasks();
    renderTasks();
    clearTaskForm();
    showToast('✓ تمت إضافة المهمة', 'success');
    addPoints(5);
}

function clearTaskForm() {
    $('#taskInput').value = '';
    if ($('#taskNotes')) $('#taskNotes').value = '';
    if ($('#taskDueDate')) $('#taskDueDate').value = '';
    if ($('#taskDueTime')) $('#taskDueTime').value = '';
    if ($('#taskRecurrence')) $('#taskRecurrence').value = 'none';
    $('#expandedOptions')?.classList.add('hidden');
    $$('.priority-btn').forEach(b => b.classList.toggle('active', b.dataset.priority === 'low'));
    State.selectedPriority = 'low';
}

function toggleTask(id) {
    const task = State.tasks.find(t => t.id === id);
    if (!task) return;

    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date().toISOString() : null;

    if (task.completed) {
        addPoints(10);
        State.stats.completedTasks++;
        updateStreak();
        updateWeeklyData();

        if (task.recurrence && task.recurrence !== 'none') {
            createRecurringTask(task);
        }
        showToast('🎉 أحسنت! تم إنجاز المهمة', 'success');
    }

    saveTasks();
    saveStats();
    renderTasks();
}

function createRecurringTask(task) {
    const next = calculateNextDate(task);
    if (!next) return;

    const newTask = { ...task, id: genId(), completed: false, completedAt: null, dueDate: next };
    State.tasks.push(newTask);
}

function calculateNextDate(task) {
    const curr = task.dueDate ? new Date(task.dueDate) : new Date();
    switch (task.recurrence) {
        case 'daily': curr.setDate(curr.getDate() + 1); break;
        case 'weekdays':
            do { curr.setDate(curr.getDate() + 1); } while (curr.getDay() === 0 || curr.getDay() === 6);
            break;
        case 'weekly': curr.setDate(curr.getDate() + 7); break;
        case 'monthly': curr.setMonth(curr.getMonth() + 1); break;
        default: return null;
    }
    return curr.toISOString().split('T')[0];
}

function deleteTask(id) {
    if (!confirm('حذف هذه المهمة؟')) return;
    State.tasks = State.tasks.filter(t => t.id !== id);
    saveTasks();
    renderTasks();
    showToast('تم الحذف', 'info');
}

function saveTasks() { Store.set('tasks', State.tasks); }

function updateCounts() {
    const all = State.tasks.filter(t => !t.completed).length;
    const todayCount = State.tasks.filter(t => !t.completed && isToday(t.dueDate)).length;
    const completed = State.tasks.filter(t => t.completed && isToday(t.completedAt?.split('T')[0])).length;

    safeText('#tasksBadge', all);
    safeText('#totalTasks', State.tasks.length);
    safeText('#completedToday', completed);
    safeText('#pendingTasks', all);
    safeText('#todayBadge', todayCount);
    safeText('#currentStreak', State.stats.streak);

    // Update streak bar progress (7 days = 100%)
    const streakBar = $('#streakBar');
    if (streakBar) streakBar.style.width = `${Math.min(State.stats.streak / 7 * 100, 100)}%`;
}

// ===== TASK MODAL =====
function openTaskModal(id) {
    const task = State.tasks.find(t => t.id === id);
    if (!task) return;
    State.editingTask = task;

    $('#editTitle').value = task.title || '';
    $('#editDescription').value = task.notes || '';
    $('#editDate').value = task.dueDate || '';
    $('#editTime').value = task.dueTime || '';
    $('#editRecurrence').value = task.recurrence || 'none';

    $$('#editPriorities .priority-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.priority === task.priority);
    });

    renderSubtasks(task);
    $('#taskModal').classList.remove('hidden');
}

function closeTaskModal() {
    $('#taskModal').classList.add('hidden');
    State.editingTask = null;
}

function saveTaskModal() {
    if (!State.editingTask) return;

    State.editingTask.title = $('#editTitle').value.trim();
    State.editingTask.notes = $('#editDescription').value.trim();
    State.editingTask.dueDate = $('#editDate').value || null;
    State.editingTask.dueTime = $('#editTime').value || null;
    State.editingTask.recurrence = $('#editRecurrence').value;
    State.editingTask.priority = $('#editPriorities .priority-btn.active')?.dataset.priority || 'low';

    saveTasks();
    renderTasks();
    closeTaskModal();
    showToast('✓ تم الحفظ', 'success');
}

function renderSubtasks(task) {
    const container = $('#editSubtasks');
    if (!task.subtasks || task.subtasks.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">لا توجد مهام فرعية</p>';
        return;
    }
    container.innerHTML = task.subtasks.map((s, i) => `
        <div class="subtask-item ${s.done ? 'done' : ''}">
            <input type="checkbox" ${s.done ? 'checked' : ''} onchange="toggleSubtask(${i})">
            <span>${escapeHTML(s.title)}</span>
            <button class="subtask-del" onclick="deleteSubtask(${i})">✕</button>
        </div>
    `).join('');
}

function addSubtask() {
    if (!State.editingTask) return;
    const input = $('#newSubtask');
    const title = input.value.trim();
    if (!title) return;

    if (!State.editingTask.subtasks) State.editingTask.subtasks = [];
    State.editingTask.subtasks.push({ title, done: false });
    input.value = '';
    saveTasks();
    renderSubtasks(State.editingTask);
}

function toggleSubtask(idx) {
    if (!State.editingTask?.subtasks?.[idx]) return;
    State.editingTask.subtasks[idx].done = !State.editingTask.subtasks[idx].done;
    saveTasks();
    renderSubtasks(State.editingTask);
    renderTasks();
}

function deleteSubtask(idx) {
    if (!State.editingTask?.subtasks) return;
    State.editingTask.subtasks.splice(idx, 1);
    saveTasks();
    renderSubtasks(State.editingTask);
}

// ===== NOTES =====
function renderNotes() {
    const grid = $('#notesGrid');
    const empty = $('#notesEmptyState');

    const sorted = [...State.notes].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

    if (sorted.length === 0) {
        grid.innerHTML = '';
        empty.classList.remove('hidden');
        empty.style.display = 'flex';
    } else {
        empty.classList.add('hidden');
        empty.style.display = 'none';
        grid.innerHTML = sorted.map(n => `
            <div class="note-card ${n.color || ''}" data-id="${n.id}" onclick="openNoteModal('${n.id}')">
                ${n.pinned ? '<span class="note-pin">📌</span>' : ''}
                ${n.title ? `<h4 class="note-title">${escapeHTML(n.title)}</h4>` : ''}
                <p class="note-content">${escapeHTML(n.content)}</p>
                <span class="note-date">${formatDate(n.createdAt)}</span>
            </div>
        `).join('');
    }
}

function openNoteModal(id = null) {
    if (id) {
        State.editingNote = State.notes.find(n => n.id === id);
        if (!State.editingNote) return;
        $('#noteTitle').value = State.editingNote.title || '';
        $('#noteContent').value = State.editingNote.content || '';
        $$('#noteColors .color-dot').forEach(d => d.classList.toggle('active', d.dataset.color === (State.editingNote.color || 'default')));
        $('#pinNoteBtn').classList.toggle('active', State.editingNote.pinned);
    } else {
        State.editingNote = null;
        $('#noteTitle').value = '';
        $('#noteContent').value = '';
        $$('#noteColors .color-dot').forEach(d => d.classList.toggle('active', d.dataset.color === 'default'));
        $('#pinNoteBtn').classList.remove('active');
    }
    $('#noteModal').classList.remove('hidden');
}

function closeNoteModal() {
    $('#noteModal').classList.add('hidden');
    State.editingNote = null;
}

function saveNote() {
    const title = $('#noteTitle').value.trim();
    const content = $('#noteContent').value.trim();
    if (!title && !content) { closeNoteModal(); return; }

    const color = $('#noteColors .color-dot.active')?.dataset.color || 'default';
    const pinned = $('#pinNoteBtn').classList.contains('active');

    if (State.editingNote) {
        State.editingNote.title = title;
        State.editingNote.content = content;
        State.editingNote.color = color;
        State.editingNote.pinned = pinned;
    } else {
        State.notes.unshift({ id: genId(), title, content, color, pinned, createdAt: today() });
        addPoints(3);
    }

    Store.set('notes', State.notes);
    renderNotes();
    closeNoteModal();
    showToast('✓ تم حفظ الملاحظة', 'success');
}

function deleteNote() {
    if (!State.editingNote) return;
    if (!confirm('حذف هذه الملاحظة؟')) return;
    State.notes = State.notes.filter(n => n.id !== State.editingNote.id);
    Store.set('notes', State.notes);
    renderNotes();
    closeNoteModal();
}

// ===== HABITS =====
function renderHabits() {
    renderWeekDays();
    const list = $('#habitsList');
    const empty = $('#habitsEmptyState');

    if (State.habits.length === 0) {
        list.innerHTML = '';
        empty.classList.remove('hidden');
        empty.style.display = 'flex';
    } else {
        empty.classList.add('hidden');
        empty.style.display = 'none';
        list.innerHTML = State.habits.map(h => createHabitHTML(h)).join('');
    }
}

function renderWeekDays() {
    const container = $('#weekDays');
    const days = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
    const now = new Date();
    const todayIdx = now.getDay();

    let html = '';
    for (let i = 0; i < 7; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - todayIdx + i);
        const isT = i === todayIdx;
        html += `
            <div class="week-day ${isT ? 'today' : ''}">
                <div class="week-day-name">${days[i]}</div>
                <div class="week-day-num">${d.getDate()}</div>
            </div>`;
    }
    container.innerHTML = html;
}

function createHabitHTML(habit) {
    const todayDone = habit.log?.includes(today());
    const streak = calculateHabitStreak(habit);
    return `
        <li class="habit-item" data-id="${habit.id}">
            <span class="habit-emoji">${habit.emoji}</span>
            <div class="habit-info">
                <div class="habit-name">${escapeHTML(habit.name)}</div>
                <div class="habit-streak">🔥 ${streak} يوم</div>
            </div>
            <button class="habit-check ${todayDone ? 'done' : ''}" onclick="toggleHabit('${habit.id}')">
                ${todayDone ? '✓' : ''}
            </button>
        </li>`;
}

function calculateHabitStreak(habit) {
    if (!habit.log || habit.log.length === 0) return 0;
    let streak = 0;
    const sorted = [...habit.log].sort().reverse();
    let checkDate = new Date(today());

    for (const log of sorted) {
        if (log === checkDate.toISOString().split('T')[0]) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else break;
    }
    return streak;
}

function toggleHabit(id) {
    const habit = State.habits.find(h => h.id === id);
    if (!habit) return;

    if (!habit.log) habit.log = [];
    const t = today();
    const idx = habit.log.indexOf(t);

    if (idx > -1) {
        habit.log.splice(idx, 1);
    } else {
        habit.log.push(t);
        addPoints(5);
        updateStreak();
        showToast('🎉 أحسنت!', 'success');
    }

    Store.set('habits', State.habits);
    renderHabits();
}

function openHabitModal() {
    $('#habitName').value = '';
    $$('#habitEmojis .emoji-btn').forEach(b => b.classList.toggle('active', b.dataset.emoji === '📚'));
    $('#habitGoal').value = 1;
    $('#habitModal').classList.remove('hidden');
}

function closeHabitModal() { $('#habitModal').classList.add('hidden'); }

function saveHabit() {
    const name = $('#habitName').value.trim();
    if (!name) { showToast('أدخل اسم العادة', 'error'); return; }

    const emoji = $('#habitEmojis .emoji-btn.active')?.dataset.emoji || '📚';
    const goal = parseInt($('#habitGoal').value) || 1;

    State.habits.push({ id: genId(), name, emoji, goal, log: [], createdAt: today() });
    Store.set('habits', State.habits);
    renderHabits();
    closeHabitModal();
    showToast('✓ تم إضافة العادة', 'success');
}

// ===== POMODORO =====
const Pomodoro = {
    durations: { focus: 25 * 60, shortBreak: 5 * 60, longBreak: 15 * 60 },
    mode: 'focus',
    remaining: 25 * 60,
    running: false,
    interval: null,
    sessions: 0,

    init() {
        // Initialize timer ring with proper strokeDasharray
        const ring = $('#timerRing');
        if (ring) {
            const circ = 2 * Math.PI * 90;
            ring.style.strokeDasharray = circ;
            ring.style.strokeDashoffset = 0;
        }
        const focusRing = $('#focusRingProgress');
        if (focusRing) {
            const focusCirc = 2 * Math.PI * 140;
            focusRing.style.strokeDasharray = focusCirc;
            focusRing.style.strokeDashoffset = 0;
        }
        this.updateDisplay();
        this.updateSessionDots();
    },

    setMode(mode) {
        this.mode = mode;
        this.remaining = this.durations[mode];
        this.running = false;
        clearInterval(this.interval);
        this.updateDisplay();
        this.updateModeButtons();
        this.showPlay();
    },

    toggle() {
        if (this.running) this.pause();
        else this.start();
    },

    start() {
        this.running = true;
        this.showPause();
        this.interval = setInterval(() => {
            this.remaining--;
            this.updateDisplay();
            if (this.remaining <= 0) this.complete();
        }, 1000);
    },

    pause() {
        this.running = false;
        clearInterval(this.interval);
        this.showPlay();
    },

    reset() {
        this.pause();
        this.remaining = this.durations[this.mode];
        this.updateDisplay();
    },

    skip() { this.complete(); },

    complete() {
        this.pause();
        if (this.mode === 'focus') {
            this.sessions++;
            State.stats.pomodoroSessions++;
            State.stats.focusMinutes += 25;
            addPoints(15);
            updateWeeklyData();
            saveStats();
            this.updateSessionDots();
            showToast('🎉 انتهت جلسة التركيز!', 'success');
            this.playSound();
            const next = this.sessions % 4 === 0 ? 'longBreak' : 'shortBreak';
            this.setMode(next);
        } else {
            showToast('انتهت الاستراحة! هيا نعود للعمل 💪', 'info');
            this.setMode('focus');
        }
        this.updateStats();
    },

    updateDisplay() {
        const min = Math.floor(this.remaining / 60);
        const sec = this.remaining % 60;
        const timeStr = { min: min.toString().padStart(2, '0'), sec: sec.toString().padStart(2, '0') };

        safeText('#timerMin', timeStr.min);
        safeText('#timerSec', timeStr.sec);
        safeText('#focusMin', timeStr.min);
        safeText('#focusSec', timeStr.sec);

        const total = this.durations[this.mode];
        const pct = (total - this.remaining) / total;
        const circ = 2 * Math.PI * 90;
        const focusCirc = 2 * Math.PI * 140;

        const ring = $('#timerRing');
        if (ring) ring.style.strokeDashoffset = circ * (1 - pct);
        const focusRing = $('#focusRingProgress');
        if (focusRing) focusRing.style.strokeDashoffset = focusCirc * (1 - pct);
    },

    updateModeButtons() {
        $$('.pomo-mode').forEach(b => b.classList.toggle('active', b.dataset.mode === this.mode));
    },

    updateSessionDots() {
        $$('.session-dot').forEach((d, i) => {
            d.classList.remove('completed', 'active');
            if (i < this.sessions % 4) d.classList.add('completed');
            else if (i === this.sessions % 4 && this.mode === 'focus') d.classList.add('active');
        });
    },

    updateStats() {
        safeText('#todaySessions', State.stats.pomodoroSessions);
        safeText('#todayMinutes', State.stats.focusMinutes);
        safeText('#bestStreak', State.stats.bestStreak);
    },

    showPlay() {
        $('#playIcon').classList.remove('hidden');
        $('#pauseIcon').classList.add('hidden');
        $('#focusPlayIcon')?.classList.remove('hidden');
        $('#focusPauseIcon')?.classList.add('hidden');
    },

    showPause() {
        $('#playIcon').classList.add('hidden');
        $('#pauseIcon').classList.remove('hidden');
        $('#focusPlayIcon')?.classList.add('hidden');
        $('#focusPauseIcon')?.classList.remove('hidden');
    },

    playSound() {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 800;
        gain.gain.value = 0.3;
        osc.start();
        setTimeout(() => osc.stop(), 200);
    }
};

// ===== AMBIENT SOUNDS SYSTEM =====
// Only 3 sounds: Rain, Ocean, Fire (as requested)

const Ambient = {
    audio: null,
    current: null,
    isLoading: false,

    // 3 working sounds with verified Mixkit URLs
    sounds: {
        rain: {
            name: 'مطر',
            emoji: '🌧️',
            urls: [
                'https://assets.mixkit.co/active_storage/sfx/2515/2515-preview.mp3',
                'https://assets.mixkit.co/active_storage/sfx/2516/2516-preview.mp3'
            ]
        },
        ocean: {
            name: 'محيط',
            emoji: '🌊',
            urls: [
                'https://assets.mixkit.co/active_storage/sfx/2431/2431-preview.mp3',
                'https://assets.mixkit.co/active_storage/sfx/2189/2189-preview.mp3'
            ]
        },
        fire: {
            name: 'موقد',
            emoji: '🔥',
            // Freesound.org campfire crackling - verified real fire sounds
            urls: [
                'https://cdn.freesound.org/previews/157/157950_2552041-lq.mp3',
                'https://cdn.freesound.org/previews/351/351543_5121236-lq.mp3',
                'https://cdn.freesound.org/previews/558/558117_8676212-lq.mp3'
            ]
        }
    },

    async play(soundKey) {
        // Toggle off if same sound or 'none'
        if (soundKey === 'none' || soundKey === this.current) {
            this.stop();
            return;
        }

        // Validate sound exists
        const sound = this.sounds[soundKey];
        if (!sound || !sound.urls || sound.urls.length === 0) {
            showToast('❌ صوت غير متوفر', 'error');
            return;
        }

        // Stop current
        this.stop();

        // Set loading state
        this.isLoading = true;
        this.current = soundKey;
        this.updateButtons();

        // Try each URL until one works
        let success = false;
        for (const url of sound.urls) {
            try {
                success = await this.loadAndPlay(url);
                if (success) {
                    console.log(`✅ Playing: ${sound.name} from ${url}`);
                    showToast(`${sound.emoji} ${sound.name}`, 'success');
                    break;
                }
            } catch (e) {
                console.warn(`⚠️ Failed: ${url}`, e.message);
            }
        }

        if (!success) {
            this.stop();
            showToast(`❌ تعذر تشغيل ${sound.name}`, 'error');
        }

        this.isLoading = false;
        this.updateButtons();
    },

    loadAndPlay(src) {
        return new Promise((resolve, reject) => {
            this.audio = new Audio(src);
            this.audio.loop = true;
            this.audio.volume = (parseInt($('#volumeSlider')?.value) || 60) / 100;

            // Timeout after 8 seconds
            const timeout = setTimeout(() => {
                reject(new Error('Timeout'));
            }, 8000);

            this.audio.oncanplaythrough = async () => {
                clearTimeout(timeout);
                try {
                    await this.audio.play();
                    resolve(true);
                } catch (e) {
                    reject(e);
                }
            };

            this.audio.onerror = () => {
                clearTimeout(timeout);
                reject(new Error('Load failed'));
            };

            // Start loading
            this.audio.load();
        });
    },

    stop() {
        if (this.audio) {
            this.audio.pause();
            this.audio.currentTime = 0;
            this.audio.src = '';
            this.audio = null;
        }
        this.current = null;
        this.isLoading = false;
        this.updateButtons();
    },

    setVolume(value) {
        const vol = parseInt(value) / 100;
        if (this.audio) {
            this.audio.volume = Math.max(0, Math.min(1, vol));
        }
    },

    updateButtons() {
        $$('.sound-card').forEach(btn => {
            const key = btn.dataset.sound;
            const isActive = key === this.current;
            const isLoading = isActive && this.isLoading;

            btn.classList.toggle('active', isActive);
            btn.classList.toggle('loading', isLoading);

            // Add visual feedback
            if (isLoading) {
                btn.style.opacity = '0.7';
            } else {
                btn.style.opacity = '1';
            }
        });
    }
};

// ===== FOCUS MODE =====
function enterFocusMode() { $('#focusOverlay').classList.remove('hidden'); }
function exitFocusMode() { $('#focusOverlay').classList.add('hidden'); }

// ===== SPEECH =====
const Speech = {
    recognition: null,

    init() {
        if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            $('#voiceBtn')?.style.setProperty('display', 'none');
            return;
        }
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SR();
        this.recognition.lang = 'ar-SA';
        this.recognition.continuous = false;

        this.recognition.onresult = (e) => {
            $('#taskInput').value = e.results[0][0].transcript;
            this.stop();
            showToast('✓ تم التعرف', 'success');
        };
        this.recognition.onerror = () => this.stop();
        this.recognition.onend = () => this.stop();
    },

    toggle() {
        if ($('#voiceBtn').classList.contains('recording')) this.stop();
        else this.start();
    },

    start() {
        if (!this.recognition) return;
        this.recognition.start();
        $('#voiceBtn').classList.add('recording');
    },

    stop() {
        if (this.recognition) this.recognition.stop();
        $('#voiceBtn').classList.remove('recording');
    }
};

// ===== GAMIFICATION =====
const LEVELS = [
    { name: 'مبتدئ', min: 0 },
    { name: 'متعلم', min: 100 },
    { name: 'منتج', min: 300 },
    { name: 'محترف', min: 600 },
    { name: 'خبير', min: 1000 },
    { name: 'ماستر', min: 1500 },
    { name: 'أسطورة', min: 2500 }
];

const ACHIEVEMENTS = [
    { id: 'first_task', icon: '🎯', name: 'أول مهمة', desc: 'أنجز أول مهمة', check: () => State.stats.completedTasks >= 1 },
    { id: 'ten_tasks', icon: '🔟', name: '10 مهام', desc: 'أنجز 10 مهام', check: () => State.stats.completedTasks >= 10 },
    { id: 'streak_3', icon: '🔥', name: 'سلسلة 3 أيام', desc: '3 أيام متتالية', check: () => State.stats.streak >= 3 },
    { id: 'streak_7', icon: '💪', name: 'أسبوع كامل', desc: '7 أيام متتالية', check: () => State.stats.streak >= 7 },
    { id: 'pomo_5', icon: '🍅', name: '5 جلسات', desc: '5 جلسات بومودورو', check: () => State.stats.pomodoroSessions >= 5 },
    { id: 'focus_hour', icon: '⏰', name: 'ساعة تركيز', desc: '60 دقيقة تركيز', check: () => State.stats.focusMinutes >= 60 }
];

function addPoints(pts) {
    const oldLevel = getLevel(State.stats.points);
    State.stats.points += pts;
    const newLevel = getLevel(State.stats.points);

    if (newLevel.name !== oldLevel.name) {
        State.stats.level = LEVELS.indexOf(newLevel) + 1;
        showLevelUp(State.stats.level);
    }
    saveStats();
    updatePointsDisplay();
}

function getLevel(pts) {
    for (let i = LEVELS.length - 1; i >= 0; i--) {
        if (pts >= LEVELS[i].min) return LEVELS[i];
    }
    return LEVELS[0];
}

function showLevelUp(level) {
    $('#newLevel').textContent = level;
    $('#levelUpOverlay').classList.remove('hidden');
}

function closeLevelUp() { $('#levelUpOverlay').classList.add('hidden'); }

function updatePointsDisplay() {
    const level = getLevel(State.stats.points);
    const nextLevel = LEVELS[LEVELS.indexOf(level) + 1] || level;
    const levelIdx = LEVELS.indexOf(level) + 1;
    const progress = nextLevel === level ? 100 : ((State.stats.points - level.min) / (nextLevel.min - level.min)) * 100;

    $('#userLevel').textContent = levelIdx;
    $('#totalPoints').textContent = State.stats.points;
    $('#streakDays').textContent = State.stats.streak;

    if ($('#displayLevel')) $('#displayLevel').textContent = levelIdx;
    if ($('#levelTitle')) $('#levelTitle').textContent = level.name;
    if ($('#currentPoints')) $('#currentPoints').textContent = State.stats.points;
    if ($('#requiredPoints')) $('#requiredPoints').textContent = nextLevel.min;
    if ($('#levelFill')) $('#levelFill').style.width = `${progress}%`;
}

function updateStreak() {
    const t = today();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];

    if (State.stats.lastActive === t) return;

    if (State.stats.lastActive === yStr) {
        State.stats.streak++;
    } else if (State.stats.lastActive !== t) {
        State.stats.streak = 1;
    }

    if (State.stats.streak > State.stats.bestStreak) {
        State.stats.bestStreak = State.stats.streak;
    }

    State.stats.lastActive = t;
    saveStats();
}

function updateWeeklyData() {
    const day = new Date().getDay();
    State.stats.weeklyData[day]++;
}

function saveStats() { Store.set('stats', State.stats); }

// ===== STATS TAB =====
function renderStats() {
    updatePointsDisplay();

    $('#statTotalTasks').textContent = State.tasks.length;
    $('#statCompletedTasks').textContent = State.stats.completedTasks;
    $('#statPomodoroSessions').textContent = State.stats.pomodoroSessions;
    $('#statFocusHours').textContent = Math.floor(State.stats.focusMinutes / 60);
    $('#statCurrentStreak').textContent = State.stats.streak;
    $('#statBestStreak').textContent = State.stats.bestStreak;

    renderWeeklyChart();
    renderAchievements();
}

function renderWeeklyChart() {
    const max = Math.max(...State.stats.weeklyData, 1);
    const bars = State.stats.weeklyData.map(v => `<div class="chart-bar" style="height:${(v / max) * 100}%"></div>`);
    $('#weeklyChart .chart-bars').innerHTML = bars.join('');
}

function renderAchievements() {
    const grid = $('#achievementsGrid');
    grid.innerHTML = ACHIEVEMENTS.map(a => `
        <div class="achievement ${a.check() ? '' : 'locked'}">
            <span class="achievement-icon">${a.icon}</span>
            <span class="achievement-name">${a.name}</span>
        </div>
    `).join('');
}

// ===== FAB =====
function toggleFAB() {
    $('#fabMain').classList.toggle('active');
    $('#fabMenu').classList.toggle('active');
}

function handleFABAction(action) {
    toggleFAB();
    switch (action) {
        case 'task': switchTab('tasks'); $('#taskInput').focus(); break;
        case 'note': switchTab('notes'); openNoteModal(); break;
        case 'pomodoro': switchTab('pomodoro'); break;
        case 'habit': switchTab('habits'); openHabitModal(); break;
    }
}

// ===== HELPERS =====
function getSelectedDays(sel) {
    const days = [];
    $$(`${sel} input:checked`).forEach(cb => days.push(parseInt(cb.value)));
    return days;
}

// ===== EVENT LISTENERS =====
function initEvents() {
    // Theme
    $('#themeToggle').onclick = toggleTheme;

    // Navigation
    $$('.nav-tab').forEach(t => t.onclick = () => switchTab(t.dataset.tab));
    $$('.cat-tab').forEach(t => t.onclick = () => {
        $$('.cat-tab').forEach(c => c.classList.remove('active'));
        t.classList.add('active');
        renderTasks();
    });

    // Task Input
    $('#taskInput').onkeypress = e => { if (e.key === 'Enter') addTask(); };
    $('#quickAddBtn').onclick = addTask;
    $('#expandBtn').onclick = () => $('#expandedOptions').classList.toggle('hidden');
    $$('.priority-btn').forEach(b => b.onclick = () => {
        b.closest('.priority-options').querySelectorAll('.priority-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        State.selectedPriority = b.dataset.priority;
    });
    $('#taskRecurrence')?.addEventListener('change', e => {
        $('#customDaysGroup').classList.toggle('hidden', e.target.value !== 'custom');
    });

    // Task Modal
    $('#closeTaskModal').onclick = closeTaskModal;
    $('#saveTaskBtn').onclick = saveTaskModal;
    $('#deleteTaskBtn').onclick = () => { if (State.editingTask) { deleteTask(State.editingTask.id); closeTaskModal(); } };
    $('#addSubtaskBtn').onclick = addSubtask;
    $('#newSubtask').onkeypress = e => { if (e.key === 'Enter') addSubtask(); };

    // Notes
    $('#addNoteBtn').onclick = () => openNoteModal();
    $('#emptyNoteBtn')?.addEventListener('click', () => openNoteModal());
    $('#closeNoteModal').onclick = closeNoteModal;
    $('#saveNoteBtn').onclick = saveNote;
    $('#deleteNoteBtn').onclick = deleteNote;
    $('#pinNoteBtn').onclick = () => $('#pinNoteBtn').classList.toggle('active');
    $$('#noteColors .color-dot').forEach(d => d.onclick = () => {
        $$('#noteColors .color-dot').forEach(x => x.classList.remove('active'));
        d.classList.add('active');
    });

    // Habits
    $('#addHabitBtn').onclick = openHabitModal;
    $('#emptyHabitBtn')?.addEventListener('click', openHabitModal);
    $('#closeHabitModal').onclick = closeHabitModal;
    $('#cancelHabitBtn').onclick = closeHabitModal;
    $('#saveHabitBtn').onclick = saveHabit;
    $$('#habitEmojis .emoji-btn').forEach(b => b.onclick = () => {
        $$('#habitEmojis .emoji-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
    });

    // Pomodoro
    $$('.pomo-mode').forEach(b => b.onclick = () => Pomodoro.setMode(b.dataset.mode));
    $('#startTimer').onclick = () => Pomodoro.toggle();
    $('#resetTimer').onclick = () => Pomodoro.reset();
    $('#skipTimer').onclick = () => Pomodoro.skip();

    // Ambient
    $$('.sound-card').forEach(b => b.onclick = () => Ambient.play(b.dataset.sound));
    $('#volumeSlider').oninput = e => {
        Ambient.setVolume(e.target.value);
        $('#volumeValue').textContent = e.target.value + '%';
    };

    // Focus Mode
    $('#enterFocusMode').onclick = enterFocusMode;
    $('#exitFocusMode').onclick = exitFocusMode;
    $('#focusPlayPause').onclick = () => Pomodoro.toggle();
    $('#focusReset').onclick = () => Pomodoro.reset();
    $('#focusSkip').onclick = () => Pomodoro.skip();

    // FAB
    $('#fabMain').onclick = toggleFAB;
    $$('.fab-option').forEach(o => o.onclick = () => handleFABAction(o.dataset.action));

    // Voice
    $('#voiceBtn').onclick = () => Speech.toggle();

    // Level Up
    $('#closeLevelUp').onclick = closeLevelUp;

    // Empty state buttons
    $('#emptyAddBtn')?.addEventListener('click', () => $('#taskInput').focus());

    // ===== SETTINGS =====
    $('#settingsBtn').onclick = openSettings;
    $('#closeSettingsModal').onclick = closeSettings;
    $('#darkModeToggle').onclick = function () {
        this.classList.toggle('active');
        toggleTheme();
    };
    $('#exportDataBtn').onclick = exportData;
    $('#deleteAccountBtn').onclick = () => {
        closeSettings();
        $('#deleteConfirmModal').classList.remove('hidden');
    };
    $('#cancelDeleteBtn').onclick = () => $('#deleteConfirmModal').classList.add('hidden');
    $('#confirmDeleteBtn').onclick = deleteAllData;

    // Close modals on overlay click
    $$('.modal-overlay').forEach(m => m.onclick = e => { if (e.target === m) m.classList.add('hidden'); });

    // Keyboard shortcuts
    document.onkeydown = e => {
        if (e.key === 'Escape') $$('.modal-overlay').forEach(m => m.classList.add('hidden'));
    };
}

// ===== SETTINGS FUNCTIONS =====
function openSettings() {
    $('#settingsModal').classList.remove('hidden');
    // Sync dark mode toggle with current theme
    const isDark = State.theme === 'dark';
    $('#darkModeToggle').classList.toggle('active', isDark);
}

function closeSettings() {
    $('#settingsModal').classList.add('hidden');
}

function exportData() {
    const data = {
        tasks: State.tasks,
        notes: State.notes,
        habits: State.habits,
        stats: State.stats,
        exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `taskly-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('📥 تم تصدير البيانات بنجاح!', 'success');
    closeSettings();
}

function deleteAllData() {
    // Clear all localStorage
    localStorage.clear();

    // Reset state
    State.tasks = [];
    State.notes = [];
    State.habits = [];
    State.stats = {
        points: 0,
        streak: 0,
        bestStreak: 0,
        completedTasks: 0,
        pomodoroSessions: 0,
        focusMinutes: 0,
        lastActive: null,
        weeklyData: [0, 0, 0, 0, 0, 0, 0]
    };

    // Close modal
    $('#deleteConfirmModal').classList.add('hidden');

    // Show confirmation
    showToast('🗑️ تم حذف جميع البيانات', 'success');

    // Reload page
    setTimeout(() => location.reload(), 1500);
}

// ===== INIT =====
function init() {
    initTheme();
    initEvents();
    Speech.init();
    Pomodoro.init();

    renderTasks();
    updatePointsDisplay();
    Pomodoro.updateStats();

    console.log('🚀 Taskly Pro initialized!');
}

document.addEventListener('DOMContentLoaded', init);

// Global functions for onclick handlers
window.toggleTask = toggleTask;
window.deleteTask = deleteTask;
window.openTaskModal = openTaskModal;
window.toggleSubtask = toggleSubtask;
window.deleteSubtask = deleteSubtask;
window.openNoteModal = openNoteModal;
window.toggleHabit = toggleHabit;

// Register Service Worker for offline support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('✅ Service Worker registered'))
            .catch(err => console.log('SW registration failed:', err));
    });
}
