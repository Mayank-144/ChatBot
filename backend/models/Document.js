import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    fileType: {
      type: String,
      trim: true,
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    totalChunks: {
      type: Number,
      default: 0,
    },
    sessionId: {
      type: String,
      default: 'default',
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'indexed', 'failed'],
      default: 'indexed',
    },
  },
  {
    timestamps: true,
  }
);

export const Document = mongoose.models.Document || mongoose.model('Document', documentSchema);
export default Document;
