import mongoose from 'mongoose';

/**
 * Connect to MongoDB Atlas cluster using Mongoose
 */
export async function connectDB() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!uri) {
    console.warn('⚠️ [MongoDB] MONGO_URI is not set in environment. Vector search will be offline.');
    return null;
  }

  try {
    const conn = await mongoose.connect(uri);
    console.log(`✅ [MongoDB Atlas] Mongoose connected to host: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('❌ [MongoDB Atlas] Mongoose connection error:', error.message);
    return null;
  }
}

/**
 * Get native database instance from active Mongoose connection
 */
export function getDb() {
  return mongoose.connection?.readyState === 1 ? mongoose.connection.db : null;
}

/**
 * Get raw collection accessor if needed
 */
export function getVectorCollection() {
  const db = getDb();
  if (!db) return null;
  const collectionName = process.env.MONGODB_COLLECTION || 'chunks';
  return db.collection(collectionName);
}

/**
 * Disconnect Mongoose
 */
export async function closeDB() {
  await mongoose.disconnect();
}

export default connectDB;
