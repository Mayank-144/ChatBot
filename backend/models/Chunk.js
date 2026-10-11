import mongoose from 'mongoose';

const chunkSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
      index: true,
    },
    text: {
      type: String,
      required: true,
    },
    // Cohere embed-multilingual-v3.0 produces 1024-dimensional dense vectors
    embedding: {
      type: [Number],
      required: true,
      validate: {
        validator: function (val) {
          return Array.isArray(val) && val.length === 1024;
        },
        message: 'Embedding must have exactly 1024 dimensions for Cohere embed-multilingual-v3.0.',
      },
    },
    pageNumber: {
      type: Number,
      default: null,
    },
    sheetName: {
      type: String,
      default: null,
    },
    chunkIndex: {
      type: Number,
      default: 0,
    },
    sessionId: {
      type: String,
      default: 'default',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Chunk = mongoose.models.Chunk || mongoose.model('Chunk', chunkSchema);
export default Chunk;
