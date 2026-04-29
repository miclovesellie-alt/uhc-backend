const mongoose = require("mongoose");
const User = require("../models/User");
require("dotenv").config();

async function makeSuperAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const email = "boafokyei3@gmail.com";
    const user = await User.findOne({ email });

    if (!user) {
      console.log(`User with email ${email} not found. Please register first.`);
    } else {
      user.role = "superadmin";
      await user.save();
      console.log(`User ${email} is now a superadmin.`);
    }

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  } catch (err) {
    console.error("Error:", err);
  }
}

makeSuperAdmin();
