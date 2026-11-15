
import { hasOpenAI } from './embeddings.js';
// Generate an answer from retrieved chunks.
// With a key: gpt-4o-mini grounded ONLY on the chunks, with [Source n] citations.
// Without a key: a good extractive fallback — composes an answer from the
// most relevant sentences in the retrieved chunks, so the demo still works.
export async function generateAnswer(question, sources) {
  if (hasOpenAI()) {
    try {
      const context = sources.map((s,i)=>`[Source ${i+1}] ${s.text}`).join('\n\n');
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method:'POST',
        headers:{'Content-Type':'application/json', Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},
        body: JSON.stringify({
          model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
          temperature: 0.2,
          messages:[
            {role:'system', content:'You are DocMind AI. Answer ONLY from the provided sources. Be concise and helpful. Cite sources inline like [Source 1]. If the sources do not contain the answer, say you could not find it in the document.'},
            {role:'user', content:`Sources:\n${context}\n\nQuestion: ${question}`}
          ]
        })
      });
      if (res.ok) { const d=await res.json(); return { answer: d.choices[0].message.content.trim(), mode:'openai' }; }
    } catch(e){ console.warn('OpenAI chat failed, using extractive fallback', e.message); }
  }
  // Extractive fallback
  const qWords = new Set(question.toLowerCase().match(/[a-z0-9]+/g)||[]);
  const sentences = [];
  for (const s of sources) {
    for (const sent of s.text.split(/(?<=[.!?])\s+/)) {
      const words = sent.toLowerCase().match(/[a-z0-9]+/g)||[];
      const score = words.filter(w=>qWords.has(w)).length;
      if (sent.trim().length>20) sentences.push({sent:sent.trim(), score});
    }
  }
  sentences.sort((a,b)=>b.score-a.score);
  const top = sentences.filter(s=>s.score>0).slice(0,4).map(s=>s.sent);
  const picked = top.length ? top : sources.slice(0,2).map(s=>s.text.slice(0,280));
  return {
    answer: `Based on the document, here's what I found:\n\n${picked.join(' ')}\n\n_(Demo mode: no OpenAI key set, so this is an extractive summary of the most relevant passages — add OPENAI_API_KEY for full AI answers with citations.)_`,
    mode:'extractive-fallback'
  };
}
