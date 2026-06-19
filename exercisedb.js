// =========================================
// ExerciseDB integration — fetches the public catalog from RapidAPI and
// fuzzy-matches GIFs against our exercises by name + equipment + target.
// All client-side; requires the user's own RapidAPI key.
// =========================================

const ExerciseDB = (() => {

  // We proxy through our own /api/* endpoint on Vercel so the RapidAPI key
  // stays server-side. The proxy edge-caches aggressively, so the underlying
  // RapidAPI request happens at most once per week per region.
  const ENDPOINT = '/api/exercisedb-catalog';

  // ----- Name normalisation
  const STOPWORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'with', 'for', 'on', 'of',
    'to', 'in', 'from', 'into', 'over', 'under', 'around',
  ]);

  // Aliases that paper over vocab differences between my exercise names
  // and ExerciseDB's naming.
  const ALIASES = {
    'ohp': 'overhead press',
    'bb': 'barbell',
    'db': 'dumbbell',
    'rdl': 'romanian deadlift',
    'sldl': 'stiff leg deadlift',
    'pullup': 'pull up',
    'chinup': 'chin up',
    'pushup': 'push up',
    'pulldown': 'pulldown',
    'jm': 'jm',
    'tricep': 'triceps',
    'bicep': 'biceps',
    'glute': 'glutes',
    'bw': 'bodyweight',
    'kb': 'kettlebell',
    'leg-press': 'leg press',
  };

  function tokenize(name) {
    return (name || '')
      .toLowerCase()
      .replace(/[()\/]/g, ' ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .map((t) => ALIASES[t] || t)
      .join(' ')
      .split(/\s+/)
      .filter((t) => t && !STOPWORDS.has(t));
  }

  function jaccard(aTokens, bTokens) {
    if (!aTokens.length || !bTokens.length) return 0;
    const a = new Set(aTokens), b = new Set(bTokens);
    let intersect = 0;
    a.forEach((t) => { if (b.has(t)) intersect++; });
    const union = a.size + b.size - intersect;
    return union ? intersect / union : 0;
  }

  // Equipment mapping: our values → set of ExerciseDB equivalents.
  const EQUIP_MAP = {
    Barbell: new Set(['barbell', 'olympic barbell', 'ez barbell', 'trap bar']),
    Dumbbell: new Set(['dumbbell']),
    Cable: new Set(['cable', 'pulley']),
    Machine: new Set(['leverage machine', 'sled machine', 'smith machine', 'assisted', 'weighted', 'lever']),
    Bodyweight: new Set(['body weight', 'bodyweight']),
    Kettlebell: new Set(['kettlebell']),
    Bands: new Set(['band', 'elastic band', 'resistance band']),
    Cardio: new Set(['stationary bike', 'rowing machine', 'elliptical', 'treadmill', 'stair climber', 'rope']),
  };

  // Muscle mapping: our muscleGroup → set of ExerciseDB targets/bodyParts.
  const TARGET_MAP = {
    Chest: new Set(['pectorals', 'chest']),
    Back: new Set(['lats', 'upper back', 'traps', 'back']),
    Shoulders: new Set(['delts', 'shoulders']),
    Arms: new Set(['biceps', 'triceps', 'forearms', 'upper arms', 'lower arms']),
    Legs: new Set(['quads', 'hamstrings', 'glutes', 'calves', 'abductors', 'adductors', 'upper legs', 'lower legs']),
    Core: new Set(['abs', 'waist']),
    Cardio: new Set(['cardio']),
    'Full Body': new Set([]),
  };

  function score(mine, db) {
    const nameScore = jaccard(tokenize(mine.name), tokenize(db.name));
    const equipSet = EQUIP_MAP[mine.equipment] || new Set();
    const equipBonus = equipSet.has((db.equipment || '').toLowerCase()) ? 1 : 0;
    const targetSet = TARGET_MAP[mine.muscleGroup] || new Set();
    const targetBonus = targetSet.has((db.target || '').toLowerCase()) ||
                        targetSet.has((db.bodyPart || '').toLowerCase()) ? 1 : 0;
    // Weight: name dominates, equipment and target are tie-breakers.
    return 0.7 * nameScore + 0.18 * equipBonus + 0.12 * targetBonus;
  }

  async function fetchCatalog() {
    let res;
    try {
      res = await fetch(ENDPOINT);
    } catch (e) {
      const err = new Error('Network error reaching /api/exercisedb-catalog');
      err.cause = e;
      throw err;
    }
    if (!res.ok) {
      // Surface the server's JSON error if it sent one (proxy returns helpful
      // messages for "missing env var", "upstream 401", etc).
      let detail = '';
      try {
        const j = await res.json();
        detail = j.error || JSON.stringify(j);
      } catch {
        detail = await res.text().catch(() => '');
      }
      // Local dev (python -m http.server) returns 404 + HTML — translate that
      // into something obviously diagnosable.
      if (res.status === 404) {
        detail = 'Proxy endpoint not found. If you\'re running locally use `vercel dev`, or deploy to Vercel first.';
      }
      const err = new Error(`${detail || 'HTTP ' + res.status}`);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    // ExerciseDB plans return either an array or { data: [...] }
    return Array.isArray(data) ? data : (data.data || []);
  }

  function findBestMatch(myExercise, catalog) {
    let best = null;
    let bestScore = 0;
    catalog.forEach((db) => {
      if (!db.gifUrl) return;
      const s = score(myExercise, db);
      if (s > bestScore) {
        bestScore = s;
        best = db;
      }
    });
    // Threshold: at least 0.35 to avoid garbage matches.
    return bestScore >= 0.35 ? { match: best, score: bestScore } : null;
  }

  async function matchAll({ exercises, onProgress }) {
    const catalog = await fetchCatalog();
    const matches = [];
    let i = 0;
    for (const ex of exercises) {
      const m = findBestMatch(ex, catalog);
      if (m) matches.push({ exerciseId: ex.id, ...m });
      i++;
      if (onProgress && i % 20 === 0) onProgress(i, exercises.length);
    }
    return { catalog, matches };
  }

  return { fetchCatalog, findBestMatch, matchAll, score, tokenize };
})();
