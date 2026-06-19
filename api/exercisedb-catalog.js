// Vercel Edge function — proxies the ExerciseDB catalog from RapidAPI.
// The client never sees the API key. Aggressive edge caching means
// the underlying request hits RapidAPI at most once per cache window
// regardless of how many users open the app.

export const config = { runtime: 'edge' };

const HOST = 'exercisedb.p.rapidapi.com';
const UPSTREAM = `https://${HOST}/exercises?limit=2000`;

export default async function handler(req) {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    return json(
      { error: 'Server is missing the RAPIDAPI_KEY environment variable. Set it in Vercel → Settings → Environment Variables and redeploy.' },
      500,
    );
  }

  try {
    const upstream = await fetch(UPSTREAM, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': HOST,
      },
    });

    if (!upstream.ok) {
      const body = await upstream.text().catch(() => '');
      return json(
        { error: `Upstream ${upstream.status}`, detail: body.slice(0, 400) },
        upstream.status === 429 ? 429 : 502,
      );
    }

    // Parse, normalise to a plain array, and only forward exercises with a
    // gifUrl. Clients don't have to deal with paginated/wrapped shapes or
    // entries that wouldn't be usable as a GIF source.
    const rawText = await upstream.text();
    let data;
    try { data = JSON.parse(rawText); }
    catch {
      return json({ error: 'Upstream returned non-JSON', sample: rawText.slice(0, 200) }, 502);
    }

    const arr = extractArray(data);
    const cleaned = arr
      .map((ex) => normalise(ex))
      .filter((ex) => ex && ex.name && ex.gifUrl);

    // Edge-cache aggressively: 7 days fresh, 30 days SWR. Underlying RapidAPI
    // request fires at most once per week per region regardless of traffic.
    return new Response(JSON.stringify(cleaned), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=2592000',
        'Access-Control-Allow-Origin': '*',
        'X-Catalog-Size': String(cleaned.length),
      },
    });
  } catch (err) {
    return json({ error: err?.message || String(err) }, 502);
  }
}

function extractArray(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    for (const key of ['data', 'exercises', 'results', 'items', 'rows']) {
      if (Array.isArray(data[key])) return data[key];
    }
    if (data.id && data.gifUrl) return [data];
  }
  return [];
}

function normalise(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    id: raw.id || raw.exerciseId || raw._id || '',
    name: raw.name || raw.exerciseName || '',
    gifUrl: raw.gifUrl || raw.gif_url || raw.gif || raw.imageUrl || '',
    target: raw.target || raw.targetMuscle || raw.primary_muscle || '',
    bodyPart: raw.bodyPart || raw.body_part || '',
    equipment: raw.equipment || '',
    secondaryMuscles: raw.secondaryMuscles || raw.secondary_muscles || [],
    instructions: raw.instructions || [],
  };
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
