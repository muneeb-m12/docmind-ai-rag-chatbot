
import mongoose from 'mongoose';
const docSchema = new mongoose.Schema({
  originalName: { type: String, required: true },
  mimeType: String,
  size: Number,
  charCount: Number,
  chunkCount: { type: Number, default: 0 },
  status: { type: String, enum: ['processing','ready','error'], default: 'processing' },
  error: String,
}, { timestamps: true });
export default mongoose.models.Document || mongoose.model('Document', docSchema);
