const mongoose = require('mongoose');

let connectionPromise;
let listenersAttached = false;

async function connectDB() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connectionPromise) return connectionPromise;
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI yapılandırılmamış.');

  if (!listenersAttached) {
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected');
    });
    listenersAttached = true;
  }

  connectionPromise = mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
      console.log('Connected to MongoDB');
      return mongoose.connection;
    })
    .finally(() => {
      connectionPromise = null;
    });

  await connectionPromise;
  return mongoose.connection;
}

module.exports = connectDB;
