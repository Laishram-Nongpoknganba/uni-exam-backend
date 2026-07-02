const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const Student = require('../models/Student');
const Admin = require('../models/Admin');

// Secure Token Generator Helper
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'SUPER_SECRET_KEY_CHANGEME', {
    expiresIn: '1d' // Token expires after 24 hours
  });
};

// ----------------------------------------------------
// 👤 STUDENT LOGIN DASHBOARD ROUTE
// ----------------------------------------------------
router.post('/auth/student-login', async (req, res) => {
  try {
    const { rollNumber, phoneNumber } = req.body; // Logs in using their generated UNI26XXXX ID

    // Find the student matching the exact roll number
    const student = await Student.findOne({ rollNumber: rollNumber.trim().toUpperCase() });
    if (!student) {
      return res.status(404).json({ success: false, error: "Roll number not found." });
    }

    // Double check with their registered phone number for security
    if (student.phoneNumber !== phoneNumber.trim()) {
      return res.status(401).json({ success: false, error: "Invalid login credentials." });
    }

    const token = generateToken(student._id, 'student');

    return res.status(200).json({
      success: true,
      message: "Student dashboard accessed!",
      token,
      student: {
        name: student.name,
        rollNumber: student.rollNumber,
        studentClass: student.studentClass
      }
    });
  } catch (error) {
    console.error("Student Auth Error:", error);
    return res.status(500).json({ success: false, error: "Internal server authentication failure." });
  }
});

// ----------------------------------------------------
// 🔑 ADMIN LOGIN DASHBOARD ROUTE
// ----------------------------------------------------
router.post('/auth/admin-login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const admin = await Admin.findOne({ username: username.toLowerCase().trim() });
    if (!admin) {
      return res.status(401).json({ success: false, error: "Invalid admin credentials." });
    }

    // Compare encrypted hash passwords
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: "Invalid admin credentials." });
    }

    const token = generateToken(admin._id, 'admin');

    return res.status(200).json({
      success: true,
      message: "Admin terminal dashboard unlocked!",
      token
    });
  } catch (error) {
    console.error("Admin Auth Error:", error);
    return res.status(500).json({ success: false, error: "Internal server auth failure." });
  }
});

module.exports = router;