const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    course: {
      type: String,
      required: true,
    },

    question: {
      type: String,
      required: true,
    },

    options: {
      type: [String],
      required: true,
      validate: [
        (arr) => arr.length === 4,
        "Question must have exactly 4 options",
      ],
    },

    answer: {
      type: Number,
      required: true, // index of correct option (0-3)
      min: 0,
      max: 3,
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Question", questionSchema);