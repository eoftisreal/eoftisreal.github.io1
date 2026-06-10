const mongoose = require('mongoose');

const timelineSchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    note: { type: String },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    title: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    customImage: { type: String },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    guestEmail: { type: String, lowercase: true },
    items: [orderItemSchema],
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    tax: { type: Number, required: true },
    total: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    promoCode: { type: String },
    shippingAddress: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
    deliveryMethod: { type: String, enum: ['email', 'whatsapp'], default: 'email' },
    payment: {
      provider: { type: String, default: 'razorpay' },
      orderId: String,
      paymentId: String,
      signature: String,
      status: { type: String, default: 'created' },
    },
    status: {
      type: String,
      enum: ['created', 'payment_confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'created',
      index: true,
    },
    timeline: [timelineSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
