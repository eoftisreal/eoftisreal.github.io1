const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    image: { type: String },
    r2ImageKey: { type: String }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Category', categorySchema);
