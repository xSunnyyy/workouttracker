// Vercel Edge function — searches Open Food Facts for a food/product by
// keyword. No API key needed (Open Food Facts is fully open). Results are
// normalised to a compact shape the client can render directly.

export const config = { runtime: 'edge' };

const ENDPOINT = 'https://world.openfoodfacts.org/cgi/search.pl';

export default async function handler(req) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();
  if (!q) return json({ results: [] }, 200);

  const upstream = new URL(ENDPOINT);
  upstream.searchParams.set('search_terms', q);
  upstream.searchParams.set('search_simple', '1');
  upstream.searchParams.set('action', 'process');
  upstream.searchParams.set('json', '1');
  upstream.searchParams.set('page_size', '24');
  // Only ask for the fields we need.
  upstream.searchParams.set('fields',
    'code,product_name,brands,serving_size,serving_quantity,image_small_url,nutriments,nutrition_data_per');

  try {
    const res = await fetch(upstream.toString(), {
      headers: { 'User-Agent': 'Lift-WorkoutTracker/1.0 (https://github.com)' },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return json({ error: `Upstream ${res.status}`, detail: body.slice(0, 200) }, 502);
    }
    const data = await res.json();
    const results = (data.products || [])
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
  } catch (err) {
    return json({ error: err?.message || String(err) }, 502);
  }
}

// Map an Open Food Facts product into our compact shape. We always work in
// per-100g numbers (the most reliable field across the catalogue) and let
// the client scale by the portion the user logs.
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
    // Per-100g nutrition (canonical)
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
