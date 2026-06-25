// Vercel function — sends a food photo or nutrition label image to
// Google Gemini Vision and parses macros out of the response. Free tier
// is generous (1500 requests/day on gemini-1.5-flash at time of writing).
//
// Setup: add GEMINI_API_KEY env var in Vercel (get a key from
// https://aistudio.google.com/app/apikey — free, no card required).

export const config = { runtime: 'edge' };

const MODEL = 'gemini-1.5-flash-latest';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const PROMPT = `You are analysing a photo a user took for nutrition tracking.

If it's a nutrition label, read the values directly from the label.
If it's prepared food, identify the dish and estimate macros for the visible portion.
If you cannot tell what it is or there's no food, set confidence to "low".

Respond with ONLY valid JSON in this exact shape (no markdown, no commentary):
{
  "name": "short food name",
  "isLabel": false,
  "servingDescription": "e.g. '1 cup', '100g', '1 slice'",
  "servingGrams": 100,
  "calories": 0,
  "protein": 0,
  "carbs": 0,
  "fat": 0,
  "fiber": 0,
  "confidence": "high"
}

Numbers must be in grams (or kcal for calories). If unknown, use 0.
servingGrams is the weight in grams the other numbers correspond to.
confidence: "high" if certain, "medium" if reasonable estimate, "low" if guessing.`;

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json({
      error: 'Server is missing GEMINI_API_KEY. Get a free key at https://aistudio.google.com/app/apikey and add it in Vercel → Settings → Environment Variables.',
    }, 500);
  }

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid JSON body' }, 400); }

  const { imageBase64, mimeType = 'image/jpeg' } = body || {};
  if (!imageBase64) return json({ error: 'Missing imageBase64 field' }, 400);

  // Strip data: prefix if present
  const stripped = String(imageBase64).replace(/^data:[^;]+;base64,/, '');

  const upstream = `${ENDPOINT}?key=${encodeURIComponent(apiKey)}`;
  const payload = {
    contents: [{
      parts: [
        { text: PROMPT },
        { inline_data: { mime_type: mimeType, data: stripped } },
      ],
    }],
    generationConfig: {
      response_mime_type: 'application/json',
      temperature: 0.2,
    },
  };

  try {
    const res = await fetch(upstream, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return json({ error: `Gemini ${res.status}`, detail: text.slice(0, 400) }, 502);
    }
    const data = await res.json();
    const textOut = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    let parsed;
    try { parsed = JSON.parse(textOut); }
    catch {
      return json({
        error: 'Gemini returned non-JSON',
        raw: textOut.slice(0, 400),
      }, 502);
    }

    // Normalise field names + types
    const out = {
      name: String(parsed.name || 'Unknown food'),
      isLabel: !!parsed.isLabel,
      servingDescription: String(parsed.servingDescription || ''),
      servingGrams: numOr(parsed.servingGrams, 100),
      calories: numOr(parsed.calories, 0),
      proteinG: numOr(parsed.protein ?? parsed.proteinG, 0),
      carbsG:   numOr(parsed.carbs   ?? parsed.carbsG,   0),
      fatG:     numOr(parsed.fat     ?? parsed.fatG,     0),
      fiberG:   numOr(parsed.fiber   ?? parsed.fiberG,   0),
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'medium',
    };
    return json({ result: out }, 200);
  } catch (err) {
    return json({ error: err?.message || String(err) }, 502);
  }
}

function numOr(v, d) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.round(n * 10) / 10) : d;
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
