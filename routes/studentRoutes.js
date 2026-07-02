const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const Counter = require('../models/Counter');
const RegistrationCode = require('../models/RegistrationCode'); // Verifies admin code

router.post('/student/signup', async (req, res) => {
  try {
    const { signupCode, name, phoneNumber, address, fathersName, identityCardNumber, studentClass } = req.body;

    // 1. Validate the 8-character Admin verification signup code first
    const codeRecord = await RegistrationCode.findOne({ code: signupCode, isUsed: false });
    if (!codeRecord) {
      return res.status(400).json({ success: false, error: "Invalid or already expired admin registration code." });
    }

    // 2. Fetch the current calendar year format (e.g., 2026 -> "26")
    const currentFullYear = new Date().getFullYear(); 
    const shortYearString = String(currentFullYear).slice(-2); // Returns "26"

    // 3. Atomically increment the sequence value for the current year in MongoDB
    // findOneAndUpdate is atomic, protecting against duplicate IDs from simultaneous signups
    const counterRecord = await Counter.findOneAndUpdate(
      { year: currentFullYear },
      { $inc: { seq: 1 } },
      { new: true, upsert: true } // Creates the document if it doesn't exist yet for the year
    );

    // 4. Convert the sequential number into a 4-digit padded string (e.g., 1 -> "0001", 12 -> "0012")
    const paddedSequence = String(counterRecord.seq).padStart(4, '0');

    // 5. Combine strings into the final institutional roll number format
    const generatedRollNumber = `UNI${shortYearString}${paddedSequence}`; // Result: "UNI260001"

    // 6. Instantiate and save the new authenticated student record
    const newStudent = new Student({
      rollNumber: generatedRollNumber,
      name,
      phoneNumber,
      address,
      fathersName,
      identityCardNumber,
      studentClass
    });

    await newStudent.save();

    // 7. Burn the single-use admin verification registration code so it cannot be reused
    codeRecord.isUsed = true;
    await codeRecord.save();

    // Return the generated roll number to the user's Vercel frontend interface screen
    return res.status(201).json({
      success: true,
      message: "Student profile registered successfully!",
      rollNumber: generatedRollNumber
    });

  } catch (error) {
    console.error("ID Generation/Signup Error:", error);
    return res.status(500).json({ success: false, error: "Internal server error generating registration metrics." });
  }
});

module.exports = router;