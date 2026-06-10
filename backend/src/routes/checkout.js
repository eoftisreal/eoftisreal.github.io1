const express = require('express');
const { z } = require('zod');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Coupon = require('../models/Coupon');
const { createRazorpayOrder, verifyRazorpaySignature } = require('../utils/payment');

const router = express.Router();

const checkoutSchema = z.object({
  body: z.object({
    shippingAddress: z.object({
      line1: z.string().min(2),
      line2: z.string().optional(),
      city: z.string().min(2),
      state: z.string().min(2),
      postalCode: z.string().min(3),
      country: z.string().min(2),
    }),
    deliveryMethod: z.enum(['email', 'whatsapp']).optional(),
    promoCode: z.string().optional(),
  }),
  query: z.object({}),
  params: z.object({}),
});

router.post('/create', auth, validate(checkoutSchema), async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id }).populate('items.productId');
    if (!cart || cart.items.length === 0) {
      const err = new Error('Cart is empty');
      err.statusCode = 400;
      throw err;
    }

    const subtotal = cart.items.reduce((sum, item) => sum + item.productId.price * item.quantity, 0);
    let discount = 0;

    if (req.validated.body.promoCode) {
      const coupon = await Coupon.findOne({
        code: req.validated.body.promoCode.toUpperCase(),
        isActive: true
      });

      if (!coupon) {
        const err = new Error('Invalid or expired coupon code');
        err.statusCode = 400;
        throw err;
      }

      if (subtotal < coupon.minOrderValue) {
        const err = new Error(`Minimum order value of ${coupon.minOrderValue} required for this coupon`);
        err.statusCode = 400;
        throw err;
      }

      if (coupon.discountType === 'percentage') {
        discount = subtotal * (coupon.discountValue / 100);
        if (coupon.maxDiscount) {
          discount = Math.min(discount, coupon.maxDiscount);
        }
      } else {
        discount = coupon.discountValue;
      }
    }

    const discountedSubtotal = Math.max(0, subtotal - discount);
    const tax = Number((discountedSubtotal * 0.18).toFixed(2));
    const total = Number((discountedSubtotal + tax).toFixed(2));

    const paymentOrder = await createRazorpayOrder({
      amount: Math.round(total * 100),
      receipt: `ord_${Date.now()}`,
    });

    const items = cart.items.map((item) => ({
      productId: item.productId.id,
      title: item.productId.title,
      quantity: item.quantity,
      unitPrice: item.productId.price,
      customImage: item.customImage
    }));

    const order = await Order.create({
      discount,
      userId: req.user.id,
      items,
      subtotal,
      tax,
      total,
      shippingAddress: req.validated.body.shippingAddress,
      deliveryMethod: req.validated.body.deliveryMethod || 'email',
      promoCode: req.validated.body.promoCode || undefined,
      payment: {
        provider: 'razorpay',
        orderId: paymentOrder.id,
        status: paymentOrder.status || 'created',
      },
      timeline: [{ status: 'created', note: 'Order created and awaiting payment' }],
    });

    res.status(201).json({ order, paymentOrder });
  } catch (error) {
    next(error);
  }
});

const verifySchema = z.object({
  body: z.object({
    orderId: z.string(),
    paymentId: z.string(),
    signature: z.string(),
  }),
  query: z.object({}),
  params: z.object({}),
});


const validateCouponSchema = z.object({
  body: z.object({
    code: z.string()
  })
});

router.post('/validate-coupon', auth, validate(validateCouponSchema), async (req, res, next) => {
  try {
    const { code } = req.validated.body;

    const cart = await Cart.findOne({ userId: req.user.id }).populate('items.productId');
    const subtotal = cart ? cart.items.reduce((sum, item) => sum + item.productId.price * item.quantity, 0) : 0;

    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });

    if (!coupon) {
      return res.status(400).json({ message: 'Invalid or expired coupon code' });
    }

    if (subtotal < coupon.minOrderValue) {
      return res.status(400).json({ message: `Minimum order value of ${coupon.minOrderValue} required` });
    }

    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = subtotal * (coupon.discountValue / 100);
      if (coupon.maxDiscount) {
        discountAmount = Math.min(discountAmount, coupon.maxDiscount);
      }
    } else {
      discountAmount = coupon.discountValue;
    }

    res.json({
      code: coupon.code,
      discountAmount: Number(discountAmount.toFixed(2))
    });
  } catch (error) {
    next(error);
  }
});

router.post('/verify', auth, validate(verifySchema), async (req, res, next) => {
  try {
    const { orderId, paymentId, signature } = req.validated.body;
    const valid = verifyRazorpaySignature({ orderId, paymentId, signature });

    if (!valid) {
      const err = new Error('Payment signature verification failed');
      err.statusCode = 400;
      throw err;
    }

    const order = await Order.findOne({ 'payment.orderId': orderId, userId: req.user.id });
    if (!order) {
      const err = new Error('Order not found');
      err.statusCode = 404;
      throw err;
    }

    order.payment.paymentId = paymentId;
    order.payment.signature = signature;
    order.payment.status = 'captured';
    order.status = 'payment_confirmed';
    order.timeline.push({ status: 'payment_confirmed', note: 'Payment confirmed' });
    await order.save();

    await Cart.findOneAndUpdate({ userId: req.user.id }, { $set: { items: [] } });

    res.json(order);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
