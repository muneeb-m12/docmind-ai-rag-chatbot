
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import documentsRouter from './routes/documents.js';
import chatRouter from './routes/chat.js';
import { initStore, storeMode } from './services/store.js';
import { embeddingMode } from './services/embeddings.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({ limit:'1mb' }));

app.get('/api/health', (req,res)=> res.json({ status:'ok', service:'DocMind AI', store: storeMode(), embeddingMode: embeddingMode(), openaiConfigured: Boolean(process.env.OPENAI_API_KEY), mongoConfigured: Boolean(process.env.MONGODB_URI), timestamp: new Date().toISOString() }));
app.use('/api/documents', documentsRouter);
app.use('/api/chat', chatRouter);
app.use((err,req,res,next)=>{ console.error(err); res.status(err.status||500).json({error: err.message||'Internal server error'}); });

const PORT = process.env.PORT || 5000;
await initStore();
app.listen(PORT, ()=> console.log(`DocMind AI server running on http://localhost:${PORT} (store=${storeMode()}, embeddings=${embeddingMode()})`));
export default app;
