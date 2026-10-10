import { MongoClient } from 'mongodb';

let client = null;
let db = null;

const DB_NAME = process.env.MONGODB_DB_NAME || 'chatbot_rag';
const COLLECTION_NAME = process.env.MONGODB_COLLECTION || 'document_vectors';

/**
 * Connect to MongoDB Atlas cluster
 */
export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('⚠️ [MongoDB] MONGODB_URI is not set in environment. Vector search will be offline.');
    return null;
  }

  try {
    if (!client) {
      client = new MongoClient(uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
      });
      await client.connect();
      db = client.db(DB_NAME);
      console.log(`✅ [MongoDB Atlas] Connected successfully to database: "${DB_NAME}"`);
    }
    return db;
  } catch (error) {
    console.error('❌ [MongoDB Atlas] Connection failed:', error.message);
    return null;
  }
}

/**
 * Get active MongoDB database instance
 */
export function getDb() {
  return db;
}

/**
 * Get document vectors collection
 */
export function getVectorCollection() {
  if (!db) return null;
  return db.collection(COLLECTION_NAME);
}

/**
 * Close MongoDB connection
 */
export async function closeDB() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
