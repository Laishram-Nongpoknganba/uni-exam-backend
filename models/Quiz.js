const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema({
  title: { type: String, required: true },
  totalDurationMinutes: { type: Number, default: 5 }, // e.g., 5 questions = 5 minutes
  questions: [{
    questionText: { type: String, required: true },
    options: [{ type: String, required: true }], // Dynamic array of strings (options A, B, C, D)
    correctAnswer: { type: String, required: true } // Stored as "A", "B", "C", or "D"
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Quiz', quizSchema);