const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  year: { type: Number, required: true, unique: true },
  seq: { type: Number, default: 0 }
});

module.exports = mongoose.model('Counter', counterSchema);