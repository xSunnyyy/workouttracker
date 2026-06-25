// =========================================
// Lift · main application
// =========================================
(() => {
  DB.load();

  // ---------- Helpers
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const el = (tag, attrs = {}, children = []) => {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) node.setAttribute(k, v);
    });
    (Array.isArray(children) ? children : [children]).forEach((c) => {
      if (c == null || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  };
  const fmtDate = (ts) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 86400 * 7) return Math.floor(diff / 86400) + 'd ago';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  const fmtDateLong = (ts) => new Date(ts).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const fmtDateOnly = (ts) => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  function fmtDuration(ms) {
    if (!ms || ms < 0) return '—';
    const totalMin = Math.max(0, Math.round(ms / 60000));
    if (totalMin < 60) return `${totalMin}m`;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }

  // ---------- Unit conversion
  const kgToLb = (kg) => kg == null ? null : kg * 2.20462;
  const lbToKg = (lb) => lb == null ? null : lb / 2.20462;
  const cmToIn = (cm) => cm == null ? null : cm / 2.54;
  const inToCm = (inches) => inches == null ? null : inches * 2.54;
  const roundTo = (n, places = 1) => {
    if (n == null || isNaN(n)) return null;
    const f = Math.pow(10, places);
    return Math.round(n * f) / f;
  };

  // SVG body thumb helper — returns an element wrapping the SVG markup.
  function bodyThumb(exercise, opts = {}) {
    const wrap = document.createElement('div');
    wrap.innerHTML = ILLUSTRATIONS.bodySVG({
      view: exercise.view || 'front',
      active: exercise.primary || [],
      ...opts,
    });
    return wrap.firstElementChild;
  }
  function equipBadge(equipment) {
    const wrap = document.createElement('div');
    wrap.className = 'equip-badge';
    wrap.title = equipment || '';
    wrap.innerHTML = ILLUSTRATIONS.equipIcon(equipment);
    return wrap;
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 1800);
  }

  // ---------- Theme + Settings
  function applyTheme(theme) {
    document.body.dataset.theme = theme;
    DB.setSetting('theme', theme);
    $$('#theme-seg button').forEach((b) => b.classList.toggle('active', b.dataset.theme === theme));
  }

  function applyUnit(unit) {
    DB.setSetting('unit', unit);
    $$('#unit-seg button').forEach((b) => b.classList.toggle('active', b.dataset.unit === unit));
    $$('.unit').forEach((u) => (u.textContent = unit));
    // Re-render metrics if settings page is open so labels switch immediately
    if ($('#metrics-fields')) renderMetricsFields();
  }

  // ---------- Navigation
  let currentPage = 'home';
  function navigate(page) {
    if (currentPage === page) return;
    currentPage = page;
    $$('.page').forEach((p) => p.classList.toggle('hidden', p.dataset.page !== page));
    $$('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.nav === page));
    if (page === 'home') renderHome();
    if (page === 'history') renderHistory();
    if (page === 'exercises') renderExercises();
    if (page === 'macros') renderMacros();
    if (page === 'settings') renderSettings();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  $$('.nav-item').forEach((n) => n.addEventListener('click', () => navigate(n.dataset.nav)));

  // ---------- Modal manager
  const modalRoot = $('#modal-root');
  function openModal({ title, body, footer, fullHeight = false }) {
    closeModal();
    const backdrop = el('div', { class: 'modal-backdrop', onclick: (e) => { if (e.target === backdrop) closeModal(); } });
    const modal = el('div', { class: 'modal' });
    if (fullHeight) modal.style.height = '92vh';
    modal.appendChild(el('div', { class: 'modal-handle' }));
    const header = el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-title' }, title || ''),
      el('button', {
        class: 'modal-close',
        onclick: closeModal,
        'aria-label': 'Close',
        html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
      }),
    ]);
    modal.appendChild(header);
    const bodyEl = el('div', { class: 'modal-body' });
    if (body) bodyEl.appendChild(body);
    modal.appendChild(bodyEl);
    if (footer) {
      const f = el('div', { class: 'modal-footer' });
      footer.forEach((b) => f.appendChild(b));
      modal.appendChild(f);
    }
    backdrop.appendChild(modal);
    modalRoot.appendChild(backdrop);
    document.body.style.overflow = 'hidden';
    return { backdrop, modal, body: bodyEl };
  }
  function closeModal() {
    modalRoot.innerHTML = '';
    document.body.style.overflow = '';
  }

  // ---------- HOME
  function renderHome() {
    const hour = new Date().getHours();
    const greet = hour < 5 ? 'Late night' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    $('#home-greet').textContent = greet;

    $('#stat-week').textContent = DB.workoutsThisWeek();
    const last = DB.getWorkouts()[0];
    $('#stat-last').textContent = last ? fmtDate(last.completedAt) : '—';
    $('#stat-last-sub').textContent = last ? (last.name || 'workout') : 'no history yet';
    $('#stat-volume').textContent = DB.totalVolume().toLocaleString();

    renderPrograms();
    renderRecent();
  }

  // UI state for collapsed program cards — local-only, not synced.
  const UI_KEY = 'lift.ui.v1';
  const uiState = (() => {
    try { return JSON.parse(localStorage.getItem(UI_KEY) || '{}'); }
    catch { return {}; }
  })();
  uiState.collapsedPrograms = uiState.collapsedPrograms || [];
  function saveUI() { localStorage.setItem(UI_KEY, JSON.stringify(uiState)); }
  function isCollapsed(pid) { return uiState.collapsedPrograms.includes(pid); }
  function setCollapsed(pid, collapsed) {
    const arr = uiState.collapsedPrograms;
    const i = arr.indexOf(pid);
    if (collapsed && i === -1) arr.push(pid);
    if (!collapsed && i !== -1) arr.splice(i, 1);
    saveUI();
  }

  const ICONS = {
    chevDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
    arrowUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 14 12 8 18 14"/></svg>',
    arrowDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 10 12 16 18 10"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  };

  function renderPrograms() {
    const list = $('#programs-list');
    list.innerHTML = '';
    const programs = DB.getPrograms();
    if (!programs.length) {
      list.appendChild(el('div', { class: 'empty glass' }, [
        el('span', { class: 'emoji' }, '📋'),
        el('p', {}, 'No programs yet. Create one to get started.'),
      ]));
      return;
    }
    programs.forEach((p, idx) => {
      const collapsed = isCollapsed(p.id);
      const card = el('div', { class: 'program-card glass' + (collapsed ? ' is-collapsed' : '') });

      const upBtn = el('button', {
        class: 'mini-btn',
        'aria-label': 'Move up',
        title: 'Move up',
        html: ICONS.arrowUp,
        onclick: (e) => { e.stopPropagation(); DB.moveProgram(p.id, -1); renderPrograms(); },
      });
      if (idx === 0) upBtn.disabled = true;

      const downBtn = el('button', {
        class: 'mini-btn',
        'aria-label': 'Move down',
        title: 'Move down',
        html: ICONS.arrowDown,
        onclick: (e) => { e.stopPropagation(); DB.moveProgram(p.id, 1); renderPrograms(); },
      });
      if (idx === programs.length - 1) downBtn.disabled = true;

      const editBtn = el('button', {
        class: 'text-btn',
        onclick: (e) => { e.stopPropagation(); openProgramEditor(p); },
      }, 'Edit');

      const chevBtn = el('button', {
        class: 'mini-btn chevron',
        'aria-label': collapsed ? 'Expand' : 'Collapse',
        title: collapsed ? 'Expand' : 'Collapse',
        html: ICONS.chevDown,
        onclick: (e) => { e.stopPropagation(); setCollapsed(p.id, !collapsed); renderPrograms(); },
      });

      const head = el('div', { class: 'program-head' }, [
        el('div', { class: 'program-head-info' }, [
          el('div', { class: 'program-name' }, p.name),
          el('div', { class: 'program-meta' }, `${p.routines.length} routine${p.routines.length !== 1 ? 's' : ''}`),
        ]),
        el('div', { class: 'program-head-actions' }, [upBtn, downBtn, editBtn, chevBtn]),
      ]);
      // Tap anywhere on the header (except action buttons, which stopPropagation) to toggle.
      head.addEventListener('click', () => {
        setCollapsed(p.id, !collapsed);
        renderPrograms();
      });

      card.appendChild(head);

      const body = el('div', { class: 'program-body' });
      if (p.notes) body.appendChild(el('p', { class: 'program-notes' }, p.notes));

      const routinesWrap = el('div', { class: 'routines-mini' });
      p.routines.forEach((r) => {
        const row = el('div', { class: 'routine-mini' }, [
          el('div', {}, [
            el('div', { class: 'name' }, r.name),
            el('div', { class: 'ex-count' }, `${r.exercises.length} exercise${r.exercises.length !== 1 ? 's' : ''}`),
          ]),
          el('div', { class: 'routine-row-controls' }, [
            el('button', {
              class: 'text-btn',
              onclick: (e) => { e.stopPropagation(); openRoutineEditor(p, r); },
            }, 'Edit'),
            el('button', {
              class: 'play',
              'aria-label': 'Start routine',
              onclick: (e) => { e.stopPropagation(); startWorkout({ programId: p.id, routineId: r.id }); },
              html: ICONS.play,
            }),
          ]),
        ]);
        routinesWrap.appendChild(row);
      });
      const addBtn = el('button', {
        class: 'add-routine-btn',
        onclick: () => openRoutineEditor(p),
      }, '+ Add routine');
      routinesWrap.appendChild(addBtn);
      body.appendChild(routinesWrap);
      card.appendChild(body);
      list.appendChild(card);
    });
  }

  function renderRecent() {
    const list = $('#recent-list');
    list.innerHTML = '';
    const recent = DB.getWorkouts().slice(0, 3);
    if (!recent.length) {
      list.appendChild(el('div', { class: 'empty glass' }, [
        el('span', { class: 'emoji' }, '🌱'),
        el('p', {}, 'Your past workouts will appear here.'),
      ]));
      return;
    }
    recent.forEach((w) => list.appendChild(historyCard(w)));
  }

  // ---------- Program / Routine editors
  function openProgramEditor(program = null) {
    const isNew = !program;
    const nameInput = el('input', { type: 'text', value: program?.name || '', placeholder: 'Program name' });
    const notesInput = el('textarea', { rows: '3', placeholder: 'Notes (optional)' });
    notesInput.value = program?.notes || '';

    const body = el('div', {}, [
      el('label', { class: 'field' }, [el('span', {}, 'Program name'), nameInput]),
      el('div', { style: 'height: 12px' }),
      el('label', { class: 'field' }, [el('span', {}, 'Notes'), notesInput]),
    ]);

    const saveBtn = el('button', { class: 'btn btn-primary btn-block' }, isNew ? 'Create program' : 'Save changes');
    saveBtn.onclick = () => {
      const name = nameInput.value.trim();
      if (!name) { toast('Name is required'); return; }
      if (isNew) DB.addProgram({ name, notes: notesInput.value.trim() });
      else DB.updateProgram(program.id, { name, notes: notesInput.value.trim() });
      closeModal();
      renderPrograms();
      toast(isNew ? 'Program created' : 'Program updated');
    };

    const footerBtns = [saveBtn];
    if (!isNew) {
      const del = el('button', { class: 'btn btn-danger' }, 'Delete');
      del.onclick = () => {
        if (!confirm('Delete this program and all its routines?')) return;
        DB.deleteProgram(program.id);
        closeModal();
        renderPrograms();
        toast('Program deleted');
      };
      footerBtns.unshift(del);
    }

    openModal({ title: isNew ? 'New Program' : 'Edit Program', body, footer: footerBtns });
    setTimeout(() => nameInput.focus(), 100);
  }

  function openRoutineEditor(program, routine = null, draft = null) {
    const isNew = !routine;
    const initName = draft?.name ?? routine?.name ?? '';
    const initNotes = draft?.notes ?? routine?.notes ?? '';
    const initExercises = draft?.exercises ?? routine?.exercises ?? [];

    const nameInput = el('input', { type: 'text', value: initName, placeholder: 'e.g. Push Day' });
    const notesInput = el('textarea', { rows: '2', placeholder: 'Notes (optional)' });
    notesInput.value = initNotes;

    let selectedIds = [...initExercises];

    const selectedWrap = el('div', { class: 'picker-list', style: 'margin-bottom: 12px;' });
    const renderSelected = () => {
      selectedWrap.innerHTML = '';
      if (!selectedIds.length) {
        selectedWrap.appendChild(el('p', { class: 'row-sub', style: 'padding: 6px 0;' }, 'No exercises added yet.'));
        return;
      }
      selectedIds.forEach((id, idx) => {
        const ex = DB.getExercise(id);
        if (!ex) return;
        const thumb = el('div', { class: 'picker-emoji' });
        thumb.appendChild(bodyThumb(ex));
        selectedWrap.appendChild(el('div', { class: 'picker-item' }, [
          thumb,
          el('div', { style: 'flex:1' }, [
            el('div', { class: 'name' }, ex.name),
            el('div', { class: 'muscle' }, ex.muscleGroup),
          ]),
          el('button', {
            class: 'text-btn',
            onclick: () => { selectedIds.splice(idx, 1); renderSelected(); },
          }, 'Remove'),
        ]));
      });
    };
    renderSelected();

    const addExBtn = el('button', { class: 'add-exercise-btn' }, '+ Add exercises');
    addExBtn.onclick = () => {
      // Capture in-progress edits so we can restore them after the picker closes.
      const snapshot = {
        name: nameInput.value,
        notes: notesInput.value,
        exercises: selectedIds,
      };
      openExercisePicker({
        initial: selectedIds,
        onConfirm: (ids) => {
          snapshot.exercises = ids;
          // Reopen the same editor (new vs. edit preserved via the original `routine` arg)
          openRoutineEditor(program, routine, snapshot);
        },
      });
    };

    const body = el('div', {}, [
      el('label', { class: 'field' }, [el('span', {}, 'Routine name'), nameInput]),
      el('div', { style: 'height: 12px' }),
      el('label', { class: 'field' }, [el('span', {}, 'Notes'), notesInput]),
      el('div', { style: 'height: 18px' }),
      el('div', { class: 'ex-section-title' }, 'Exercises'),
      selectedWrap,
      addExBtn,
    ]);

    const saveBtn = el('button', { class: 'btn btn-primary btn-block' }, isNew ? 'Create routine' : 'Save changes');
    saveBtn.onclick = () => {
      const name = nameInput.value.trim();
      if (!name) { toast('Name is required'); return; }
      if (isNew) DB.addRoutine(program.id, { name, notes: notesInput.value.trim(), exercises: selectedIds });
      else DB.updateRoutine(program.id, routine.id, { name, notes: notesInput.value.trim(), exercises: selectedIds });
      closeModal();
      renderPrograms();
      toast(isNew ? 'Routine created' : 'Routine updated');
    };

    const footerBtns = [saveBtn];
    if (!isNew) {
      const del = el('button', { class: 'btn btn-danger' }, 'Delete');
      del.onclick = () => {
        if (!confirm('Delete this routine?')) return;
        DB.deleteRoutine(program.id, routine.id);
        closeModal();
        renderPrograms();
        toast('Routine deleted');
      };
      footerBtns.unshift(del);
    }

    openModal({ title: isNew ? 'New Routine' : 'Edit Routine', body, footer: footerBtns });
  }

  // ---------- Exercise picker
  function openExercisePicker({ initial = [], onConfirm }) {
    let selected = new Set(initial);
    let activeMuscle = 'All';

    const search = el('input', { type: 'text', placeholder: 'Search exercises' });
    const searchIcon = el('span');
    searchIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';
    const searchBar = el('div', { class: 'search-bar glass', style: 'margin-bottom: 12px;' }, [
      searchIcon.firstChild,
      search,
    ]);

    const filtersWrap = el('div', { class: 'chips chips-scroll', style: 'margin-bottom: 14px;' });
    const renderFilters = () => {
      filtersWrap.innerHTML = '';
      MUSCLE_GROUPS.forEach((m) => {
        const chip = el('button', {
          class: 'chip' + (m === activeMuscle ? ' active' : ''),
          onclick: () => {
            activeMuscle = m;
            renderFilters();
            renderList();
          },
        }, m);
        filtersWrap.appendChild(chip);
      });
    };
    renderFilters();

    const list = el('div', { class: 'picker-list' });
    const renderList = () => {
      list.innerHTML = '';
      const q = search.value.toLowerCase().trim();
      const filtered = DB.getExercises().filter((e) => {
        const matchMuscle = activeMuscle === 'All' || e.muscleGroup === activeMuscle;
        const matchQ = !q ||
          e.name.toLowerCase().includes(q) ||
          e.muscleGroup.toLowerCase().includes(q) ||
          (e.keywords || []).some((k) => k.includes(q));
        return matchMuscle && matchQ;
      });
      if (!filtered.length) {
        list.appendChild(el('p', { class: 'row-sub', style: 'text-align:center; padding:20px;' }, 'No exercises found.'));
        return;
      }
      filtered.forEach((ex) => {
        const thumb = el('div', { class: 'picker-emoji' });
        thumb.appendChild(bodyThumb(ex));
        const item = el('div', {
          class: 'picker-item' + (selected.has(ex.id) ? ' selected' : ''),
          onclick: () => {
            if (selected.has(ex.id)) selected.delete(ex.id);
            else selected.add(ex.id);
            renderList();
          },
        }, [
          thumb,
          el('div', { style: 'flex:1; min-width:0' }, [
            el('div', { class: 'name' }, ex.name),
            el('div', { class: 'muscle' }, `${ex.muscleGroup} · ${ex.equipment}`),
          ]),
          el('div', { class: 'check' }),
        ]);
        list.appendChild(item);
      });
    };
    search.addEventListener('input', renderList);
    renderList();

    const body = el('div', {}, [searchBar, filtersWrap, list]);
    const confirm = el('button', { class: 'btn btn-primary btn-block' }, 'Add selected');
    confirm.onclick = () => {
      const ids = [...selected];
      closeModal();
      onConfirm(ids);
    };
    openModal({ title: 'Pick Exercises', body, footer: [confirm], fullHeight: true });
  }

  // ---------- Workout session
  let activeWorkout = null;

  function startWorkout({ programId = null, routineId = null } = {}) {
    let name = 'Empty Workout';
    let exercises = [];
    if (routineId) {
      const program = DB.getProgram(programId);
      const routine = DB.getRoutine(programId, routineId);
      if (routine) {
        name = routine.name;
        exercises = routine.exercises.map((exId) => {
          const ex = DB.getExercise(exId);
          return {
            exerciseId: exId,
            exerciseName: ex ? ex.name : 'Unknown',
            sets: [{ reps: '', weight: '', notes: '', done: false }],
          };
        });
      }
    }
    activeWorkout = {
      id: DB.uid('wk'),
      name,
      programId, routineId,
      startedAt: Date.now(),
      exercises,
    };
    openWorkoutModal();
  }

  function openWorkoutModal() {
    const body = el('div');
    const summary = el('div', { class: 'workout-summary' });
    const exWrap = el('div');
    const addBtn = el('button', { class: 'add-exercise-btn' }, '+ Add exercise');

    addBtn.onclick = () => {
      openExercisePicker({
        initial: [],
        onConfirm: (ids) => {
          ids.forEach((id) => {
            const ex = DB.getExercise(id);
            if (!ex) return;
            activeWorkout.exercises.push({
              exerciseId: id, exerciseName: ex.name,
              sets: [{ reps: '', weight: '', notes: '', done: false }],
            });
          });
          openWorkoutModal();
        },
      });
    };

    const updateSummary = () => {
      const sets = activeWorkout.exercises.reduce((acc, ex) => acc + ex.sets.filter((s) => s.done).length, 0);
      const vol = activeWorkout.exercises.reduce((acc, ex) =>
        acc + ex.sets.reduce((a, s) => a + (s.done ? (Number(s.weight) || 0) * (Number(s.reps) || 0) : 0), 0)
      , 0);
      const elapsedMs = Date.now() - activeWorkout.startedAt;
      const mins = Math.floor(elapsedMs / 60000);
      summary.innerHTML = '';
      summary.appendChild(el('div', { class: 'summary-pill' }, [
        el('div', { class: 'v' }, String(mins) + 'm'),
        el('div', { class: 'l' }, 'Time'),
      ]));
      summary.appendChild(el('div', { class: 'summary-pill' }, [
        el('div', { class: 'v' }, String(sets)),
        el('div', { class: 'l' }, 'Sets'),
      ]));
      summary.appendChild(el('div', { class: 'summary-pill' }, [
        el('div', { class: 'v' }, vol.toLocaleString()),
        el('div', { class: 'l' }, 'Volume'),
      ]));
    };
    updateSummary();
    const summaryTimer = setInterval(updateSummary, 30000);

    activeWorkout.exercises.forEach((ex, exIdx) => {
      const exCard = el('div', { class: 'workout-ex' });
      const head = el('div', { class: 'workout-ex-head' }, [
        el('div', { class: 'workout-ex-name' }, ex.exerciseName),
        el('button', {
          class: 'workout-ex-rm',
          onclick: () => {
            activeWorkout.exercises.splice(exIdx, 1);
            openWorkoutModal();
          },
        }, 'Remove'),
      ]);
      exCard.appendChild(head);

      const table = el('div', { class: 'sets-table' });
      table.appendChild(el('div', { class: 'h left' }, 'Set'));
      table.appendChild(el('div', { class: 'h' }, 'Reps'));
      table.appendChild(el('div', { class: 'h' }, `Weight (${DB.getSettings().unit})`));
      table.appendChild(el('div', { class: 'h' }, ''));

      ex.sets.forEach((s, sIdx) => {
        const num = el('button', { class: 'set-num' + (s.done ? ' done' : ''), onclick: () => {
          s.done = !s.done;
          openWorkoutModal();
        } }, String(sIdx + 1));
        const repsInput = el('input', { type: 'number', inputmode: 'numeric', placeholder: '0', value: s.reps });
        repsInput.addEventListener('input', (e) => { s.reps = e.target.value; });
        const weightInput = el('input', { type: 'number', inputmode: 'decimal', placeholder: '0', value: s.weight });
        weightInput.addEventListener('input', (e) => { s.weight = e.target.value; });
        const del = el('button', {
          class: 'set-del',
          onclick: () => {
            ex.sets.splice(sIdx, 1);
            openWorkoutModal();
          },
          html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
        });
        table.appendChild(num);
        table.appendChild(repsInput);
        table.appendChild(weightInput);
        table.appendChild(del);
      });
      exCard.appendChild(table);

      const addSet = el('button', { class: 'add-set-btn', onclick: () => {
        const last = ex.sets[ex.sets.length - 1];
        ex.sets.push({
          reps: last ? last.reps : '',
          weight: last ? last.weight : '',
          done: false,
        });
        openWorkoutModal();
      } }, '+ Add set');
      exCard.appendChild(addSet);
      exWrap.appendChild(exCard);
    });

    body.appendChild(summary);
    if (!activeWorkout.exercises.length) {
      body.appendChild(el('div', { class: 'empty', style: 'margin-bottom: 12px;' }, [
        el('span', { class: 'emoji' }, '💪'),
        el('p', {}, 'Add an exercise to get started.'),
      ]));
    }
    body.appendChild(exWrap);
    body.appendChild(addBtn);

    const finishBtn = el('button', { class: 'btn btn-primary btn-block' }, 'Finish workout');
    finishBtn.onclick = () => {
      clearInterval(summaryTimer);
      const hasAnything = activeWorkout.exercises.some((ex) => ex.sets.some((s) => s.done));
      if (!hasAnything) {
        if (!confirm('No sets marked done. Save anyway?')) return;
      }
      // Trim un-done sets if user only logged some, but keep at least one for context
      DB.saveWorkout({ ...activeWorkout, completedAt: Date.now() });
      activeWorkout = null;
      closeModal();
      toast('Workout saved 🎉');
      navigate('history');
    };
    const cancelBtn = el('button', { class: 'btn btn-ghost' }, 'Discard');
    cancelBtn.onclick = () => {
      if (!confirm('Discard this workout?')) return;
      clearInterval(summaryTimer);
      activeWorkout = null;
      closeModal();
    };

    openModal({ title: activeWorkout.name, body, footer: [cancelBtn, finishBtn], fullHeight: true });
  }

  // ---------- History
  let historyFilter = { range: 'all', query: '' };
  function renderHistory() {
    const list = $('#history-list');
    list.innerHTML = '';
    const range = historyFilter.range;
    let workouts = range === 'all' ? DB.getWorkouts() : DB.workoutsInRange(Number(range));
    const q = historyFilter.query.toLowerCase().trim();
    if (q) {
      workouts = workouts.filter((w) =>
        (w.name || '').toLowerCase().includes(q) ||
        (w.exercises || []).some((ex) => (ex.exerciseName || '').toLowerCase().includes(q))
      );
    }
    if (!workouts.length) {
      list.appendChild(el('div', { class: 'empty glass' }, [
        el('span', { class: 'emoji' }, '🗓️'),
        el('p', {}, 'No workouts in this range yet. Start one from Home.'),
      ]));
      return;
    }
    workouts.forEach((w) => list.appendChild(historyCard(w)));
  }

  function historyCard(w) {
    const totalSets = w.exercises.reduce((a, ex) => a + (ex.sets || []).filter((s) => s.done !== false).length, 0);
    const volume = w.exercises.reduce((a, ex) =>
      a + (ex.sets || []).reduce((aa, s) => aa + ((s.done !== false ? (Number(s.weight) || 0) * (Number(s.reps) || 0) : 0)), 0), 0);
    const program = w.programId ? DB.getProgram(w.programId) : null;
    const subParts = [];
    if (program) subParts.push(program.name);
    if (w.exercises.length) subParts.push(`${w.exercises.length} exercise${w.exercises.length !== 1 ? 's' : ''}`);
    const durMs = (w.startedAt && w.completedAt) ? (w.completedAt - w.startedAt) : null;

    const metrics = [
      el('div', {}, [el('b', {}, String(totalSets)), ' sets']),
      el('div', {}, [el('b', {}, volume.toLocaleString()), ` ${DB.getSettings().unit}`]),
    ];
    if (durMs != null) {
      metrics.push(el('div', {}, [el('b', {}, fmtDuration(durMs))]));
    }

    return el('div', {
      class: 'history-card glass',
      onclick: () => openWorkoutDetail(w),
    }, [
      el('div', { class: 'history-top' }, [
        el('div', { class: 'history-name' }, w.name || 'Workout'),
        el('div', { class: 'history-date' }, fmtDate(w.completedAt)),
      ]),
      el('div', { class: 'history-sub' }, subParts.join(' · ') || ' '),
      el('div', { class: 'history-metrics' }, metrics),
    ]);
  }

  function openWorkoutDetail(w) {
    const body = el('div');
    body.appendChild(el('p', { class: 'row-sub', style: 'margin-bottom: 14px;' }, fmtDateLong(w.completedAt)));
    if (!w.exercises.length) {
      body.appendChild(el('p', { class: 'row-sub' }, 'No exercises logged.'));
    }
    w.exercises.forEach((ex) => {
      const card = el('div', { class: 'detail-ex' });
      card.appendChild(el('div', { class: 'detail-ex-name' }, ex.exerciseName));
      (ex.sets || []).forEach((s, i) => {
        card.appendChild(el('div', { class: 'detail-set' }, [
          el('span', { class: 'n' }, `Set ${i + 1}`),
          el('span', { class: 'v' }, `${s.reps || 0} × ${s.weight || 0} ${DB.getSettings().unit}`),
        ]));
      });
      body.appendChild(card);
    });
    const del = el('button', { class: 'btn btn-danger' }, 'Delete');
    del.onclick = () => {
      if (!confirm('Delete this workout?')) return;
      DB.deleteWorkout(w.id);
      closeModal();
      renderHistory();
      toast('Workout deleted');
    };
    const close = el('button', { class: 'btn btn-primary btn-block' }, 'Done');
    close.onclick = closeModal;
    openModal({ title: w.name || 'Workout', body, footer: [del, close] });
  }

  // ---------- Exercises page
  let exerciseFilter = { muscle: 'All', query: '' };
  function renderExercises() {
    const muscleWrap = $('#muscle-filters');
    if (!muscleWrap.children.length) {
      MUSCLE_GROUPS.forEach((m) => {
        const b = el('button', { class: 'chip' + (m === 'All' ? ' active' : ''), onclick: () => {
          exerciseFilter.muscle = m;
          $$('#muscle-filters .chip').forEach((c) => c.classList.toggle('active', c.textContent === m));
          renderExerciseGrid();
        } }, m);
        muscleWrap.appendChild(b);
      });
    }
    renderExerciseGrid();
  }
  function renderExerciseGrid() {
    const grid = $('#exercises-grid');
    grid.innerHTML = '';
    const q = exerciseFilter.query.toLowerCase().trim();
    const filtered = DB.getExercises().filter((ex) => {
      const matchMuscle = exerciseFilter.muscle === 'All' || ex.muscleGroup === exerciseFilter.muscle;
      const matchQ = !q || ex.name.toLowerCase().includes(q) || ex.muscleGroup.toLowerCase().includes(q) || (ex.keywords || []).some((k) => k.includes(q));
      return matchMuscle && matchQ;
    });
    if (!filtered.length) {
      grid.appendChild(el('div', { class: 'empty glass', style: 'grid-column: span 2' }, [
        el('span', { class: 'emoji' }, '🔍'),
        el('p', {}, 'No exercises match your search.'),
      ]));
      return;
    }
    filtered.forEach((ex) => {
      const thumb = el('div', { class: 'ex-thumb' });
      thumb.appendChild(bodyThumb(ex));
      thumb.appendChild(equipBadge(ex.equipment));
      grid.appendChild(el('div', { class: 'ex-card glass', onclick: () => openExerciseModal(ex) }, [
        thumb,
        el('div', { class: 'ex-info' }, [
          el('div', { class: 'ex-muscle' }, ex.muscleGroup),
          el('div', { class: 'ex-name' }, ex.name),
        ]),
      ]));
    });
  }

  function openExerciseModal(ex) {
    let activeTab = 'about';
    const body = el('div');

    const tabs = el('div', { class: 'tabs' }, [
      el('button', { class: 'tab active', onclick: () => switchTab('about') }, 'About'),
      el('button', { class: 'tab', onclick: () => switchTab('history') }, 'History'),
    ]);
    body.appendChild(tabs);
    const content = el('div');
    body.appendChild(content);

    function renderAbout() {
      content.innerHTML = '';
      const imgs = el('div', { class: 'ex-modal-imgs' });

      // Two views — front + back — of the muscle map.
      const frontCard = el('div', { class: 'ex-modal-img' });
      if (ex.startImage) frontCard.appendChild(el('img', { src: ex.startImage, alt: 'Front' }));
      else frontCard.appendChild(bodyThumb({ ...ex, view: 'front' }));
      frontCard.appendChild(el('span', { class: 'ph-label' }, 'Front'));

      const backCard = el('div', { class: 'ex-modal-img' });
      if (ex.endImage) backCard.appendChild(el('img', { src: ex.endImage, alt: 'Back' }));
      else backCard.appendChild(bodyThumb({ ...ex, view: 'back' }));
      backCard.appendChild(el('span', { class: 'ph-label' }, 'Back'));

      imgs.appendChild(frontCard);
      imgs.appendChild(backCard);
      content.appendChild(imgs);

      content.appendChild(el('div', { class: 'ex-meta-grid' }, [
        el('div', { class: 'ex-meta' }, [
          el('div', { class: 'label' }, 'Muscle'),
          el('div', { class: 'value' }, ex.muscleGroup || '—'),
        ]),
        el('div', { class: 'ex-meta' }, [
          el('div', { class: 'label' }, 'Equipment'),
          el('div', { class: 'value' }, ex.equipment || '—'),
        ]),
      ]));

      if (ex.description) {
        content.appendChild(el('div', { class: 'ex-section-title' }, 'Description'));
        content.appendChild(el('p', { class: 'ex-description' }, ex.description));
      }
      if (ex.instructions) {
        content.appendChild(el('div', { class: 'ex-section-title' }, 'How to perform'));
        content.appendChild(el('p', { class: 'ex-instructions' }, ex.instructions));
      }
    }

    function renderHistoryTab() {
      content.innerHTML = '';
      const entries = DB.getExerciseHistory(ex.id);
      if (!entries.length) {
        content.appendChild(el('div', { class: 'history-empty-modal' }, [
          el('div', { style: 'font-size:40px; margin-bottom:8px;' }, '📈'),
          el('p', {}, 'No history yet. Log a workout with this exercise to see it here.'),
        ]));
        return;
      }
      const allWeights = entries.flatMap((e) => e.sets.map((s) => Number(s.weight) || 0));
      const bestWeight = Math.max(...allWeights, 0);
      const last = entries[0];

      const summary = el('div', { class: 'workout-summary' }, [
        el('div', { class: 'summary-pill' }, [
          el('div', { class: 'v' }, String(entries.length)),
          el('div', { class: 'l' }, 'Sessions'),
        ]),
        el('div', { class: 'summary-pill' }, [
          el('div', { class: 'v' }, bestWeight + ` ${DB.getSettings().unit}`),
          el('div', { class: 'l' }, 'Best'),
        ]),
        el('div', { class: 'summary-pill' }, [
          el('div', { class: 'v' }, fmtDate(last.date)),
          el('div', { class: 'l' }, 'Last'),
        ]),
      ]);
      content.appendChild(summary);

      entries.forEach((entry) => {
        const isBest = entry.sets.some((s) => Number(s.weight) === bestWeight && bestWeight > 0);
        const setsRow = el('div', { class: 'history-entry-sets' });
        entry.sets.forEach((s, i) => {
          setsRow.appendChild(el('div', { class: 'set-pill' }, `${s.reps || 0} × ${s.weight || 0}${DB.getSettings().unit}`));
        });
        content.appendChild(el('div', { class: 'history-entry' }, [
          el('div', { class: 'history-entry-head' }, [
            el('div', { class: 'history-entry-date' }, fmtDateOnly(entry.date)),
            isBest ? el('div', { class: 'history-entry-pr' }, 'PR') : null,
          ]),
          setsRow,
        ]));
      });
    }

    function switchTab(tab) {
      activeTab = tab;
      $$('.tab', tabs).forEach((t) => t.classList.toggle('active', t.textContent.toLowerCase() === tab));
      if (tab === 'about') renderAbout();
      else renderHistoryTab();
    }

    renderAbout();
    openModal({ title: ex.name, body });
  }

  // ---------- New exercise (custom)
  function openNewExercise() {
    const nameInput = el('input', { type: 'text', placeholder: 'Exercise name' });
    const muscleSel = el('select', { style: 'padding: 12px 14px; background: var(--glass); border: 1px solid var(--glass-border); border-radius: 14px; font-size:15px;' });
    ['Chest','Back','Legs','Shoulders','Arms','Core','Other'].forEach((m) => {
      muscleSel.appendChild(el('option', { value: m }, m));
    });
    const equipInput = el('input', { type: 'text', placeholder: 'e.g. Dumbbell' });
    const descInput = el('textarea', { rows: '3', placeholder: 'Short description' });
    const instInput = el('textarea', { rows: '4', placeholder: 'Step-by-step instructions' });

    const body = el('div', {}, [
      el('label', { class: 'field' }, [el('span', {}, 'Name'), nameInput]),
      el('div', { style: 'height: 12px' }),
      el('label', { class: 'field' }, [el('span', {}, 'Muscle group'), muscleSel]),
      el('div', { style: 'height: 12px' }),
      el('label', { class: 'field' }, [el('span', {}, 'Equipment'), equipInput]),
      el('div', { style: 'height: 12px' }),
      el('label', { class: 'field' }, [el('span', {}, 'Description'), descInput]),
      el('div', { style: 'height: 12px' }),
      el('label', { class: 'field' }, [el('span', {}, 'Instructions'), instInput]),
    ]);
    const saveBtn = el('button', { class: 'btn btn-primary btn-block' }, 'Create exercise');
    saveBtn.onclick = () => {
      const name = nameInput.value.trim();
      if (!name) { toast('Name is required'); return; }
      // Pick a sensible default region highlight based on chosen muscle.
      const muscleToPrimary = {
        Chest: ['chest'], Back: ['back', 'lats'], Shoulders: ['shoulders'],
        Arms: ['biceps', 'triceps'], Legs: ['quads', 'glutes'],
        Core: ['abs', 'obliques'], Cardio: ['quads', 'calves'], Other: [],
      };
      const view = muscleSel.value === 'Back' ? 'back' : 'front';
      DB.addExercise({
        name,
        muscleGroup: muscleSel.value,
        equipment: equipInput.value.trim() || 'Other',
        description: descInput.value.trim(),
        instructions: instInput.value.trim(),
        keywords: [name.toLowerCase()],
        view,
        primary: muscleToPrimary[muscleSel.value] || [],
      });
      closeModal();
      renderExerciseGrid();
      toast('Exercise added');
    };
    openModal({ title: 'New Exercise', body, footer: [saveBtn] });
    setTimeout(() => nameInput.focus(), 100);
  }

  // ---------- Settings
  // ---------- Macros: targets (Settings) + today's intake (Macros tab)
  const MACRO_PRESETS = {
    balanced:       { label: 'Balanced',     pct: { protein: 30, carbs: 40, fat: 30 } },
    'high-protein': { label: 'High Protein', pct: { protein: 40, carbs: 30, fat: 30 } },
    'low-carb':     { label: 'Low Carb',     pct: { protein: 35, carbs: 15, fat: 50 } },
    keto:           { label: 'Keto',         pct: { protein: 25, carbs: 5,  fat: 70 } },
    custom:         { label: 'Custom',       pct: null },
  };

  const MACRO_DEFS = [
    { key: 'proteinG', label: 'Protein', kcalPerG: 4, color: 'var(--macro-protein)' },
    { key: 'carbsG',   label: 'Carbs',   kcalPerG: 4, color: 'var(--macro-carbs)' },
    { key: 'fatG',     label: 'Fat',     kcalPerG: 9, color: 'var(--macro-fat)' },
    { key: 'fiberG',   label: 'Fiber',   kcalPerG: 0, color: 'var(--macro-fiber)' },
  ];

  function computeFromPreset(cal, presetKey) {
    const p = MACRO_PRESETS[presetKey];
    if (!p || !p.pct) return null;
    return {
      proteinG: Math.round((cal * p.pct.protein / 100) / 4),
      carbsG:   Math.round((cal * p.pct.carbs   / 100) / 4),
      fatG:     Math.round((cal * p.pct.fat     / 100) / 9),
      fiberG:   Math.round((cal * 14) / 1000),
    };
  }

  function caloriesFromMacros(m) {
    return Math.round((Number(m.proteinG) || 0) * 4 +
                      (Number(m.carbsG)   || 0) * 4 +
                      (Number(m.fatG)     || 0) * 9);
  }

  function fmtDay(d = new Date()) {
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  }

  // ---------- Macros tab — daily intake tracker
  // Visual layout inspired by Cal AI: day-circle picker, big calorie ring,
  // 2x2 macro grid with mini rings. Tap any card to edit that macro for
  // the selected day.
  let macrosSelectedDate = null;

  // SVG progress ring helper.
  function ringSvg({ size, radius, thickness, progress, color, dashed = false }) {
    const c = 2 * Math.PI * radius;
    const off = c - Math.min(1.5, Math.max(0, progress)) * c;
    const wrap = document.createElement('div');
    wrap.className = 'ring-wrap';
    wrap.innerHTML = `<svg viewBox="0 0 ${size} ${size}" class="progress-ring" width="${size}" height="${size}">
      <circle cx="${size/2}" cy="${size/2}" r="${radius}"
              class="ring-bg${dashed ? ' dashed' : ''}"
              style="stroke-width:${thickness}"/>
      <circle cx="${size/2}" cy="${size/2}" r="${radius}"
              class="ring-fill"
              style="stroke-width:${thickness};stroke:${color};stroke-dasharray:${c};stroke-dashoffset:${off}"/>
    </svg>`;
    return wrap.firstElementChild;
  }

  function renderMacros() {
    const wrap = $('#macros-content');
    if (!wrap) return;
    wrap.innerHTML = '';

    const targets = DB.getMacroTargets();
    const todayK = DB.getTodayKey();
    if (!macrosSelectedDate) macrosSelectedDate = todayK;

    // ---- Day picker: 7 day-of-week circles with progress rings ----
    const dayRow = el('div', { class: 'day-picker' });
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = dateKey(d);
      const dayLabel = d.toLocaleDateString(undefined, { weekday: 'short' });
      const dayNum = d.getDate();
      const isSelected = macrosSelectedDate === key;
      const isToday = key === todayK;
      const isFuture = key > todayK;

      // Per-day calorie ratio (consumed/target) drives the ring colour.
      const dayIntake = DB.getIntake(key);
      const dayCal = caloriesFromMacros(dayIntake);
      const ratio = targets.calories > 0 ? dayCal / targets.calories : 0;
      const ringColor = ratio > 1.05 ? 'var(--danger)' : 'var(--accent)';

      const chip = el('button', {
        class: 'day-chip' + (isSelected ? ' active' : '') + (isFuture ? ' future' : ''),
        onclick: () => { macrosSelectedDate = key; renderMacros(); },
        'aria-label': fmtDayFromKey(key),
      });
      chip.appendChild(el('span', { class: 'day-chip-label' }, dayLabel));

      const circle = el('div', { class: 'day-chip-circle' + (isToday ? ' today' : '') });
      circle.appendChild(ringSvg({
        size: 40, radius: 18, thickness: 2.5,
        progress: ratio, color: ringColor,
        dashed: !isToday && !isSelected,
      }));
      circle.appendChild(el('span', { class: 'day-chip-date' }, String(dayNum)));
      chip.appendChild(circle);
      dayRow.appendChild(chip);
    }
    wrap.appendChild(dayRow);

    // ---- Big calorie card ----
    const intake = DB.getIntake(macrosSelectedDate);
    const eatenCal = caloriesFromMacros(intake);
    const calLeft = (targets.calories || 0) - eatenCal;
    const calRatio = targets.calories > 0 ? eatenCal / targets.calories : 0;
    const calOver = calLeft < 0;
    const calColor = calOver ? 'var(--danger)' : 'var(--accent)';

    const calCard = el('div', { class: 'glass card cal-card' });

    const subText = calOver
      ? `${Math.abs(calLeft).toLocaleString()} calories over`
      : `${calLeft.toLocaleString()} calories left`;
    const calLeftCol = el('div', { class: 'cal-left' }, [
      el('p', { class: 'cal-eyebrow' }, 'Calories today'),
      el('div', { class: 'cal-big' }, eatenCal.toLocaleString()),
      el('div', { class: 'cal-sub' + (calOver ? ' over' : '') }, subText),
    ]);
    const calRing = el('div', { class: 'cal-ring-wrap' });
    calRing.appendChild(ringSvg({
      size: 100, radius: 44, thickness: 8,
      progress: calRatio, color: calColor,
    }));
    const calIcon = el('span', { class: 'cal-ring-icon' });
    calIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z"/></svg>';
    calRing.appendChild(calIcon);
    calCard.appendChild(calLeftCol);
    calCard.appendChild(calRing);
    wrap.appendChild(calCard);

    // ---- 2x2 macro grid ----
    const grid = el('div', { class: 'macro-grid' });
    const MACRO_ICONS = {
      proteinG: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 6a4 4 0 0 0-4 4c0 1.86 1.27 3.4 3 3.86V18a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2v-4.14c1.73-.46 3-2 3-3.86a4 4 0 0 0-4-4zm-7 6c-2.21 0-4 1.34-4 3 0 .68.3 1.31.81 1.81L4 18.62V21h3.5l2.81-2.81C10.81 18.7 11.34 19 12 19l-.59-.59c.5-.5.81-1.13.81-1.81 0-1.66-1.79-3-4-3z"/></svg>',
      carbsG:   '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C9.24 2 7 4.24 7 7v3c-2.76 0-5 2.24-5 5s2.24 5 5 5h10c2.76 0 5-2.24 5-5s-2.24-5-5-5V7c0-2.76-2.24-5-5-5zm-1 5a1 1 0 0 1 2 0v3h-2V7zm-4 8a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3 3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3z"/></svg>',
      fatG:     '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a6 6 0 0 0-6 6c0 4.5 6 14 6 14s6-9.5 6-14a6 6 0 0 0-6-6zm0 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg>',
      fiberG:   '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2v10l4 4-4 4-4-4 4-4V2zm-7 7l3 3-3 3 3 3M19 9l-3 3 3 3-3 3"/></svg>',
    };

    MACRO_DEFS.forEach((def) => {
      const target = Math.max(0, Number(targets[def.key]) || 0);
      const eaten = Math.max(0, Number(intake[def.key]) || 0);
      const left = target - eaten;
      const overLeft = left < 0;
      const ratio = target > 0 ? eaten / target : 0;
      const color = overLeft ? 'var(--danger)' : def.color;

      const card = el('div', { class: 'glass card macro-mini-card' });
      card.appendChild(el('div', { class: 'macro-mini-big' }, `${Math.abs(left)}g`));
      card.appendChild(el('div', { class: 'macro-mini-sub' },
        target > 0 ? (overLeft ? `${def.label} over` : `${def.label} left`) : def.label));
      const ringWrap = el('div', { class: 'macro-mini-ring' });
      ringWrap.appendChild(ringSvg({
        size: 60, radius: 26, thickness: 4.5,
        progress: ratio, color,
      }));
      const iconSpan = el('span', { class: 'macro-mini-icon', style: `color:${def.color}` });
      iconSpan.innerHTML = MACRO_ICONS[def.key] || '';
      ringWrap.appendChild(iconSpan);
      card.appendChild(ringWrap);

      card.onclick = () => openMacroEditor(def);
      grid.appendChild(card);
    });
    wrap.appendChild(grid);

    // ---- Add food button (search or camera) ----
    const addBtn = el('button', { class: 'btn btn-primary btn-block add-food-btn', style: 'margin-top: 16px;' });
    addBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M12 5v14M5 12h14"/></svg> Add food';
    addBtn.onclick = () => openAddFoodModal();
    wrap.appendChild(addBtn);

    // ---- Food log ----
    if ((intake.entries || []).length) {
      const logCard = el('div', { class: 'glass card', style: 'margin-top: 14px;' });
      logCard.appendChild(el('h3', { class: 'card-title' }, 'Logged food'));
      const list = el('div', { class: 'food-log-list' });
      [...intake.entries].reverse().forEach((entry) => {
        const row = el('div', { class: 'food-log-row' });
        const left = el('div', { class: 'food-log-info' }, [
          el('div', { class: 'food-log-name' }, entry.name + (entry.brand ? ` · ${entry.brand}` : '')),
          el('div', { class: 'food-log-meta' },
            `${entry.grams}g · ${entry.calories} kcal · P${entry.proteinG} C${entry.carbsG} F${entry.fatG}`),
        ]);
        const removeBtn = el('button', {
          class: 'mini-btn',
          'aria-label': 'Remove entry',
          onclick: (e) => {
            e.stopPropagation();
            DB.removeIntakeEntry(macrosSelectedDate, entry.id);
            renderMacros();
          },
          html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
        });
        row.appendChild(left);
        row.appendChild(removeBtn);
        list.appendChild(row);
      });
      logCard.appendChild(list);
      wrap.appendChild(logCard);
    }

    // ---- Reset button ----
    const isTodaySelected = macrosSelectedDate === todayK;
    const resetBtn = el('button', {
      class: 'btn btn-ghost btn-block',
      style: 'margin-top: 16px;',
    }, isTodaySelected ? 'Reset today' : 'Reset this day');
    resetBtn.onclick = () => {
      if (!confirm('Clear intake for ' + (isTodaySelected ? 'today' : 'this day') + '?')) return;
      DB.resetIntake(macrosSelectedDate);
      renderMacros();
      toast('Day cleared');
    };
    wrap.appendChild(resetBtn);
  }

  // ---------- Add Food: search + camera flows
  function openAddFoodModal() {
    const search = el('input', {
      type: 'text', placeholder: 'Search foods…',
      autocomplete: 'off',
    });
    const searchIcon = el('span');
    searchIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';
    const bar = el('div', { class: 'search-bar glass', style: 'margin-bottom: 12px;' }, [
      searchIcon.firstChild,
      search,
    ]);

    // Camera + upload buttons
    const camBtn = el('button', { class: 'btn btn-secondary food-photo-btn' });
    camBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Take photo';

    const upBtn = el('button', { class: 'btn btn-secondary food-photo-btn' });
    upBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg> Upload image';

    const camInput = el('input', { type: 'file', accept: 'image/*', capture: 'environment', style: 'display:none' });
    const upInput  = el('input', { type: 'file', accept: 'image/*', style: 'display:none' });
    camBtn.onclick = () => camInput.click();
    upBtn.onclick = () => upInput.click();
    camInput.onchange = (e) => handlePhoto(e.target.files?.[0]);
    upInput.onchange = (e) => handlePhoto(e.target.files?.[0]);

    const photoRow = el('div', { class: 'food-photo-row' }, [camBtn, upBtn, camInput, upInput]);

    const status = el('p', { class: 'row-sub', style: 'text-align:center; padding: 12px; min-height: 38px;' }, '');
    const list = el('div', { class: 'food-search-list' });

    const body = el('div', {}, [bar, photoRow, status, list]);
    openModal({ title: 'Add food', body, fullHeight: true });
    setTimeout(() => search.focus(), 80);

    let searchTimer = null;
    search.addEventListener('input', () => {
      clearTimeout(searchTimer);
      const q = search.value.trim();
      if (!q) { list.innerHTML = ''; status.textContent = ''; return; }
      status.textContent = 'Searching…';
      searchTimer = setTimeout(() => runSearch(q), 350);
    });

    async function runSearch(q) {
      try {
        const res = await fetch(`/api/food-search?q=${encodeURIComponent(q)}`);
        let body = null;
        try { body = await res.json(); } catch {}
        if (!res.ok) {
          let detail = body?.error || `HTTP ${res.status}`;
          if (res.status === 404) detail = 'Search proxy not deployed yet — run `vercel dev` locally or deploy.';
          else if (res.status === 503) detail = 'Food database is busy right now. Try again in a few seconds.';
          status.textContent = detail.slice(0, 240);
          return;
        }
        const src = body?.source;
        const note = body?.note || '';
        let banner = '';
        if (src === 'usda')          banner = 'Results from USDA FoodData Central';
        else if (src === 'openfoodfacts') banner = note || 'Results from Open Food Facts';
        status.textContent = banner;
        status.classList.toggle('food-source-warn', src === 'openfoodfacts');
        renderResults(body?.results || []);
      } catch (e) {
        status.textContent = e?.message || 'Search failed';
      }
    }

    function renderResults(results) {
      list.innerHTML = '';
      status.textContent = results.length ? '' : 'No matches';
      results.forEach((r) => {
        const item = el('div', { class: 'food-search-item', onclick: () => openPortionModal(r) });
        if (r.image) {
          item.appendChild(el('img', { src: r.image, class: 'food-search-img', loading: 'lazy', alt: '' }));
        } else {
          item.appendChild(el('div', { class: 'food-search-img placeholder' }));
        }
        item.appendChild(el('div', { class: 'food-search-info' }, [
          el('div', { class: 'food-search-name' }, r.name),
          el('div', { class: 'food-search-meta' },
            `${r.brand ? r.brand + ' · ' : ''}${r.calories} kcal / 100g · P${r.proteinG} C${r.carbsG} F${r.fatG}`),
        ]));
        list.appendChild(item);
      });
    }

    async function handlePhoto(file) {
      if (!file) return;
      status.textContent = 'Analysing image…';
      list.innerHTML = '';
      try {
        const dataUrl = await readAsDataURL(file);
        const res = await fetch('/api/food-recognize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: dataUrl,
            mimeType: file.type || 'image/jpeg',
          }),
        });
        if (!res.ok) {
          let detail = '';
          try { const j = await res.json(); detail = j.error || JSON.stringify(j); }
          catch { detail = `HTTP ${res.status}`; }
          if (res.status === 404) detail = 'Recognize proxy not deployed.';
          status.textContent = detail.slice(0, 250);
          return;
        }
        const { result } = await res.json();
        if (!result) { status.textContent = 'No result'; return; }
        // AI returns per-serving macros — normalise to per-100g so the
        // portion modal can scale uniformly with whatever unit the user picks.
        const s = Number(result.servingGrams) || 100;
        const num = (...keys) => {
          for (const k of keys) {
            const v = Number(result[k]);
            if (Number.isFinite(v)) return v;
          }
          return 0;
        };
        openPortionModal({
          id: 'ai-' + Date.now(),
          name: result.name,
          brand: '',
          image: '',
          calories: (num('calories') * 100) / s,
          proteinG: (num('proteinG', 'protein') * 100) / s,
          carbsG:   (num('carbsG',   'carbs')   * 100) / s,
          fatG:     (num('fatG',     'fat')     * 100) / s,
          fiberG:   (num('fiberG',   'fiber')   * 100) / s,
          servingSizeG: Number(result.servingGrams) || null,
          containerGrams: Number(result.containerGrams) || 0,
          containerDescription: result.containerDescription || '',
          isLiquid: !!result.isLiquid,
          source: 'ai',
          aiConfidence: result.confidence,
        });
      } catch (e) {
        console.error(e);
        status.textContent = e?.message || 'Image upload failed';
      }
    }
  }

  function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(file);
    });
  }

  // Portion confirmation with flexible units.
  // Food always carries per-100g macros; the unit selector converts whatever
  // the user typed into grams via UNIT_TO_G, then we scale + log.
  function openPortionModal(food) {
    // Build available units. Servings only show if the food has a known
    // serving size in grams. Container only shows if a container weight is
    // known (AI photos). Standard units always available.
    const units = [];
    if (food.servingSizeG && food.servingSizeG > 0) {
      const naturalLabel = naturalServingLabel(food.servingDescription);
      const detail = food.servingDescription
        ? `${food.servingDescription.trim()} ≈ ${roundDisp(food.servingSizeG)} g`
        : `${roundDisp(food.servingSizeG)} g`;
      units.push({
        key: 'serving',
        label: `${naturalLabel} (${detail})`,
        toG: food.servingSizeG,
      });
    }
    if (food.containerGrams && food.containerGrams > 0) {
      units.push({
        key: 'container',
        label: `${food.containerDescription || 'container'} (${roundDisp(food.containerGrams)} g)`,
        toG: food.containerGrams,
      });
    }
    units.push({ key: 'g',   label: 'gram (g)',          toG: 1 });
    units.push({ key: 'oz',  label: 'ounce (oz)',        toG: 28.3495 });
    units.push({ key: 'flOz',label: 'fluid ounce (fl oz)', toG: 29.5735 });
    units.push({ key: 'cup', label: 'cup',               toG: 240 });
    units.push({ key: 'ml',  label: 'milliliter (ml)',   toG: 1 });

    // Default unit: serving (or container) if known, else gram.
    // Default count: 1 for serving/container, else the serving size in grams.
    let defaultUnitKey = units[0].key;
    let defaultCount = 1;
    if (defaultUnitKey === 'g') {
      defaultCount = Math.round(food.servingSizeG || 100);
    }

    const countInput = el('input', {
      type: 'text', inputmode: 'decimal', pattern: '[0-9]*[.,]?[0-9]*',
      value: String(defaultCount), autocomplete: 'off',
      class: 'macro-editor-input',
    });
    countInput.addEventListener('input', () => {
      // Allow digits, one decimal point.
      countInput.value = countInput.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
      updatePreview();
    });

    const unitSelect = el('select', { class: 'portion-unit-select' });
    units.forEach((u) => {
      const opt = el('option', { value: u.key }, u.label);
      if (u.key === defaultUnitKey) opt.selected = true;
      unitSelect.appendChild(opt);
    });
    unitSelect.addEventListener('change', updatePreview);

    const inputRow = el('div', { class: 'portion-input-row' }, [
      countInput, unitSelect,
    ]);

    const conversionEl = el('p', { class: 'portion-conversion' });
    const preview = el('div', { class: 'portion-preview' });

    function currentGrams() {
      const count = parseFloat(countInput.value) || 0;
      const unit = units.find((u) => u.key === unitSelect.value) || units[0];
      return Math.max(0, count * unit.toG);
    }

    function updatePreview() {
      const g = currentGrams();
      const scale = g / 100;
      const cal = Math.round(food.calories * scale);
      const p = Math.round(food.proteinG * scale);
      const c = Math.round(food.carbsG * scale);
      const f = Math.round(food.fatG * scale);
      const fb = Math.round(food.fiberG * scale);

      conversionEl.textContent = `= ${roundDisp(g)} g · ${roundDisp(g / 28.3495)} oz`;

      preview.innerHTML = '';
      preview.appendChild(el('div', { class: 'portion-cal' }, `${cal} kcal`));
      preview.appendChild(el('div', { class: 'portion-macros' },
        `P ${p}g · C ${c}g · F ${f}g · Fib ${fb}g`));
    }
    updatePreview();

    const subtitle = food.name + (food.brand ? ` · ${food.brand}` : '') +
      (food.aiConfidence ? ` · ${food.aiConfidence} confidence` : '');

    const body = el('div', {}, [
      el('p', { class: 'row-sub portion-name' }, subtitle),
      el('label', { class: 'field' }, [
        el('span', {}, 'How much?'),
        inputRow,
      ]),
      conversionEl,
      preview,
    ]);

    const save = el('button', { class: 'btn btn-primary btn-block' }, 'Log this food');
    save.onclick = () => {
      const g = currentGrams();
      if (g <= 0) return;
      const scale = g / 100;
      DB.addIntakeEntry(macrosSelectedDate, {
        name: food.name,
        brand: food.brand || '',
        grams: Math.round(g),
        calories: Math.round(food.calories * scale),
        proteinG: Math.round(food.proteinG * scale),
        carbsG:   Math.round(food.carbsG   * scale),
        fatG:     Math.round(food.fatG     * scale),
        fiberG:   Math.round(food.fiberG   * scale),
        source: food.source || 'search',
      });
      closeModal();
      renderMacros();
      toast(`Logged ${food.name}`);
    };

    openModal({ title: 'Log food', body, footer: [save] });
    setTimeout(() => { countInput.focus(); countInput.select(); }, 80);
  }

  function roundDisp(n) {
    if (!Number.isFinite(n)) return '0';
    if (n >= 100) return String(Math.round(n));
    if (n >= 10)  return String(Math.round(n * 10) / 10);
    return String(Math.round(n * 100) / 100);
  }

  // Turn USDA's householdServingFullText like '1 burger' or '12 pieces'
  // into a singular-ish unit name we can stick into the unit dropdown.
  // '1 burger' → 'burger'; '12 pieces' → 'serving' (keep generic since
  // the count would otherwise be confusing).
  function naturalServingLabel(text) {
    if (!text) return 'serving';
    const m = text.trim().match(/^1\s+([a-z][a-z\s]*?)(\s*\(.*\))?$/i);
    if (m) {
      const noun = m[1].trim().toLowerCase();
      if (noun && noun.length <= 24) return noun;
    }
    return 'serving';
  }

  // Tap-to-edit modal — one numeric input + Save. Keeps the visual layer
  // clean and avoids the focus-jank problems of inline keyboard editing.
  function openMacroEditor(def) {
    const intake = DB.getIntake(macrosSelectedDate);
    const targets = DB.getMacroTargets();
    const cur = Math.max(0, Number(intake[def.key]) || 0);
    const target = Math.max(0, Number(targets[def.key]) || 0);

    const input = el('input', {
      type: 'text', inputmode: 'numeric', pattern: '[0-9]*',
      value: cur || '',
      placeholder: '0',
      autocomplete: 'off',
      class: 'macro-editor-input',
    });
    input.addEventListener('input', () => {
      input.value = input.value.replace(/[^0-9]/g, '');
    });

    const body = el('div', {}, [
      el('p', { class: 'row-sub', style: 'margin-bottom: 14px;' },
        target > 0 ? `Target ${target} g · ${fmtDayFromKey(macrosSelectedDate)}` : fmtDayFromKey(macrosSelectedDate)),
      el('label', { class: 'field' }, [
        el('span', {}, `${def.label} (g)`),
        input,
      ]),
    ]);

    const save = el('button', { class: 'btn btn-primary btn-block' }, 'Save');
    save.onclick = () => {
      const v = Math.max(0, parseInt(input.value, 10) || 0);
      DB.setIntake(macrosSelectedDate, { [def.key]: v });
      closeModal();
      renderMacros();
    };

    openModal({ title: `Log ${def.label}`, body, footer: [save] });
    setTimeout(() => { input.focus(); input.select(); }, 80);
  }

  function dateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function fmtDayFromKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      weekday: 'long', month: 'short', day: 'numeric',
    });
  }

  // ---------- Settings: Nutrition targets card
  function renderNutritionCard() {
    const card = $('#nutrition-card');
    if (!card) return;
    card.innerHTML = '';
    const targets = DB.getMacroTargets();

    card.appendChild(el('h3', { class: 'card-title' }, 'Nutrition targets'));
    card.appendChild(el('p', { class: 'row-sub', style: 'margin-bottom: 14px;' },
      'Daily calorie and macro goals. Pick a preset to auto-fill the grams.'));

    // Calorie target input
    const calInput = el('input', {
      type: 'number', inputmode: 'numeric', min: '0', step: '50',
      value: targets.calories || '',
      placeholder: '2000',
    });
    card.appendChild(el('label', { class: 'field' }, [
      el('span', {}, 'Daily calories'),
      calInput,
    ]));

    card.appendChild(el('div', { class: 'ex-section-title', style: 'margin-top: 16px;' }, 'Preset'));
    const chips = el('div', { class: 'chips' });
    card.appendChild(chips);

    card.appendChild(el('div', { class: 'ex-section-title', style: 'margin-top: 16px;' }, 'Grams'));
    const gramsGrid = el('div', { class: 'metric-grid' });
    const gramInputs = {};
    MACRO_DEFS.forEach((def) => {
      const input = el('input', {
        type: 'number', inputmode: 'numeric', min: '0', step: '1',
        value: targets[def.key] || '',
        placeholder: '0',
      });
      gramInputs[def.key] = input;
      gramsGrid.appendChild(el('label', { class: 'field' }, [
        el('span', {}, `${def.label} (g)`),
        input,
      ]));
    });
    card.appendChild(gramsGrid);

    function renderChips() {
      chips.innerHTML = '';
      const current = DB.getMacroTargets();
      Object.entries(MACRO_PRESETS).forEach(([key, val]) => {
        const chip = el('button', {
          class: 'chip' + (current.preset === key ? ' active' : ''),
          onclick: () => {
            if (key === 'custom') {
              DB.setMacroTargets({ preset: 'custom' });
            } else {
              const cal = Math.max(0, parseInt(calInput.value, 10) || 0);
              const next = computeFromPreset(cal, key);
              DB.setMacroTargets({ preset: key, ...next });
              // Reflect into inputs without rebuilding the whole card
              MACRO_DEFS.forEach((def) => { gramInputs[def.key].value = next[def.key] || ''; });
            }
            renderChips();
          },
        }, val.label);
        chips.appendChild(chip);
      });
    }
    renderChips();

    // Wire inputs: editing recomputes preset-fill or flips to Custom.
    calInput.addEventListener('input', () => {
      const cal = Math.max(0, parseInt(calInput.value, 10) || 0);
      const current = DB.getMacroTargets();
      DB.setMacroTargets({ calories: cal });
      if (current.preset && current.preset !== 'custom') {
        const next = computeFromPreset(cal, current.preset);
        if (next) {
          DB.setMacroTargets(next);
          MACRO_DEFS.forEach((def) => { gramInputs[def.key].value = next[def.key] || ''; });
        }
      }
    });
    MACRO_DEFS.forEach((def) => {
      gramInputs[def.key].addEventListener('input', () => {
        const v = Math.max(0, parseInt(gramInputs[def.key].value, 10) || 0);
        DB.setMacroTargets({ [def.key]: v, preset: 'custom' });
        renderChips();
      });
    });
  }

  function renderSettings() {
    renderSyncCard();
    renderMetricsFields();
    renderNutritionCard();
    renderDotChart();
  }

  // ---------- Sync card (sign in with Google)
  let lastSyncError = null;
  function renderSyncCard(err) {
    if (err !== undefined) lastSyncError = err;
    const card = $('#sync-card');
    if (!card) return;
    card.innerHTML = '';
    const cloud = window.CloudSync;
    if (!cloud) {
      card.appendChild(el('h3', { class: 'card-title' }, 'Sync'));
      card.appendChild(el('p', { class: 'row-sub' }, 'Cloud sync is loading…'));
      return;
    }
    const user = cloud.user();
    if (user) {
      const avatar = el('img', { class: 'auth-avatar', src: user.photoURL || '', alt: '' });
      avatar.onerror = () => { avatar.style.display = 'none'; };
      const head = el('div', { class: 'auth-row' }, [
        avatar,
        el('div', { class: 'auth-meta' }, [
          el('div', { class: 'auth-name' }, user.displayName || 'Signed in'),
          el('div', { class: 'auth-email row-sub' }, user.email || ''),
        ]),
      ]);
      const signOutBtn = el('button', { class: 'btn btn-ghost btn-block' }, 'Sign out');
      signOutBtn.onclick = async () => {
        try { await cloud.signOut(); lastSyncError = null; toast('Signed out'); }
        catch (e) { toast('Sign out failed'); }
      };
      card.appendChild(el('h3', { class: 'card-title' }, 'Cloud sync'));
      card.appendChild(head);
      if (lastSyncError) {
        const code = lastSyncError.code || '';
        const isRules = code === 'permission-denied';
        card.appendChild(el('div', { class: 'auth-error' }, [
          el('div', { class: 'auth-error-title' },
            isRules ? 'Firestore security rules not published' : 'Sync failed'),
          el('div', { class: 'auth-error-body' },
            isRules
              ? 'Open Firebase Console → Firestore → Rules and publish the rules from the README. Then tap Retry.'
              : `${code || 'error'}: ${(lastSyncError.message || '').slice(0, 140)}`),
        ]));
        const retry = el('button', { class: 'btn btn-secondary btn-block' }, 'Retry sync');
        retry.onclick = async () => {
          retry.disabled = true;
          try {
            const cs = await cloud.pull();
            if (cs) { DB.replaceFromCloud(cs); rerenderCurrentPage(); }
            else { await DB.pushNow(); }
            lastSyncError = null;
            renderSyncCard();
            toast('Synced');
          } catch (e) {
            renderSyncCard(e);
            toast('Still failing — check console');
          } finally { retry.disabled = false; }
        };
        card.appendChild(retry);
      } else {
        card.appendChild(el('p', { class: 'row-sub auth-status' }, 'Synced — changes appear across all your devices.'));
      }
      card.appendChild(signOutBtn);
    } else {
      card.appendChild(el('h3', { class: 'card-title' }, 'Sync across devices'));
      card.appendChild(el('p', { class: 'row-sub' }, 'Sign in to keep your workouts in sync between your phone and desktop. Works offline too.'));
      const btn = el('button', { class: 'btn btn-google btn-block' });
      btn.innerHTML = '<span class="g-logo" aria-hidden="true">' +
        '<svg viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.17-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.61z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86a5.27 5.27 0 0 1-4.95-3.64H1.04v2.34A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M4.05 10.78a5.4 5.4 0 0 1 0-3.45V4.99H1.04a9 9 0 0 0 0 8.13l3-2.34z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.34l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 1.04 4.99l3 2.34A5.27 5.27 0 0 1 9 3.58z"/></svg>' +
        '</span> Continue with Google';
      btn.onclick = async () => {
        btn.disabled = true;
        try { await cloud.signIn(); }
        catch (e) { console.error(e); toast(e?.code === 'auth/unauthorized-domain' ? 'Domain not authorized in Firebase' : 'Sign in failed'); }
        finally { btn.disabled = false; }
      };
      card.appendChild(btn);
    }
  }

  // Refresh the sync card whenever auth state changes (works on any page —
  // the element may not be in the DOM, renderSyncCard handles that).
  function setupCloudSync() {
    const cloud = window.CloudSync;
    if (!cloud) {
      // firebase.js loads async (it's a module). Retry until it's there.
      setTimeout(setupCloudSync, 100);
      return;
    }
    cloud.onAuth(async (user) => {
      renderSyncCard();
      if (!user) return;
      // First sign-in handling: pull cloud state. If empty, push our local
      // state up so nothing's lost. If non-empty, replace local and re-render.
      try {
        const cloudState = await cloud.pull();
        if (cloudState) {
          DB.replaceFromCloud(cloudState);
          rerenderCurrentPage();
          toast(`Signed in as ${user.displayName || user.email}`);
        } else {
          await DB.pushNow();
          toast(`Signed in — synced ${DB.getWorkouts().length} workout${DB.getWorkouts().length === 1 ? '' : 's'} to cloud`);
        }
        lastSyncError = null;
        renderSyncCard();
      } catch (e) {
        console.error('Initial sync failed:', e);
        const code = e?.code || '';
        let msg = 'Sync error';
        if (code === 'permission-denied') {
          msg = 'Permission denied — publish Firestore security rules';
        } else if (code === 'unavailable') {
          msg = 'Cloud offline — will sync when connection returns';
        } else if (code === 'failed-precondition') {
          msg = 'Sync needs a single browser tab open';
        } else if (e?.message) {
          msg = `Sync error: ${e.message.slice(0, 80)}`;
        }
        toast(msg);
        renderSyncCard(e);
      }
    });
    cloud.onCloudUpdate((cloudState) => {
      DB.replaceFromCloud(cloudState);
      // Don't blow away an actively-focused input. Most snapshots are our
      // own writes round-tripping back, so skipping the re-render while
      // typing is safe — pages have surgical updates for their own state.
      const ae = document.activeElement;
      const isTyping = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA') && !ae.readOnly;
      if (!isTyping) rerenderCurrentPage();
    });
  }

  function rerenderCurrentPage() {
    if (currentPage === 'home') renderHome();
    else if (currentPage === 'history') renderHistory();
    else if (currentPage === 'exercises') renderExercises();
    else if (currentPage === 'macros') renderMacros();
    else if (currentPage === 'settings') renderSettings();
  }

  function renderMetricsFields() {
    const wrap = $('#metrics-fields');
    wrap.innerHTML = '';
    const m = DB.getMetrics();
    const unit = DB.getSettings().unit; // 'kg' | 'lb'
    const isImperial = unit === 'lb';

    const grid = el('div', { class: 'metric-grid' });

    if (isImperial) {
      // Height as ft + in
      const totalInches = m.heightCm != null ? cmToIn(m.heightCm) : null;
      const ft = totalInches != null ? Math.floor(totalInches / 12) : '';
      const inches = totalInches != null ? roundTo(totalInches - ft * 12, 0) : '';

      const ftInput = el('input', { type: 'number', inputmode: 'numeric', placeholder: '5', value: ft });
      const inInput = el('input', { type: 'number', inputmode: 'numeric', placeholder: '10', value: inches });
      const heightWrap = el('div', { class: 'field-dual' }, [ftInput, inInput]);
      grid.appendChild(el('label', { class: 'field' }, [
        el('span', {}, 'Height (ft / in)'),
        heightWrap,
      ]));
      ftInput.dataset.role = 'height-ft';
      inInput.dataset.role = 'height-in';

      const weightInput = el('input', {
        type: 'number', inputmode: 'decimal', placeholder: '165',
        value: m.weightKg != null ? roundTo(kgToLb(m.weightKg), 1) : '',
      });
      weightInput.dataset.role = 'weight-lb';
      grid.appendChild(el('label', { class: 'field' }, [
        el('span', {}, 'Weight (lb)'), weightInput,
      ]));

      const goalInput = el('input', {
        type: 'number', inputmode: 'decimal', placeholder: '158',
        value: m.goalKg != null ? roundTo(kgToLb(m.goalKg), 1) : '',
      });
      goalInput.dataset.role = 'goal-lb';
      grid.appendChild(el('label', { class: 'field' }, [
        el('span', {}, 'Goal (lb)'), goalInput,
      ]));
    } else {
      const heightInput = el('input', {
        type: 'number', inputmode: 'decimal', placeholder: '178',
        value: m.heightCm ?? '',
      });
      heightInput.dataset.role = 'height-cm';
      grid.appendChild(el('label', { class: 'field' }, [
        el('span', {}, 'Height (cm)'), heightInput,
      ]));

      const weightInput = el('input', {
        type: 'number', inputmode: 'decimal', placeholder: '75',
        value: m.weightKg ?? '',
      });
      weightInput.dataset.role = 'weight-kg';
      grid.appendChild(el('label', { class: 'field' }, [
        el('span', {}, 'Weight (kg)'), weightInput,
      ]));

      const goalInput = el('input', {
        type: 'number', inputmode: 'decimal', placeholder: '72',
        value: m.goalKg ?? '',
      });
      goalInput.dataset.role = 'goal-kg';
      grid.appendChild(el('label', { class: 'field' }, [
        el('span', {}, 'Goal (kg)'), goalInput,
      ]));
    }

    const notes = el('textarea', { rows: '2', placeholder: 'Cutting until summer…' });
    notes.value = m.notes ?? '';
    notes.dataset.role = 'notes';
    grid.appendChild(el('label', { class: 'field field-wide' }, [
      el('span', {}, 'Notes'), notes,
    ]));

    wrap.appendChild(grid);
  }

  function collectMetricsFromForm() {
    const wrap = $('#metrics-fields');
    const get = (role) => {
      const node = wrap.querySelector(`[data-role="${role}"]`);
      return node ? node.value : '';
    };
    const unit = DB.getSettings().unit;
    const isImperial = unit === 'lb';
    let heightCm = null;
    if (isImperial) {
      const ft = parseFloat(get('height-ft'));
      const inches = parseFloat(get('height-in'));
      if (!isNaN(ft) || !isNaN(inches)) {
        const totalIn = (isNaN(ft) ? 0 : ft) * 12 + (isNaN(inches) ? 0 : inches);
        heightCm = roundTo(inToCm(totalIn), 1);
      }
    } else {
      const cm = parseFloat(get('height-cm'));
      heightCm = isNaN(cm) ? null : cm;
    }
    let weightKg = null, goalKg = null;
    if (isImperial) {
      const wlb = parseFloat(get('weight-lb'));
      const glb = parseFloat(get('goal-lb'));
      weightKg = isNaN(wlb) ? null : roundTo(lbToKg(wlb), 2);
      goalKg = isNaN(glb) ? null : roundTo(lbToKg(glb), 2);
    } else {
      const wkg = parseFloat(get('weight-kg'));
      const gkg = parseFloat(get('goal-kg'));
      weightKg = isNaN(wkg) ? null : wkg;
      goalKg = isNaN(gkg) ? null : gkg;
    }
    return {
      heightCm, weightKg, goalKg,
      notes: get('notes') || '',
    };
  }

  function renderDotChart() {
    const wrap = $('#dotchart');
    wrap.innerHTML = '';
    const WEEKS = 16;
    const DAYS = WEEKS * 7;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Align so that today is in the last column. Start from (DAYS - 1) days ago, but snap to start of week.
    const start = new Date(today);
    start.setDate(start.getDate() - (DAYS - 1));
    // We want columns by week. Compute counts per day.
    const counts = new Map();
    DB.getWorkouts().forEach((w) => {
      const d = new Date(w.completedAt);
      d.setHours(0, 0, 0, 0);
      const key = d.getTime();
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    // We need to start from a Sunday so that the 7-row grid lines up by weekday.
    const adjustedStart = new Date(start);
    while (adjustedStart.getDay() !== 0) {
      adjustedStart.setDate(adjustedStart.getDate() - 1);
    }
    const totalCells = Math.ceil((today - adjustedStart) / (86400000)) + (7 - today.getDay());
    // Build cells
    for (let i = 0; i < totalCells; i++) {
      const d = new Date(adjustedStart);
      d.setDate(d.getDate() + i);
      const c = counts.get(d.getTime()) || 0;
      let level = 0;
      if (c === 1) level = 2;
      else if (c === 2) level = 3;
      else if (c >= 3) level = 4;
      else if (c > 0) level = 1;
      const cell = el('div', {
        class: 'cell' + (level ? ' l' + level : ''),
        title: `${d.toDateString()} · ${c} workout${c !== 1 ? 's' : ''}`,
      });
      // Hide future cells (after today) by making transparent
      if (d > today) cell.style.opacity = '0';
      wrap.appendChild(cell);
    }
  }

  // ---------- Event wiring
  $('#theme-toggle').addEventListener('click', () => {
    const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });
  $$('#theme-seg button').forEach((b) => b.addEventListener('click', () => applyTheme(b.dataset.theme)));
  $$('#unit-seg button').forEach((b) => b.addEventListener('click', () => applyUnit(b.dataset.unit)));

  $('#start-empty').addEventListener('click', () => startWorkout());
  $('#new-program').addEventListener('click', () => openProgramEditor());
  $('#new-exercise').addEventListener('click', openNewExercise);

  $('#history-search').addEventListener('input', (e) => {
    historyFilter.query = e.target.value;
    renderHistory();
  });
  $$('#history-filters .chip').forEach((c) => c.addEventListener('click', () => {
    historyFilter.range = c.dataset.range;
    $$('#history-filters .chip').forEach((x) => x.classList.toggle('active', x === c));
    renderHistory();
  }));

  $('#exercise-search').addEventListener('input', (e) => {
    exerciseFilter.query = e.target.value;
    renderExerciseGrid();
  });

  $('#save-metrics').addEventListener('click', () => {
    DB.setMetrics(collectMetricsFromForm());
    toast('Metrics saved');
  });

  $('#reset-data').addEventListener('click', () => {
    if (!confirm('This will erase all programs, workouts, exercises and metrics. Continue?')) return;
    DB.reset();
    applyTheme('dark');
    applyUnit('kg');
    renderHome();
    toast('All data cleared');
  });

  // ---------- Boot
  const settings = DB.getSettings();
  applyTheme(settings.theme || 'dark');
  applyUnit(settings.unit || 'kg');
  renderHome();
  setupCloudSync();
})();
