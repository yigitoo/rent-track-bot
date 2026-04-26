const mongoose = require('mongoose');

async function connectDB() {
  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected');
  });

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
}

module.exports = connectDB;
