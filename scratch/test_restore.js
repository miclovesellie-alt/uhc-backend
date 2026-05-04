require("dotenv").config({ path: __dirname + '/../.env' });
const mongoose = require("mongoose");
const DeletedItem = require("../models/DeletedItem");
const Question = require("../models/Question");
const Book = require("../models/Book");
const FeedItem = require("../models/FeedItem");

async function testRestore() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected");
  const item = await DeletedItem.findOne();
  if (!item) {
    console.log("No deleted items");
    process.exit(0);
  }
  console.log("Found item:", item.type, item.data._id);
  try {
    if (item.type === "Question") {
      await Question.create(item.data);
    } else if (item.type === "Book") {
      await Book.create(item.data);
    } else if (item.type === "Feed") {
      await FeedItem.create(item.data);
    }
    console.log("Restore success!");
  } catch (err) {
    console.error("Restore failed:", err);
  }
  process.exit(0);
}

testRestore();
