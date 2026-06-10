const express = require('express');
const { z } = require('zod');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/admin');
const validate = require('../middleware/validate');
const Order = require('../models/Order');

const router = express.Router();

router.get('/', auth, async (req, res, next) => {
  try {
    const orders = req.user.isAdmin
      ? await Order.find().sort({ createdAt: -1 })
      : await Order.find({ userId: req.user.id }).sort({ createdAt: -1 });

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
    status: z.enum(['created', 'payment_confirmed', 'processing', 'shipped', 'delivered', 'cancelled']),
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

    order.status = req.validated.body.status;
    order.timeline.push({ status: req.validated.body.status, note: req.validated.body.note });
    await order.save();

    res.json(order);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
