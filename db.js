// Tiny localStorage-backed store
const DB = (() => {
  const KEY = 'lift.v1';

  const defaultState = () => ({
    exercises: SEED_EXERCISES.map((e) => ({ ...e })),
    programs: SEED_PROGRAMS.map((p) => ({
      ...p,
      routines: p.routines.map((r) => ({ ...r, exercises: [...r.exercises] })),
    })),
    workouts: [],
    metrics: { height: null, weight: null, goal: null, notes: '' },
    settings: { theme: 'dark', unit: 'kg' },
  });

  let state = null;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) {
        state = defaultState();
        save();
        return state;
      }
      const parsed = JSON.parse(raw);
      // Make sure new seed exercises appear for existing users
      const known = new Set(parsed.exercises?.map((e) => e.id) || []);
      const merged = [...(parsed.exercises || [])];
      SEED_EXERCISES.forEach((e) => {
        if (!known.has(e.id)) merged.push({ ...e });
      });
      parsed.exercises = merged;
      parsed.settings = parsed.settings || { theme: 'dark', unit: 'kg' };
      parsed.metrics = parsed.metrics || { height: null, weight: null, goal: null, notes: '' };
      state = parsed;
      return state;
    } catch (e) {
      state = defaultState();
      save();
      return state;
    }
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
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
    getPrograms, getProgram, addProgram, updateProgram, deleteProgram,
    addRoutine, updateRoutine, deleteRoutine, getRoutine,
    getWorkouts, getWorkout, saveWorkout, deleteWorkout,
    getExerciseHistory,
    getMetrics, setMetrics,
    getSettings, setSetting,
    totalVolume, workoutsInRange, workoutsThisWeek,
  };
})();
