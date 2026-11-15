
import { Router } from 'express';
import multer from 'multer';
import { PDFParse } from 'pdf-parse';
import { chunkText } from '../services/chunking.js';
import { embedMany } from '../services/embeddings.js';
import * as store from '../services/store.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits:{ fileSize: 10*1024*1024 } });

async function extractText(file) {
  const name = file.originalname.toLowerCase();
  if (name.endsWith('.pdf') || file.mimetype === 'application/pdf') {
    // pdf-parse v2 API (v1's bundled pdf.js throws "bad XRef entry" on modern PDFs/Node)
    const parser = new PDFParse({ data: file.buffer });
    try { const data = await parser.getText(); return data.text || ''; }
    finally { await parser.destroy().catch(() => {}); }
  }
  if (name.endsWith('.txt') || name.endsWith('.md') || file.mimetype.startsWith('text/')) return file.buffer.toString('utf-8');
  throw new Error('Unsupported file type. Upload a PDF, TXT or MD file.');
}

router.post('/', upload.single('file'), async (req,res,next)=>{
  try {
    if (!req.file) return res.status(400).json({error:'No file uploaded. Use form field "file".'});
    let doc = await store.createDocument({ originalName:req.file.originalname, mimeType:req.file.mimetype, size:req.file.size, status:'processing', chunkCount:0, charCount:0 });
    const id = String(doc._id || doc.id);
    try {
      const text = await extractText(req.file);
      if (!text.trim()) throw new Error('No text could be extracted from this file.');
      const pieces = chunkText(text);
      const embeddings = await embedMany(pieces);
      await store.createChunks(id, pieces.map((t,i)=>({text:t, index:i, embedding:embeddings[i]})));
      doc = await store.updateDocument(id, { status:'ready', charCount:text.length, chunkCount:pieces.length });
      res.status(201).json({ document: serialize(doc), chunks: pieces.length });
    } catch(e) { await store.updateDocument(id, {status:'error', error:e.message}); throw e; }
  } catch(e){ next(e); }
});
function serialize(d){ if(!d) return d; return {...d, _id:String(d._id||d.id), id:String(d._id||d.id)}; }
router.get('/', async (req,res,next)=>{ try{ const docs=await store.listDocuments(); res.json({documents: docs.map(serialize)}); }catch(e){next(e);} });
router.get('/:id', async (req,res,next)=>{ try{ const doc=await store.getDocument(req.params.id); if(!doc) return res.status(404).json({error:'Document not found'}); const chunks=await store.getChunks(req.params.id); res.json({document:serialize(doc), chunks: chunks.map(c=>({index:c.index, text:c.text, preview:c.text.slice(0,240)}))}); }catch(e){next(e);} });
router.delete('/:id', async (req,res,next)=>{ try{ const ok=await store.deleteDocument(req.params.id); if(!ok) return res.status(404).json({error:'Document not found'}); res.json({deleted:true}); }catch(e){next(e);} });
export default router;
