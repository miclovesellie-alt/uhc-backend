const mongoose = require("mongoose");
require("dotenv").config();

const Course = require("./models/Course");
const Question = require("./models/Question");

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected for migration"))
  .catch(err => console.error(err));

async function migrateCourses() {
  try {
    // 1. Get all questions
    const questions = await Question.find();

    // 2. Extract unique course names
    const uniqueCourses = [...new Set(questions.map(q => q.course))];

    console.log("Found courses:", uniqueCourses);

    // 3. Insert into Course collection
    for (let name of uniqueCourses) {

      if (!name) continue;

      const slug = name.toLowerCase().replace(/\s+/g, "-");

      const exists = await Course.findOne({ slug });

      if (!exists) {
        await Course.create({
          name,
          slug
        });

        console.log("Added:", name);
      } else {
        console.log("Skipped (exists):", name);
      }
    }

    console.log("✅ Migration complete");
    process.exit();

  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
}

migrateCourses();