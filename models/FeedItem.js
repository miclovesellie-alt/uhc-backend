const mongoose = require("mongoose");

const feedItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    image: { type: String },
    author: { type: String, default: "Admin" },
    category: { type: String, default: "Health" },
    likes: { type: Number, default: 0 },
    likedBy: [{ type: String }],
    status: { type: String, default: "approved", enum: ["pending", "approved", "rejected"] },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    rejectReason: { type: String, default: "" },
    comments: [
      {
        userId: String,
        name: String,
        text: String,
        createdAt: { type: Date, default: Date.now },
        replies: [{
          userId: String,
          name: String,
          text: String,
          createdAt: { type: Date, default: Date.now }
        }]
      }
    ]  ,
    flagCount: { type: Number, default: 0 },
    flaggedBy: [{ type: String }]
  },
  { timestamps: true }
);

module.exports = mongoose.model("FeedItem", feedItemSchema);
