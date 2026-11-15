
// Store abstraction: MongoDB (Mongoose) when MONGODB_URI is set, otherwise
// an in-memory store so `npm run dev` works with zero config for demos.
// Both backends expose the same functions used by the routes.
import mongoose from 'mongoose';
import DocumentModel from '../models/Document.js';
import ChunkModel from '../models/Chunk.js';

let useMongo = false;
export async function initStore() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.log('[store] No MONGODB_URI — using in-memory store'); return; }
  try { await mongoose.connect(uri, { serverSelectionTimeoutMS: 4000 }); useMongo = true; console.log('[store] Connected to MongoDB'); }
  catch(e){ console.warn('[store] MongoDB connect failed, falling back to memory:', e.message); }
}
export const storeMode = () => useMongo ? 'mongodb' : 'memory';

// --- in-memory ---
const memDocs = new Map(); const memChunks = new Map(); let memId = 1;
const newId = () => String(memId++).padStart(24,'0');

export async function createDocument(meta) {
  if (useMongo) { const d = await DocumentModel.create(meta); return d.toObject(); }
  const doc = { _id:newId(), id:null, ...meta, createdAt:new Date(), updatedAt:new Date() }; doc.id=doc._id; memDocs.set(doc._id, doc); memChunks.set(doc._id, []); return doc;
}
export async function updateDocument(id, patch) {
  if (useMongo) return DocumentModel.findByIdAndUpdate(id, patch, {new:true}).lean();
  const d = memDocs.get(String(id)); if(!d) return null; Object.assign(d, patch); return d;
}
export async function listDocuments() {
  if (useMongo) return DocumentModel.find().sort({createdAt:-1}).lean();
  return [...memDocs.values()].sort((a,b)=>b.createdAt-a.createdAt);
}
export async function getDocument(id) {
  if (useMongo) { try{ return await DocumentModel.findById(id).lean(); }catch{ return null; } }
  return memDocs.get(String(id)) || null;
}
export async function deleteDocument(id) {
  if (useMongo) { try{ await DocumentModel.findByIdAndDelete(id); await ChunkModel.deleteMany({document:id}); return true; }catch{ return false; } }
  const ok = memDocs.delete(String(id)); memChunks.delete(String(id)); return ok;
}
export async function createChunks(documentId, chunks) {
  // chunks: [{text,index,embedding}]
  if (useMongo) { await ChunkModel.insertMany(chunks.map(c=>({...c, document:documentId}))); return; }
  memChunks.set(String(documentId), chunks.map((c,i)=>({_id:`${documentId}-${i}`, document:String(documentId), ...c})));
}
export async function getChunks(documentId) {
  if (useMongo) { try{ return await ChunkModel.find({document:documentId}).sort({index:1}).lean(); }catch{ return []; } }
  return (memChunks.get(String(documentId))||[]).slice().sort((a,b)=>a.index-b.index);
}
export async function getAllChunksForSearch(documentId) {
  if (documentId) return getChunks(documentId);
  if (useMongo) return ChunkModel.find().lean();
  return [...memChunks.values()].flat();
}
