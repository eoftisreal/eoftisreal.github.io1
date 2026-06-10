const mongoose = require('mongoose');

const resetTokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, expires: '1h', default: () => Date.now() },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ResetToken', resetTokenSchema);
