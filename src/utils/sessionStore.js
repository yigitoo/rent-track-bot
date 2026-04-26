const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

const Session = mongoose.model('Session', sessionSchema);

function mongoSessionStore() {
  return {
    async get(key) {
      const doc = await Session.findOne({ key });
      return doc?.data;
    },
    async set(key, data) {
      await Session.findOneAndUpdate(
        { key },
        { key, data },
        { upsert: true }
      );
    },
    async delete(key) {
      await Session.deleteOne({ key });
    },
  };
}

module.exports = { mongoSessionStore };
