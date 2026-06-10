const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    artistName: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, index: true },
    brand: { type: String, trim: true, index: true },
    images: [{ type: String }],
    r2ImageKeys: [{ type: String }],
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, min: 0 },
    currency: { type: String, default: 'INR' },
    stock: { type: Number, default: 0, min: 0 },
    tags: [{ type: String }],
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    isCustomizable: { type: Boolean, default: false },
    minDeliveryDays: { type: Number, min: 1 },
    maxDeliveryDays: { type: Number, min: 1 },
  },
  { timestamps: true }
);

productSchema.index({ title: 'text', description: 'text', tags: 'text', artistName: 'text' });

module.exports = mongoose.model('Product', productSchema);
