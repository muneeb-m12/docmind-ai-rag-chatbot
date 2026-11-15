
import { Router } from 'express';
import { embedText, cosineSimilarity, embeddingMode } from '../services/embeddings.js';
import { generateAnswer } from '../services/llm.js';
import * as store from '../services/store.js';
const router = Router();
router.post('/', async (req,res,next)=>{
  try{
    const { question, documentId } = req.body||{};
    if (!question?.trim()) return res.status(400).json({error:'question is required'});
    const chunks = await store.getAllChunksForSearch(documentId||null);
    if (!chunks.length) return res.status(400).json({error:'No documents yet. Upload a document first.'});
    const qEmb = await embedText(question);
    // If embeddings came from different modes/dims, cosine returns 0 — filter handles it.
    const scored = chunks.map(c=>({...c, score: cosineSimilarity(qEmb, c.embedding||[])})).sort((a,b)=>b.score-a.score).slice(0,4);
    const sources = scored.map((c,i)=>({ rank:i+1, documentId:String(c.document), chunkIndex:c.index, text:c.text, relevance: Math.max(0, Math.round(c.score*100)) }));
    const { answer, mode } = await generateAnswer(question, sources);
    res.json({ answer, mode, embeddingMode: embeddingMode(), sources });
  }catch(e){ next(e); }
});
export default router;
