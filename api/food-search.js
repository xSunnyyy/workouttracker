// Vercel Edge function — searches USDA FoodData Central for foods.
// USDA's database covers generic ingredients, common dishes (via FNDDS
// "Survey" foods), and major branded products — much better suited to
// real meal tracking than Open Food Facts.
//
// Setup: get a free API key (instant, no card) at
// https://fdc.nal.usda.gov/api-key-signup.html and add it in Vercel as
// USDA_API_KEY.
//
// We fall back to Open Food Facts if USDA_API_KEY isn't set or if USDA
// itself fails, so the app still works (just with weaker results).

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();
  if (!q) return json({ results: [] }, 200);

  const usdaKey = process.env.USDA_API_KEY;
  let lastErr = null;

  // 1) USDA FoodData Central (preferred). If the key is set we try USDA
  //    and ONLY fall back to OFF on 5xx/network errors. A 4xx response
  //    (bad key, quota) is surfaced loudly so the user knows to fix it
  //    rather than seeing junk OFF results.
  if (usdaKey) {
    try {
      const results = await searchUSDA(q, usdaKey);
      return jsonCached({ results, source: 'usda' });
    } catch (e) {
      if (e.status && e.status >= 400 && e.status < 500) {
        return json({
          error: `USDA rejected the request (${e.status}). Check that USDA_API_KEY is correct in Vercel → Settings → Environment Variables, and redeploy.`,
          detail: String(e.message || '').slice(0, 200),
        }, e.status === 403 ? 403 : 502);
      }
      lastErr = e;
    }
  }

  // 2) Open Food Facts (fallback or default if no USDA key)
  try {
    const results = await searchOFF(q);
    return jsonCached({
      results,
      source: 'openfoodfacts',
      note: usdaKey
        ? 'Fell back to Open Food Facts — USDA was unavailable.'
        : 'Using Open Food Facts. Add USDA_API_KEY in Vercel for better results.',
    });
  } catch (e) {
    lastErr = e;
  }

  return json({
    error: usdaKey
      ? 'Food databases are temporarily unavailable. Try again in a few seconds.'
      : 'No USDA_API_KEY set on the server and the fallback database is unavailable. Add USDA_API_KEY in Vercel for reliable results.',
    detail: lastErr ? String(lastErr.message || lastErr).slice(0, 200) : '',
  }, 503);
}

// ----- USDA FoodData Central -----
const USDA_ENDPOINT = 'https://api.nal.usda.gov/fdc/v1/foods/search';

async function searchUSDA(q, apiKey) {
  const url = new URL(USDA_ENDPOINT);
  url.searchParams.set('api_key', apiKey);
  // Append '*' to each plain term so partial words match as the user types
  // ('mcdon' → 'mcdon*' → matches 'mcdonalds'). Leaves quoted phrases and
  // existing wildcards alone.
  url.searchParams.set('query', expandQuery(q));
  url.searchParams.set('pageSize', '24');
  // No dataType filter — USDA returns 400 for certain query+filter combos,
  // and the default (all types) gives us the broadest coverage anyway.

  const res = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`USDA HTTP ${res.status}: ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const foods = data.foods || [];
  return foods.map(normaliseUsda).filter(Boolean);
}

// USDA nutrient lookup by common nutrient numbers + names.
const NUTR_CAL    = ['Energy', 'Energy (Atwater General Factors)', 'Energy (Atwater Specific Factors)'];
const NUTR_PROT   = ['Protein'];
const NUTR_CARBS  = ['Carbohydrate, by difference', 'Carbohydrates'];
const NUTR_FAT    = ['Total lipid (fat)', 'Total fat (NLEA)'];
const NUTR_FIBER  = ['Fiber, total dietary'];

function findNutrient(nutrients, names) {
  // Try by name match (case-insensitive)
  for (const name of names) {
    const found = nutrients.find((n) =>
      (n.nutrientName || '').toLowerCase() === name.toLowerCase());
    if (found && Number.isFinite(Number(found.value))) {
      return { value: Number(found.value), unit: found.unitName || '' };
    }
  }
  return null;
}

function normaliseUsda(food) {
  const nutrients = food.foodNutrients || [];
  const calRaw   = findNutrient(nutrients, NUTR_CAL);
  if (!calRaw) return null;
  const protRaw  = findNutrient(nutrients, NUTR_PROT);
  const carbsRaw = findNutrient(nutrients, NUTR_CARBS);
  const fatRaw   = findNutrient(nutrients, NUTR_FAT);
  const fiberRaw = findNutrient(nutrients, NUTR_FIBER);

  const cal   = calRaw.value;
  const prot  = protRaw  ? protRaw.value  : 0;
  const carbs = carbsRaw ? carbsRaw.value : 0;
  const fat   = fatRaw   ? fatRaw.value   : 0;
  const fiber = fiberRaw ? fiberRaw.value : 0;
  const calKcal = (calRaw.unit || '').toUpperCase() === 'KJ' ? cal / 4.184 : cal;

  // Convert the serving size to grams across the most common USDA units so
  // foods like '1 burger', '1 cup', '12 oz' all give us a usable per-serving
  // weight (and therefore a usable 'serving' unit in the portion modal).
  // Fall back to parsing '(155g)' out of the household text if the direct
  // serving fields don't yield grams.
  let servingG = servingToGrams(food.servingSize, food.servingSizeUnit);
  if (!servingG) servingG = gramsFromText(food.householdServingFullText);

  return {
    id: 'usda-' + (food.fdcId || food.description),
    name: food.description || food.lowercaseDescription || 'Unknown',
    brand: food.brandName || food.brandOwner || '',
    image: '',
    // 'household' name like '1 burger', '12 pieces', '1 cup' — what the
    // label printed for the consumer. Used by the client to label the
    // default serving unit so people can log 'burgers' not 'grams'.
    servingDescription: food.householdServingFullText || '',
    servingSizeText: food.servingSize
      ? `${food.servingSize} ${food.servingSizeUnit || 'g'}` : '',
    servingSizeG: servingG,
    calories: round(calKcal),
    proteinG: round(prot),
    carbsG:   round(carbs),
    fatG:     round(fat),
    fiberG:   round(fiber),
  };
}

// Append '*' to each plain word so USDA's Lucene-backed search does prefix
// matching ('mcdon*' matches 'mcdonalds'). Don't touch already-wildcarded
// terms or quoted phrases.
function expandQuery(q) {
  return String(q || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => {
      if (t.includes('*') || t.startsWith('"') || t.startsWith('+') || t.startsWith('-')) return t;
      // Strip any trailing punctuation so 'cheese,' becomes 'cheese*'.
      const cleaned = t.replace(/[^\w']+$/g, '');
      return cleaned ? cleaned + '*' : t;
    })
    .join(' ');
}

// USDA gives serving sizes in many units, sometimes as ISO codes like
// GRM/MLT for branded items. Convert to grams (approximate for liquids).
function servingToGrams(size, unit) {
  const n = Number(size);
  if (!Number.isFinite(n) || n <= 0) return null;
  const u = String(unit || '').trim().toLowerCase();
  if (!u) return null;
  // Grams family
  if (['g', 'gm', 'gram', 'grams', 'grm'].includes(u)) return n;
  if (u === 'mg') return n / 1000;
  if (u === 'kg') return n * 1000;
  // Liquid family (1 ml ≈ 1 g)
  if (['ml', 'mlt', 'milliliter', 'millilitre', 'milliliters', 'millilitres'].includes(u)) return n;
  if (['l', 'lt', 'liter', 'litre', 'liters', 'litres'].includes(u)) return n * 1000;
  // Imperial
  if (['oz', 'ozm', 'ounce', 'ounces'].includes(u)) return n * 28.3495;
  if (['fl oz', 'floz', 'oza'].includes(u)) return n * 29.5735;
  if (['cup', 'cups'].includes(u)) return n * 240;
  if (['tbsp', 'tablespoon', 'tablespoons', 'tbs'].includes(u)) return n * 15;
  if (['tsp', 'teaspoon', 'teaspoons'].includes(u)) return n * 5;
  // Whole-item units (USDA uses 'piece', 'each' etc) — we don't know the
  // weight so return null and let the household text fallback try.
  return null;
}

// Extract '(155 g)' from strings like '1 burger (155 g)' or '1 cup (240ml)'.
function gramsFromText(text) {
  if (!text) return null;
  const m = String(text).match(/\(\s*([\d.]+)\s*(g|gm|gram|grams|ml|mlt|milliliter|millilitre)\s*\)/i);
  if (m) {
    const n = parseFloat(m[1]);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// ----- Open Food Facts fallback -----
const OFF_ENDPOINTS = [
  'https://world.openfoodfacts.org/api/v2/search',
  'https://world.openfoodfacts.org/cgi/search.pl',
];
const OFF_FIELDS = [
  'code', 'product_name', 'brands',
  'serving_size', 'serving_quantity', 'image_small_url',
  'nutriments',
].join(',');

async function searchOFF(q) {
  let lastErr = null;
  for (const endpoint of OFF_ENDPOINTS) {
    try {
      const url = new URL(endpoint);
      url.searchParams.set('search_terms', q);
      url.searchParams.set('page_size', '24');
      url.searchParams.set('fields', OFF_FIELDS);
      if (endpoint.includes('/cgi/')) {
        url.searchParams.set('search_simple', '1');
        url.searchParams.set('action', 'process');
        url.searchParams.set('json', '1');
      }
      const res = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'Lift-WorkoutTracker/1.0 (https://github.com)',
          'Accept': 'application/json',
        },
      });
      if (!res.ok) {
        lastErr = new Error(`OFF ${endpoint}: ${res.status}`);
        continue;
      }
      const data = await res.json();
      return (data.products || data.hits || [])
        .map(normaliseOff)
        .filter(Boolean);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Open Food Facts unavailable');
}

function normaliseOff(p) {
  if (!p || !p.product_name) return null;
  const n = p.nutriments || {};
  const cal = pickNum(n['energy-kcal_100g'], n['energy-kcal'], n['energy_100g']);
  if (cal == null) return null;
  return {
    id: 'off-' + (p.code || p.product_name),
    name: p.product_name,
    brand: p.brands || '',
    image: p.image_small_url || '',
    servingDescription: p.serving_size || '',
    servingSizeText: p.serving_size || '',
    servingSizeG: parseFloat(p.serving_quantity) || null,
    calories: round(cal),
    proteinG: round(pickNum(n['proteins_100g'])),
    carbsG:   round(pickNum(n['carbohydrates_100g'])),
    fatG:     round(pickNum(n['fat_100g'])),
    fiberG:   round(pickNum(n['fiber_100g'])),
  };
}

// ----- Helpers -----
function pickNum(...vals) {
  for (const v of vals) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}
function round(v) { return v == null ? 0 : Math.round(v * 10) / 10; }

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
function jsonCached(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      // Short cache so the source / db can change without stale results.
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
    },
  });
}
