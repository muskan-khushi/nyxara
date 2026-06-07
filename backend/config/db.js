// config/db.js
const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/nyxara";
  let retries = 5;
  while (retries) {
    try {
      await mongoose.connect(uri);
      console.log("✅ MongoDB connected");
      return;
    } catch (err) {
      retries--;
      console.error(`MongoDB connection failed. Retries left: ${retries}`);
      if (!retries) throw err;
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

module.exports = { connectDB };