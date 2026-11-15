
// Split text into overlapping chunks. Chunk size / overlap are the classic
// RAG trade-off: large enough to keep context, small enough to retrieve precisely.
export function chunkText(text, chunkSize = 800, overlap = 150) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const chunks = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + chunkSize, clean.length);
    // Try to end on a sentence / word boundary when not at the end
    if (end < clean.length) {
      const slice = clean.slice(start, end);
      const lastSentence = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('\n'));
      if (lastSentence > chunkSize * 0.5) end = start + lastSentence + 1;
      else { const sp = slice.lastIndexOf(' '); if (sp > 0) end = start + sp; }
    }
    const piece = clean.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}
