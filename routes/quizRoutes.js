const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const { GoogleGenAI } = require('@google/genai');

const Quiz = require('../models/Quiz');

// Initialize the Google Gen AI SDK using your cloud environment variable
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Set up temporary local destination for incoming file streams
const upload = multer({ dest: '/tmp/' });

router.post('/admin/upload-quiz', upload.single('examFile'), async (req, res) => {
  try {
    const { title, duration } = req.body;
    if (!req.file) {
      return res.status(400).json({ error: "Please upload a Word (.docx) or PDF document." });
    }

    let extractedText = "";

    // 1. Parse the text based on the file type mime format
    if (req.file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const result = await mammoth.extractRawText({ path: req.file.path });
      extractedText = result.value;
    } else if (req.file.mimetype === "application/pdf") {
      const dataBuffer = fs.readFileSync(req.file.path);
      const parsedPdf = await pdfParse(dataBuffer);
      extractedText = parsedPdf.text;
    } else {
      fs.unlinkSync(req.file.path); // Clear unhandled file types out of storage
      return res.status(400).json({ error: "Unsupported format. Use Word (.docx) or PDF." });
    }

    // Clean up the temporary uploaded file from the disk right after text extraction
    fs.unlinkSync(req.file.path);

    if (!extractedText.trim()) {
      return res.status(400).json({ error: "Could not extract readable text from the document." });
    }

    // 2. Instruct Gemini 1.5 Flash to convert the text into clean structured JSON output
    const systemPrompt = `You are an expert academic exam parsing engine. Analyze the raw text provided and extract every multiple-choice question.
Format the final response strictly as a JSON array of objects matching this exact validation schema:
[
  {
    "questionText": "Clear question string content",
    "options": ["Option A string value", "Option B string value", "Option C string value", "Option D string value"],
    "correctAnswer": "Single letter representing the correct index: A, B, C, or D"
  }
]
Do not add any decorative formatting strings, extra prose comments, markdown tags, or backticks around the JSON. Your response must be pure JSON text.`;

    const aiResponse = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [
        { role: 'user', parts: [{ text: `${systemPrompt}\n\nRaw Exam Document Text:\n${extractedText}` }] }
      ]
    });

    let cleanedText = aiResponse.text.trim();
    
    // Safety check: Remove accidental markdown string envelopes if they leak through
    if (cleanedText.startsWith("```json")) cleanedText = cleanedText.substring(7);
    if (cleanedText.startsWith("```")) cleanedText = cleanedText.substring(3);
    if (cleanedText.endsWith("```")) cleanedText = cleanedText.substring(0, cleanedText.length - 3);
    cleanedText = cleanedText.trim();

    const parsedQuestions = JSON.parse(cleanedText);

    // 3. Save the clean quiz structure straight to MongoDB Atlas
    const newQuiz = new Quiz({
      title: title || "Untitled Synchronized Live Exam",
      totalDurationMinutes: parseInt(duration, 10) || parsedQuestions.length, // Defaults to 1 min per question
      questions: parsedQuestions
    });

    await newQuiz.save();

    return res.status(201).json({
      success: true,
      message: "Quiz processed and saved live inside the cloud database!",
      quizId: newQuiz._id,
      questionCount: parsedQuestions.length
    });

  } catch (error) {
    console.error("AI Parser Route Failure:", error);
    return res.status(500).json({ error: "Failed to cleanly interpret document data using Gemini." });
  }
});

module.exports = router;