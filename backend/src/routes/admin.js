const express = require('express');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/admin');
const Product = require('../models/Product');
const multer = require('multer');
const Order = require('../models/Order');
const User = require('../models/User');
const Setting = require('../models/Setting');
const OrderStatusHistory = require('../models/OrderStatusHistory');
const { getAdminSettings } = require('../utils/admin');
const { sendOrderConfirmationEmail } = require('../utils/sendEmail');

const router = express.Router();

function masterAdminOnly(req, _res, next) {
  if (req.user?.role !== 'master_admin') {
    const err = new Error('Master Admin access required');
    err.statusCode = 403;
    return next(err);
  }
  return next();
}

router.use(auth, adminOnly);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

router.get('/analytics', async (_req, res, next) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalProducts, totalOrders, revenueData, recentOrders, revenueTimelineRaw] = await Promise.all([
      Product.countDocuments(),
      Order.countDocuments(),
      Order.aggregate([{ $group: { _id: null, revenue: { $sum: '$total' } } }]),
      Order.find().sort({ createdAt: -1 }).limit(10).populate('userId', 'email').select('total status createdAt guestEmail'),
      Order.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            revenue: { $sum: "$total" }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    const revenueTimeline = revenueTimelineRaw.map(item => ({
      date: item._id,
      revenue: item.revenue
    }));

    res.json({
      totalProducts,
      totalOrders,
      totalRevenue: revenueData[0]?.revenue || 0,
      recentOrders,
      revenueTimeline
    });
  } catch (error) {
    next(error);
  }
});

router.get('/settings', masterAdminOnly, async (_req, res, next) => {
  try {
    const staticSettings = getAdminSettings();
    const settingsDocs = await Setting.find({});
    const dynamicSettings = {};
    settingsDocs.forEach(s => {
      dynamicSettings[s.key] = s.value;
    });

    res.json({ ...staticSettings, ...dynamicSettings });
  } catch (error) {
    next(error);
  }
});

router.put('/settings', masterAdminOnly, async (req, res, next) => {
  try {
    const updates = req.body;
    // For each key in body, create or update a Setting document
    for (const [key, value] of Object.entries(updates)) {
      await Setting.findOneAndUpdate(
        { key },
        { key, value },
        { upsert: true, new: true }
      );
    }
    const settingsDocs = await Setting.find({});
    const dynamicSettings = {};
    settingsDocs.forEach(s => {
      dynamicSettings[s.key] = s.value;
    });

    res.json(dynamicSettings);
  } catch (error) {
    next(error);
  }
});


router.get('/users', masterAdminOnly, async (req, res, next) => {
  try {
    const filter = req.query.role ? { role: req.query.role } : {};
    const users = await User.find(filter).select('-password');
    res.json(users);
  } catch (error) {
    next(error);
  }
});

router.delete('/users/:id', masterAdminOnly, async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: 'Cannot delete yourself' });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
});

router.put('/users/:id/role', masterAdminOnly, async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin', 'master_admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { role, isAdmin: role !== 'user' }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    next(error);
  }
});

const { uploadToR2, getObjectUrl, isR2Configured } = require('../utils/r2');

router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    if (!isR2Configured()) {
      return res.status(500).json({ message: 'Storage is not configured on the server. Image upload is disabled.' });
    }

    const key = await uploadToR2(req.file.buffer, req.file.mimetype, req.file.originalname);
    const url = getObjectUrl(key);

    res.json({ key, url });
  } catch (error) {
    next(error);
  }
});

router.post('/orders/:id/approve', async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate('userId', 'email');
    if (!order) {
      const err = new Error('Order not found');
      err.statusCode = 404;
      throw err;
    }

    if (order.status !== 'awaiting_verification') {
      const err = new Error('Order is not awaiting verification');
      err.statusCode = 400;
      throw err;
    }

    const oldStatus = order.status;
    order.status = 'payment_verified';
    order.payment.status = 'captured';
    order.timeline.push({ status: 'payment_verified', note: 'Payment manually verified by admin' });
    await order.save();

    await OrderStatusHistory.create({
      orderId: order._id,
      oldStatus,
      newStatus: 'payment_verified',
      changedBy: req.user.id,
      note: 'Admin approved payment'
    });

    // Send order confirmation email asynchronously
    const targetEmail = order.guestEmail || (order.userId && order.userId.email);
    if (targetEmail) {
      sendOrderConfirmationEmail(order, targetEmail).catch(console.error);
    }

    res.json(order);
  } catch (error) {
    next(error);
  }
});

router.post('/orders/:id/reject', async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      const err = new Error('Order not found');
      err.statusCode = 404;
      throw err;
    }

    if (order.status !== 'awaiting_verification') {
      const err = new Error('Order is not awaiting verification');
      err.statusCode = 400;
      throw err;
    }

    const oldStatus = order.status;
    order.status = 'rejected';
    order.payment.status = 'failed';
    order.timeline.push({ status: 'rejected', note: 'Payment rejected by admin' });
    await order.save();

    await OrderStatusHistory.create({
      orderId: order._id,
      oldStatus,
      newStatus: 'rejected',
      changedBy: req.user.id,
      note: 'Admin rejected payment'
    });

    res.json(order);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
