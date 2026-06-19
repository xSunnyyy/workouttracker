// Vercel Edge function — proxies the ExerciseDB catalog from RapidAPI.
// The client never sees the API key. Aggressive edge caching means
// the underlying request hits RapidAPI at most once per cache window
// regardless of how many users open the app.

export const config = { runtime: 'edge' };

const UPSTREAM = 'https://exercisedb.p.rapidapi.com/exercises?limit=2000';
const HOST = 'exercisedb.p.rapidapi.com';

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

    // Pass the JSON through. Aggressively cache at the edge: 7 days fresh,
    // 30 days stale-while-revalidate. Exercise libraries don't change often,
    // so this keeps RapidAPI requests at <1 per week per region.
    const body = await upstream.text();
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=2592000',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return json({ error: err?.message || String(err) }, 502);
  }
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
