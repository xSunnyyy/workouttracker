// Vercel Edge function — searches Open Food Facts for a food/product by
// keyword. Tries the REST v2 endpoint first (faster, more reliable) and
// falls back to the legacy CGI search if v2 hiccups. No API key needed.

export const config = { runtime: 'edge' };

const ENDPOINTS = [
  'https://world.openfoodfacts.org/api/v2/search',
  'https://world.openfoodfacts.org/cgi/search.pl',
];

const FIELDS = [
  'code', 'product_name', 'brands',
  'serving_size', 'serving_quantity', 'image_small_url',
  'nutriments', 'nutrition_data_per',
].join(',');

export default async function handler(req) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();
  if (!q) return json({ results: [] }, 200);

  let lastErr = null;
  for (const endpoint of ENDPOINTS) {
    try {
      const data = await fetchEndpoint(endpoint, q);
      const results = (data.products || data.hits || [])
        .map(normalize)
        .filter((r) => r && r.name && r.calories != null);
      return new Response(JSON.stringify({ results }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (e) {
      lastErr = e;
      // Try the next endpoint
    }
  }
  return json({
    error: 'Food database is currently unavailable (Open Food Facts upstream). Please try again in a moment.',
    detail: lastErr ? String(lastErr.message || lastErr).slice(0, 200) : '',
  }, 503);
}

async function fetchEndpoint(endpoint, q) {
  const url = new URL(endpoint);
  url.searchParams.set('search_terms', q);
  url.searchParams.set('page_size', '24');
  url.searchParams.set('fields', FIELDS);
  // Legacy CGI endpoint needs these extras
  if (endpoint.includes('/cgi/')) {
    url.searchParams.set('search_simple', '1');
    url.searchParams.set('action', 'process');
    url.searchParams.set('json', '1');
  }

  // Single retry with short backoff on 5xx — OFF is sometimes briefly busy.
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Lift-WorkoutTracker/1.0 (https://github.com)',
        'Accept': 'application/json',
      },
    });
    if (res.ok) {
      const text = await res.text();
      try { return JSON.parse(text); }
      catch { throw new Error(`Non-JSON response: ${text.slice(0, 120)}`); }
    }
    if (res.status < 500) {
      throw new Error(`HTTP ${res.status}`);
    }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('5xx after retry');
}

// Map an Open Food Facts product into our compact shape. Always per-100g.
function normalize(p) {
  if (!p || !p.product_name) return null;
  const n = p.nutriments || {};
  const cal = pickNum(n['energy-kcal_100g'], n['energy-kcal'], n['energy_100g']);
  if (cal == null) return null;
  return {
    id: p.code || p.product_name,
    name: p.product_name,
    brand: p.brands || '',
    image: p.image_small_url || '',
    servingSizeText: p.serving_size || '',
    servingSizeG: parseFloat(p.serving_quantity) || null,
    calories: round(cal),
    proteinG: round(pickNum(n['proteins_100g'])),
    carbsG:   round(pickNum(n['carbohydrates_100g'])),
    fatG:     round(pickNum(n['fat_100g'])),
    fiberG:   round(pickNum(n['fiber_100g'])),
  };
}

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
