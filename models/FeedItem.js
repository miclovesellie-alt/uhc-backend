const mongoose = require("mongoose");

const feedItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    image: { type: String }, // URL or path
    author: { type: String, default: "Admin" },
    category: { type: String, default: "Health" },
    likes: { type: Number, default: 0 },
    comments: [
      {
        name: String,
        text: String,
        createdAt: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model("FeedItem", feedItemSchema);
