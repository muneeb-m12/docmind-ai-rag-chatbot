
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
async function req(path, opts={}) {
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
export const api = {
  health: () => req('/api/health'),
  listDocuments: () => req('/api/documents'),
  getDocument: (id) => req(`/api/documents/${id}`),
  deleteDocument: (id) => req(`/api/documents/${id}`, {method:'DELETE'}),
  upload: (file) => { const fd=new FormData(); fd.append('file', file); return req('/api/documents', {method:'POST', body:fd}); },
  chat: (question, documentId) => req('/api/chat', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({question, documentId})}),
};
export { BASE };
