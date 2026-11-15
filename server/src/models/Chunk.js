
import mongoose from 'mongoose';
const chunkSchema = new mongoose.Schema({
  document: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
  text: { type: String, required: true },
  index: { type: Number, required: true },
  embedding: { type: [Number], default: [] },
}, { timestamps: true });
export default mongoose.models.Chunk || mongoose.model('Chunk', chunkSchema);
