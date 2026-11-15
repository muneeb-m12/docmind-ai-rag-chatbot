import { useEffect, useRef, useState } from 'react';
import { api } from './api';

const SUGGESTED = [
  'How many vacation days do employees get?',
  'What is the remote work policy?',
  'How many sick days are allowed and what is required?',
  'What is the probation period and notice period?',
  'How much is the health insurance cover?',
];

export default function App() {
  const [docs, setDocs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi, I\'m DocMind. Upload a PDF or text document on the left, then ask me anything about it — I\'ll answer from the document and show my sources.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [offline, setOffline] = useState(false);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const endRef = useRef(null);

  async function refresh() {
    try {
      const h = await api.health(); setHealth(h); setOffline(false);
      const d = await api.listDocuments(); setDocs(d.documents || []);
    } catch { setOffline(true); }
  }
  useEffect(() => { refresh(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  async function handleFiles(files) {
    const file = files?.[0]; if (!file) return;
    setUploading(true); setError('');
    try {
      const res = await api.upload(file);
      await refresh(); setSelected(res.document);
    } catch (e) { setError(e.message); } finally { setUploading(false); }
  }

  async function openDoc(doc) {
    setSelected(doc); setError('');
    try { const d = await api.getDocument(doc._id || doc.id); setDetail(d); }
    catch (e) { setError(e.message); setDetail(null); }
  }

  async function removeDoc(id, e) {
    e.stopPropagation();
    try { await api.deleteDocument(id); if (selected && (selected._id === id || selected.id === id)) { setSelected(null); setDetail(null); } await refresh(); }
    catch (err) { setError(err.message); }
  }

  async function ask(q) {
    const question = (q ?? input).trim(); if (!question || loading) return;
    if (!docs.length) { setError('Upload a document first — try samples/employee-handbook.txt from the repo.'); return; }
    setInput(''); setError('');
    setMessages((m) => [...m, { role: 'user', text: question }]);
    setLoading(true);
    try {
      const res = await api.chat(question, selected ? String(selected._id || selected.id) : undefined);
      setMessages((m) => [...m, { role: 'assistant', text: res.answer, sources: res.sources, mode: res.mode }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', text: `Sorry — ${e.message}` }]);
    } finally { setLoading(false); }
  }

  return (
    <div className="app">
      <header>
        <div className="logo">🧠 DocMind <span>AI</span></div>
        <div className="tag">RAG Chatbot · MERN + OpenAI · Chat with your documents</div>
        <div className="badges">
          {health && <span className="badge">Store: {health.store}</span>}
          {health && <span className="badge">Embeddings: {health.embeddingMode}</span>}
          {health && <span className="badge">{health.openaiConfigured ? 'OpenAI: on' : 'Demo mode (no key)'}</span>}
        </div>
      </header>

      {offline && <div className="banner">⚠️ Server unreachable at the API URL. Start it with <code>npm run dev</code> in <code>server/</code> (http://localhost:5000), then refresh. No data is faked while offline.</div>}
      {error && <div className="banner error">{error}</div>}

      <main>
        <aside>
          <div
            className={`drop ${drag ? 'drag' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => fileRef.current?.click()}
          >
            <strong>{uploading ? 'Processing… chunking + embedding' : '⬆️ Upload document'}</strong>
            <span>Drag & drop or click · PDF, TXT, MD · max 10 MB</span>
            <input ref={fileRef} type="file" accept=".pdf,.txt,.md,text/plain,application/pdf" hidden onChange={(e) => handleFiles(e.target.files)} />
          </div>

          <h3>Your documents ({docs.length})</h3>
          <div className="doclist">
            {docs.length === 0 && <p className="muted">No documents yet. Upload the sample handbook to try it in 10 seconds.</p>}
            {docs.map((d) => {
              const id = d._id || d.id; const active = selected && (selected._id === id || selected.id === id);
              return (
                <div key={id} className={`doc ${active ? 'active' : ''}`} onClick={() => openDoc(d)}>
                  <div><strong>{d.originalName}</strong><small>{d.chunkCount} chunks · {d.charCount} chars · {d.status}</small></div>
                  <button onClick={(e) => removeDoc(id, e)} title="Delete">🗑</button>
                </div>
              );
            })}
          </div>

          {detail && (
            <div className="detail">
              <h4>Chunks — {detail.document.originalName}</h4>
              <p className="muted">{detail.chunks.length} chunks · first previews:</p>
              {detail.chunks.slice(0, 5).map((c) => (
                <div key={c.index} className="chunk"><b>#{c.index + 1}</b> {c.preview}…</div>
              ))}
            </div>
          )}

          <div className="how">
            <h4>How RAG works here</h4>
            <ol><li>Upload → extract text</li><li>Chunk (800 chars, 150 overlap)</li><li>Embed each chunk</li><li>Store vectors in MongoDB</li><li>Retrieve top 4 by cosine similarity</li><li>AI answers with citations</li></ol>
          </div>
        </aside>

        <section className="chat">
          <div className="messages">
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                <div className="bubble">{m.text}</div>
                {m.sources && (
                  <div className="sources">
                    <small>Sources · mode: {m.mode}</small>
                    {m.sources.map((s) => (
                      <div key={s.rank} className="source"><b>[Source {s.rank}] · {s.relevance}% relevant · chunk #{s.chunkIndex + 1}</b><span>{s.text.slice(0, 260)}…</span></div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && <div className="msg assistant"><div className="bubble pulse">Searching document, retrieving chunks and generating answer…</div></div>}
            <div ref={endRef} />
          </div>

          <div className="suggested">
            {SUGGESTED.map((s) => <button key={s} onClick={() => ask(s)}>{s}</button>)}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); ask(); }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={docs.length ? 'Ask anything about your document…' : 'Upload a document first…'} />
            <button type="submit" disabled={loading}>Send</button>
          </form>
        </section>
      </main>
      <footer>Built by Muneeb Ahmed · React + Node.js / Express + MongoDB + OpenAI · Portfolio demo — answers are grounded only in uploaded documents.</footer>
    </div>
  );
}
