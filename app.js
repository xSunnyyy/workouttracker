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
    programs.forEach((p) => {
      const card = el('div', { class: 'program-card glass' });
      const head = el('div', { class: 'program-head' }, [
        el('div', {}, [
          el('div', { class: 'program-name' }, p.name),
          el('div', { class: 'program-meta' }, `${p.routines.length} routine${p.routines.length !== 1 ? 's' : ''}`),
        ]),
        el('button', {
          class: 'text-btn',
          onclick: (e) => { e.stopPropagation(); openProgramEditor(p); },
        }, 'Edit'),
      ]);
      card.appendChild(head);
      if (p.notes) card.appendChild(el('p', { class: 'program-notes' }, p.notes));

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
              html: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
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
      card.appendChild(routinesWrap);
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
    const search = el('input', { type: 'text', placeholder: 'Search exercises' });
    const searchBar = el('div', { class: 'search-bar glass', style: 'margin-bottom: 14px;' }, [
      el('div', { html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>' }).firstChild
        ? (() => { const w = el('span'); w.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>'; return w.firstChild; })()
        : el('span'),
      search,
    ]);

    const list = el('div', { class: 'picker-list' });
    const renderList = () => {
      list.innerHTML = '';
      const q = search.value.toLowerCase().trim();
      const filtered = DB.getExercises().filter((e) =>
        !q || e.name.toLowerCase().includes(q) || e.muscleGroup.toLowerCase().includes(q) || (e.keywords || []).some((k) => k.includes(q))
      );
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

    const body = el('div', {}, [searchBar, list]);
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

    return el('div', {
      class: 'history-card glass',
      onclick: () => openWorkoutDetail(w),
    }, [
      el('div', { class: 'history-top' }, [
        el('div', { class: 'history-name' }, w.name || 'Workout'),
        el('div', { class: 'history-date' }, fmtDate(w.completedAt)),
      ]),
      el('div', { class: 'history-sub' }, subParts.join(' · ') || ' '),
      el('div', { class: 'history-metrics' }, [
        el('div', {}, [el('b', {}, String(totalSets)), ' sets']),
        el('div', {}, [el('b', {}, volume.toLocaleString()), ` ${DB.getSettings().unit}`]),
      ]),
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
  function renderSettings() {
    renderMetricsFields();
    renderDotChart();
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
})();
