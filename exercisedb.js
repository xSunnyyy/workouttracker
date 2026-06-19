// =========================================
// ExerciseDB integration — pulls the catalog from our Vercel proxy and
// matches GIFs against our exercises by name + equipment + target.
// Also exposes a search/picker so users can manually assign a GIF to any
// exercise.
// =========================================

const ExerciseDB = (() => {

  const ENDPOINT = '/api/exercisedb-catalog';

  // ----- Name normalisation
  const STOPWORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'with', 'for', 'on', 'of',
    'to', 'in', 'from', 'into', 'over', 'under', 'around',
  ]);

  const ALIASES = {
    'ohp': 'overhead press',
    'bb': 'barbell',
    'db': 'dumbbell',
    'rdl': 'romanian deadlift',
    'sldl': 'stiff leg deadlift',
    'pullup': 'pull up',
    'chinup': 'chin up',
    'pushup': 'push up',
    'tricep': 'triceps',
    'bicep': 'biceps',
    'glute': 'glutes',
    'bw': 'bodyweight',
    'kb': 'kettlebell',
    'sit': 'situp',
    'situp': 'sit up',
  };

  function tokenize(name) {
    return (name || '')
      .toLowerCase()
      .replace(/[()\/\-]/g, ' ')
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

  // Mappings: ours → ExerciseDB equivalents
  const EQUIP_MAP = {
    Barbell: new Set(['barbell', 'olympic barbell', 'ez barbell', 'trap bar', 'weighted']),
    Dumbbell: new Set(['dumbbell']),
    Cable: new Set(['cable', 'pulley']),
    Machine: new Set(['leverage machine', 'sled machine', 'smith machine', 'assisted', 'lever']),
    Bodyweight: new Set(['body weight', 'bodyweight']),
    Kettlebell: new Set(['kettlebell']),
    Bands: new Set(['band', 'elastic band', 'resistance band']),
    Cardio: new Set(['stationary bike', 'rowing machine', 'elliptical', 'treadmill', 'stair climber', 'rope', 'medicine ball']),
  };

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
    const targetBonus = (targetSet.has((db.target || '').toLowerCase()) ||
                         targetSet.has((db.bodyPart || '').toLowerCase())) ? 1 : 0;
    return 0.7 * nameScore + 0.18 * equipBonus + 0.12 * targetBonus;
  }

  // ----- Catalog fetching + caching
  // Defensive extraction: ExerciseDB has shipped multiple response shapes.
  // We try array, then common wrapper keys, then a single result.
  function extractCatalog(data) {
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
      for (const key of ['data', 'exercises', 'results', 'items', 'rows']) {
        if (Array.isArray(data[key])) return data[key];
      }
      if (data.id && data.gifUrl) return [data];
    }
    return [];
  }

  // Normalise field names — handles both camelCase and snake_case schemas
  // some forks of ExerciseDB use.
  function normaliseExercise(raw) {
    if (!raw) return null;
    return {
      id: raw.id || raw.exerciseId || raw._id || String(raw.name || '').slice(0, 40),
      name: raw.name || raw.exerciseName || '',
      gifUrl: raw.gifUrl || raw.gif_url || raw.gif || raw.imageUrl || '',
      target: raw.target || raw.targetMuscle || raw.primary_muscle || '',
      bodyPart: raw.bodyPart || raw.body_part || raw.bodyParts || '',
      equipment: raw.equipment || '',
      secondaryMuscles: raw.secondaryMuscles || raw.secondary_muscles || [],
      instructions: raw.instructions || [],
    };
  }

  let _catalog = null;
  let _catalogAt = 0;
  let _catalogPromise = null;

  async function getCatalog({ force = false } = {}) {
    if (!force && _catalog && Date.now() - _catalogAt < 30 * 60 * 1000) {
      return _catalog;
    }
    if (_catalogPromise) return _catalogPromise;
    _catalogPromise = (async () => {
      let res;
      try { res = await fetch(ENDPOINT); }
      catch (e) {
        const err = new Error('Network error reaching /api/exercisedb-catalog');
        err.cause = e;
        throw err;
      }
      if (!res.ok) {
        let detail = '';
        try { const j = await res.json(); detail = j.error || JSON.stringify(j); }
        catch { detail = (await res.text().catch(() => '')).slice(0, 240); }
        if (res.status === 404) {
          detail = 'Proxy endpoint not found. If running locally use `vercel dev`, otherwise deploy to Vercel.';
        }
        const err = new Error(detail || `HTTP ${res.status}`);
        err.status = res.status;
        throw err;
      }
      const raw = await res.json();
      const extracted = extractCatalog(raw);
      _catalog = extracted.map(normaliseExercise).filter((e) => e && e.name && e.gifUrl);
      _catalogAt = Date.now();
      return _catalog;
    })();
    try { return await _catalogPromise; }
    finally { _catalogPromise = null; }
  }

  // Search the in-memory catalog by name (token-based, AND across query terms).
  function searchCatalog(query, limit = 60) {
    if (!_catalog) return [];
    const q = (query || '').toLowerCase().trim();
    if (!q) return _catalog.slice(0, limit);
    const tokens = q.split(/\s+/).filter(Boolean);
    return _catalog
      .filter((ex) => {
        const name = (ex.name || '').toLowerCase();
        return tokens.every((t) => name.includes(t));
      })
      .slice(0, limit);
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
    // Lower threshold (0.25) to be more permissive. Equipment/target bonuses
    // can carry a match across when the name has only a partial overlap.
    return bestScore >= 0.25 ? { match: best, score: bestScore } : null;
  }

  async function matchAll({ exercises, onProgress }) {
    const catalog = await getCatalog();
    const matches = [];
    const unmatched = [];
    exercises.forEach((ex, i) => {
      const m = findBestMatch(ex, catalog);
      if (m) matches.push({ exerciseId: ex.id, ...m });
      else unmatched.push(ex);
      if (onProgress && (i + 1) % 25 === 0) onProgress(i + 1, exercises.length);
    });
    return {
      catalogSize: catalog.length,
      matches,
      unmatched,
      perfectCount: matches.filter((m) => m.score >= 0.7).length,
      fuzzyCount: matches.filter((m) => m.score < 0.7).length,
    };
  }

  return {
    getCatalog, searchCatalog,
    findBestMatch, matchAll, score, tokenize,
  };
})();
