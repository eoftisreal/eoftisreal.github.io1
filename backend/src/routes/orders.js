const express = require('express');
const { z } = require('zod');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/admin');
const validate = require('../middleware/validate');
const Order = require('../models/Order');
const Setting = require('../models/Setting');
const OrderStatusHistory = require('../models/OrderStatusHistory');

const router = express.Router();

router.get('/', auth, async (req, res, next) => {
  try {
    const orders = req.user.isAdmin
      ? await Order.find().populate('userId', 'email').sort({ createdAt: -1 })
      : await Order.find({ userId: req.user.id }).populate('userId', 'email').sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', auth, async (req, res, next) => {
  try {
    const query = req.user.isAdmin ? { _id: req.params.id } : { _id: req.params.id, userId: req.user.id };
    const order = await Order.findOne(query);
    if (!order) {
      const err = new Error('Order not found');
      err.statusCode = 404;
      throw err;
    }
    res.json(order);
  } catch (error) {
    next(error);
  }
});

const trackGuestSchema = z.object({
  body: z.object({}),
  query: z.object({ email: z.string().email() }),
  params: z.object({ id: z.string() }),
});

router.get('/guest/track/:id', validate(trackGuestSchema), async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.validated.params.id, guestEmail: req.validated.query.email });
    if (!order) {
      const err = new Error('Guest order not found');
      err.statusCode = 404;
      throw err;
    }
    res.json(order);
  } catch (error) {
    next(error);
  }
});

const statusSchema = z.object({
  body: z.object({
    status: z.enum([
      'pending_payment',
      'awaiting_verification',
      'payment_verified',
      'rejected',
      'processing',
      'shipped',
      'delivered',
      'cancelled'
    ]),
    note: z.string().optional(),
  }),
  query: z.object({}),
  params: z.object({ id: z.string() }),
});

router.patch('/:id/status', auth, adminOnly, validate(statusSchema), async (req, res, next) => {
  try {
    const order = await Order.findById(req.validated.params.id);
    if (!order) {
      const err = new Error('Order not found');
      err.statusCode = 404;
      throw err;
    }

    const oldStatus = order.status;
    order.status = req.validated.body.status;
    order.timeline.push({ status: req.validated.body.status, note: req.validated.body.note });
    await order.save();

    await OrderStatusHistory.create({
      orderId: order._id,
      oldStatus,
      newStatus: order.status,
      changedBy: req.user.id,
      note: req.validated.body.note
    });

    res.json(order);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/generate-qr', auth, async (req, res, next) => {
  try {
    const query = req.user.isAdmin ? { _id: req.params.id } : { _id: req.params.id, userId: req.user.id };
    const order = await Order.findOne(query);
    if (!order) {
      const err = new Error('Order not found');
      err.statusCode = 404;
      throw err;
    }

    if (order.status !== 'pending_payment') {
      const err = new Error('QR can only be generated for pending payments');
      err.statusCode = 400;
      throw err;
    }

    const settingsDocs = await Setting.find({ key: { $in: ['upiId', 'payeeName', 'qrExpiryMinutes', 'enableUtrSubmission', 'enableScreenshotUpload'] } });
    const settings = settingsDocs.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});

    const upiId = settings.upiId || 'test@upi';
    const payeeName = settings.payeeName || 'Store Name';
    const qrExpiryMinutes = settings.qrExpiryMinutes ? Number(settings.qrExpiryMinutes) : 10;

    order.qrGeneratedAt = new Date();
    await order.save();

    res.json({
      upiId,
      payeeName,
      qrExpiryMinutes,
      qrGeneratedAt: order.qrGeneratedAt,
      enableUtrSubmission: settings.enableUtrSubmission !== false,
      enableScreenshotUpload: settings.enableScreenshotUpload !== false
    });
  } catch (error) {
    next(error);
  }
});

const paymentDoneSchema = z.object({
  body: z.object({
    utr: z.string().optional(),
    screenshotUrl: z.string().optional()
  }),
  query: z.object({}),
  params: z.object({ id: z.string() })
});

router.post('/:id/payment-done', auth, validate(paymentDoneSchema), async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.validated.params.id, userId: req.user.id });
    if (!order) {
      const err = new Error('Order not found');
      err.statusCode = 404;
      throw err;
    }

    if (order.status !== 'pending_payment') {
      const err = new Error('Payment already submitted or invalid state');
      err.statusCode = 400;
      throw err;
    }

    const oldStatus = order.status;
    order.status = 'awaiting_verification';
    if (req.validated.body.utr) order.utr = req.validated.body.utr;
    if (req.validated.body.screenshotUrl) order.screenshotUrl = req.validated.body.screenshotUrl;

    order.timeline.push({ status: 'awaiting_verification', note: 'Customer confirmed payment and awaiting admin verification' });
    await order.save();

    await OrderStatusHistory.create({
      orderId: order._id,
      oldStatus,
      newStatus: 'awaiting_verification',
      changedBy: req.user.id,
      note: 'Payment submitted by customer'
    });

    res.json(order);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
