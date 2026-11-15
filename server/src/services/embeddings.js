
// Embedding service
// - If OPENAI_API_KEY is set: OpenAI text-embedding-3-small (1536 dims)
// - Otherwise: deterministic local fallback embedding (384 dims)
//   FALLBACK ONLY: token hashing + TF weighting into a fixed vector, L2-normalised.
//   It captures keyword overlap well enough for demos, but it is NOT semantic
//   like a real embedding model. Search quality improves dramatically with a key.
const DIM = 384;
export function hasOpenAI() { return Boolean(process.env.OPENAI_API_KEY); }

function hashToken(token) {
  let h = 2166136261;
  for (let i = 0; i < token.length; i++) { h ^= token.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}
function localEmbedding(text) {
  const vec = new Array(DIM).fill(0);
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) || [];
  const tf = new Map();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  for (const [token, count] of tf) {
    const idx = hashToken(token) % DIM;
    const sign = hashToken(token + '#') % 2 === 0 ? 1 : -1;
    vec[idx] += sign * (1 + Math.log(count));
    // second slot reduces collisions a little
    vec[(idx + 53) % DIM] += 0.3 * count;
  }
  const norm = Math.hypot(...vec) || 1;
  return vec.map(v => v / norm);
}
export async function embedText(text) {
  if (!hasOpenAI()) return localEmbedding(text);
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small', input: text.slice(0, 8000) }),
  });
  if (!res.ok) { console.warn('OpenAI embedding failed, using local fallback'); return localEmbedding(text); }
  const data = await res.json();
  return data.data[0].embedding;
}
export async function embedMany(texts) { const out=[]; for (const t of texts) out.push(await embedText(t)); return out; }
export function cosineSimilarity(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot=0, na=0, nb=0;
  for (let i=0;i<a.length;i++){ dot+=a[i]*b[i]; na+=a[i]*a[i]; nb+=b[i]*b[i]; }
  return dot / ((Math.sqrt(na)||1)*(Math.sqrt(nb)||1));
}
export function embeddingMode() { return hasOpenAI() ? 'openai' : 'local-fallback'; }
