// Tiny localStorage-backed store
const DB = (() => {
  const KEY = 'lift.v1';

  const defaultState = () => ({
    seedVersion: 3,
    exercises: SEED_EXERCISES.map((e) => ({ ...e })),
    programs: SEED_PROGRAMS.map((p) => ({
      ...p,
      routines: p.routines.map((r) => ({ ...r, exercises: [...r.exercises] })),
    })),
    workouts: [],
    metrics: { heightCm: null, weightKg: null, goalKg: null, notes: '' },
    settings: { theme: 'dark', unit: 'kg' },
  });

  let state = null;

  const SEED_VERSION = 3;

  // Run all schema migrations on a parsed/cloud state. Pure function — accepts
  // a state object, returns a fresh migrated object. Used by both load() (from
  // localStorage) and replaceFromCloud() (from Firestore snapshots) so the
  // exercise library catches up no matter where the state came from.
  function migrate(input) {
    const parsed = { ...input };

    if ((parsed.seedVersion || 1) < SEED_VERSION) {
      // Reset seed-managed data, but keep user data (workouts, metrics, settings, custom exercises)
      const customExercises = (parsed.exercises || []).filter((e) =>
        e && e.id && !SEED_EXERCISES.some((s) => s.id === e.id));
      parsed.exercises = [...SEED_EXERCISES.map((e) => ({ ...e })), ...customExercises];
      parsed.seedVersion = SEED_VERSION;
    } else {
      // Fill in any newly-seeded ids
      const known = new Set((parsed.exercises || []).map((e) => e.id));
      const merged = [...(parsed.exercises || [])];
      SEED_EXERCISES.forEach((e) => {
        if (!known.has(e.id)) merged.push({ ...e });
      });
      parsed.exercises = merged;
    }

    parsed.settings = Object.assign({ theme: 'dark', unit: 'kg' }, parsed.settings || {});

    // Canonical body metrics (heightCm/weightKg/goalKg) — old key names supported.
    const oldM = parsed.metrics || {};
    parsed.metrics = {
      heightCm: oldM.heightCm ?? oldM.height ?? null,
      weightKg: oldM.weightKg ?? oldM.weight ?? null,
      goalKg: oldM.goalKg ?? oldM.goal ?? null,
      notes: oldM.notes ?? '',
    };

    parsed.programs = parsed.programs || [];
    parsed.workouts = parsed.workouts || [];

    return parsed;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) {
        state = defaultState();
        save();
        return state;
      }
      state = migrate(JSON.parse(raw));
      // Persist any changes made by the migration immediately.
      localStorage.setItem(KEY, JSON.stringify(state));
      return state;
    } catch (e) {
      state = defaultState();
      save();
      return state;
    }
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
    schedulePush();
  }

  // ----- Cloud sync push (debounced, optional)
  let pushTimer = null;
  let suppressPush = false;
  function schedulePush() {
    if (suppressPush) return;
    if (!window.CloudSync || !window.CloudSync.isAuthed || !window.CloudSync.isAuthed()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      pushTimer = null;
      try {
        window.CloudSync.push(state).catch((e) => console.warn('Cloud push failed:', e));
      } catch (e) { console.warn('Cloud push threw:', e); }
    }, 400);
  }

  // Replace local state with a snapshot from the cloud.
  // The cloud copy may pre-date the current SEED_VERSION (older device pushed
  // it up), so it goes through migrate() too — that's what gets new exercises
  // into the picker after a sync. If the migration changed something, we push
  // the updated state right back so other devices catch up.
  function replaceFromCloud(cloudState) {
    if (!cloudState) return;
    suppressPush = true;
    try {
      const incoming = { ...cloudState };
      delete incoming.updatedAt;
      const incomingVersion = incoming.seedVersion || 1;
      const merged = migrate({ ...defaultState(), ...incoming });
      state = merged;
      localStorage.setItem(KEY, JSON.stringify(state));
    } finally {
      suppressPush = false;
    }
    // If the cloud was on an older seed version, push the migrated state up
    // so the cloud doc (and other devices) get the new exercise library too.
    if ((cloudState.seedVersion || 1) < SEED_VERSION) {
      // Run outside suppressPush so the push actually fires.
      schedulePush();
    }
  }

  // Force a push to cloud (used after first sign-in when cloud is empty).
  function pushNow() {
    if (!window.CloudSync || !window.CloudSync.isAuthed()) return Promise.resolve();
    clearTimeout(pushTimer);
    return window.CloudSync.push(state);
  }

  function reset() {
    state = defaultState();
    save();
  }

  function getState() {
    if (!state) load();
    return state;
  }

  function uid(prefix = 'id') {
    return prefix + '-' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  }

  // ----- Exercises
  function getExercises() { return getState().exercises; }
  function getExercise(id) { return getState().exercises.find((e) => e.id === id); }
  function addExercise(ex) {
    const e = { id: uid('ex'), emoji: '🏋️', ...ex };
    getState().exercises.unshift(e);
    save();
    return e;
  }

  // ----- Programs
  function getPrograms() { return getState().programs; }
  function getProgram(id) { return getState().programs.find((p) => p.id === id); }
  function addProgram({ name, notes }) {
    const p = { id: uid('pg'), name, notes: notes || '', createdAt: Date.now(), routines: [] };
    getState().programs.unshift(p);
    save();
    return p;
  }
  function updateProgram(id, fields) {
    const p = getProgram(id);
    if (!p) return;
    Object.assign(p, fields);
    save();
  }
  function deleteProgram(id) {
    const s = getState();
    s.programs = s.programs.filter((p) => p.id !== id);
    save();
  }
  function moveProgram(id, direction) {
    const programs = getState().programs;
    const i = programs.findIndex((p) => p.id === id);
    if (i === -1) return;
    const target = i + direction;
    if (target < 0 || target >= programs.length) return;
    [programs[i], programs[target]] = [programs[target], programs[i]];
    save();
  }

  // ----- Routines
  function addRoutine(programId, { name, notes, exercises }) {
    const p = getProgram(programId);
    if (!p) return null;
    const r = { id: uid('rt'), name, notes: notes || '', exercises: exercises || [] };
    p.routines.push(r);
    save();
    return r;
  }
  function updateRoutine(programId, routineId, fields) {
    const p = getProgram(programId);
    if (!p) return;
    const r = p.routines.find((x) => x.id === routineId);
    if (!r) return;
    Object.assign(r, fields);
    save();
  }
  function deleteRoutine(programId, routineId) {
    const p = getProgram(programId);
    if (!p) return;
    p.routines = p.routines.filter((r) => r.id !== routineId);
    save();
  }
  function getRoutine(programId, routineId) {
    const p = getProgram(programId);
    return p ? p.routines.find((r) => r.id === routineId) : null;
  }

  // ----- Workouts
  function getWorkouts() {
    return [...getState().workouts].sort((a, b) => b.completedAt - a.completedAt);
  }
  function getWorkout(id) {
    return getState().workouts.find((w) => w.id === id);
  }
  function saveWorkout(w) {
    const finished = {
      id: w.id || uid('wk'),
      name: w.name || 'Empty Workout',
      programId: w.programId || null,
      routineId: w.routineId || null,
      startedAt: w.startedAt,
      completedAt: w.completedAt || Date.now(),
      exercises: w.exercises || [],
    };
    getState().workouts.unshift(finished);
    save();
    return finished;
  }
  function deleteWorkout(id) {
    const s = getState();
    s.workouts = s.workouts.filter((w) => w.id !== id);
    save();
  }

  // ----- Exercise history (sets) across all workouts
  function getExerciseHistory(exerciseId) {
    const entries = [];
    getWorkouts().forEach((w) => {
      w.exercises.forEach((ex) => {
        if (ex.exerciseId === exerciseId) {
          entries.push({
            workoutId: w.id,
            workoutName: w.name,
            date: w.completedAt,
            sets: ex.sets || [],
          });
        }
      });
    });
    return entries;
  }

  // ----- Metrics
  function getMetrics() { return getState().metrics; }
  function setMetrics(m) {
    Object.assign(getState().metrics, m);
    save();
  }

  // ----- Settings
  function getSettings() { return getState().settings; }
  function setSetting(key, value) {
    getState().settings[key] = value;
    save();
  }

  // ----- Derived
  function totalVolume() {
    let total = 0;
    getWorkouts().forEach((w) => {
      w.exercises.forEach((ex) => {
        (ex.sets || []).forEach((s) => {
          if (s.done !== false && s.weight && s.reps) {
            total += Number(s.weight) * Number(s.reps);
          }
        });
      });
    });
    return Math.round(total);
  }

  function workoutsInRange(days) {
    if (days === 'all' || !days) return getWorkouts();
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return getWorkouts().filter((w) => w.completedAt >= cutoff);
  }

  function workoutsThisWeek() {
    const now = new Date();
    const dow = now.getDay(); // 0 = Sun
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - dow);
    return getWorkouts().filter((w) => w.completedAt >= start.getTime()).length;
  }

  return {
    load, save, reset, getState, uid,
    getExercises, getExercise, addExercise,
    getPrograms, getProgram, addProgram, updateProgram, deleteProgram, moveProgram,
    addRoutine, updateRoutine, deleteRoutine, getRoutine,
    getWorkouts, getWorkout, saveWorkout, deleteWorkout,
    getExerciseHistory,
    getMetrics, setMetrics,
    getSettings, setSetting,
    totalVolume, workoutsInRange, workoutsThisWeek,
    replaceFromCloud, pushNow,
  };
})();
