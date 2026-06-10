const express = require('express');
const { z } = require('zod');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/admin');
const validate = require('../middleware/validate');
const Category = require('../models/Category');
const Brand = require('../models/Brand');
const Coupon = require('../models/Coupon');

const router = express.Router();

router.use(auth, adminOnly);

// --- CATEGORIES ---

router.get('/categories', async (req, res, next) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

const categorySchema = z.object({
  body: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
    image: z.string().url().optional().or(z.literal('')),
    r2ImageKey: z.string().optional().or(z.literal(''))
  })
});

router.post('/categories', validate(categorySchema), async (req, res, next) => {
  try {
    const category = await Category.create(req.validated.body);
    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
});

router.put('/categories/:id', validate(categorySchema), async (req, res, next) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.validated.body, { new: true });
    if (!category) return res.status(404).json({ message: 'Category not found' });
    res.json(category);
  } catch (error) {
    next(error);
  }
});

router.delete('/categories/:id', async (req, res, next) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found' });
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// --- BRANDS ---

router.get('/brands', async (req, res, next) => {
  try {
    const brands = await Brand.find().sort({ createdAt: -1 });
    res.json(brands);
  } catch (error) {
    next(error);
  }
});

const brandSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    isActive: z.boolean().optional()
  })
});

router.post('/brands', validate(brandSchema), async (req, res, next) => {
  try {
    const brand = await Brand.create(req.validated.body);
    res.status(201).json(brand);
  } catch (error) {
    next(error);
  }
});

router.put('/brands/:id', validate(brandSchema), async (req, res, next) => {
  try {
    const brand = await Brand.findByIdAndUpdate(req.params.id, req.validated.body, { new: true });
    if (!brand) return res.status(404).json({ message: 'Brand not found' });
    res.json(brand);
  } catch (error) {
    next(error);
  }
});

router.delete('/brands/:id', async (req, res, next) => {
  try {
    const brand = await Brand.findByIdAndDelete(req.params.id);
    if (!brand) return res.status(404).json({ message: 'Brand not found' });
    res.json({ message: 'Brand deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// --- COUPONS ---

router.get('/coupons', async (req, res, next) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json(coupons);
  } catch (error) {
    next(error);
  }
});

const couponSchema = z.object({
  body: z.object({
    code: z.string().min(1),
    discountType: z.enum(['percentage', 'fixed']),
    discountValue: z.number().min(0),
    minOrderValue: z.number().min(0).optional(),
    maxDiscount: z.number().min(0).nullable().optional(),
    isActive: z.boolean().optional()
  })
});

router.post('/coupons', validate(couponSchema), async (req, res, next) => {
  try {
    const coupon = await Coupon.create(req.validated.body);
    res.status(201).json(coupon);
  } catch (error) {
    if (error.code === 11000) {
      const err = new Error('Coupon code already exists');
      err.statusCode = 400;
      return next(err);
    }
    next(error);
  }
});

router.put('/coupons/:id', validate(couponSchema), async (req, res, next) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.validated.body, { new: true });
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });
    res.json(coupon);
  } catch (error) {
    if (error.code === 11000) {
      const err = new Error('Coupon code already exists');
      err.statusCode = 400;
      return next(err);
    }
    next(error);
  }
});

router.delete('/coupons/:id', async (req, res, next) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });
    res.json({ message: 'Coupon deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
