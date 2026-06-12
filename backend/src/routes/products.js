const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/admin');

const Category = require('../models/Category');
const Brand = require('../models/Brand');

const router = express.Router();

router.get('/categories', async (req, res, next) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

router.get('/brands', async (req, res, next) => {
  try {
    const brands = await Brand.find({ isActive: true }).sort({ name: 1 });
    res.json(brands);
  } catch (error) {
    next(error);
  }
});

const listSchema = z.object({
  body: z.object({}),
  query: z.object({
    q: z.string().optional(),
    category: z.string().optional(),
    brand: z.string().optional(),
    minPrice: z.coerce.number().optional(),
    maxPrice: z.coerce.number().optional(),
    isFeatured: z.string().optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(1000).default(12),
  }),
  params: z.object({}),
});

router.get('/', validate(listSchema), async (req, res, next) => {
  try {
    const { q, category, brand, minPrice, maxPrice, isFeatured, page, limit } = req.validated.query;
    const query = { isActive: true };

    if (q) {
      query.$text = { $search: q };
    }
    if (category) {
      query.category = category;
    }
    if (brand) {
      query.brand = brand;
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
      query.price = {};
      if (minPrice !== undefined) query.price.$gte = minPrice;
      if (maxPrice !== undefined) query.price.$lte = maxPrice;
    }
    if (isFeatured === 'true') {
      query.isFeatured = true;
    } else if (isFeatured === 'false') {
      query.isFeatured = false;
    }

    const [products, total] = await Promise.all([
      Product.find(query)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Product.countDocuments(query),
    ]);

    res.json({ products, page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      const err = new Error('Product not found');
      err.statusCode = 404;
      throw err;
    }
    res.json(product);
  } catch (error) {
    next(error);
  }
});

const createSchema = z.object({
  body: z.object({
    title: z.string().min(2),
    description: z.string().min(10),
    artistName: z.string().min(2),
    category: z.string().min(2),
    brand: z.string().optional(),
    images: z.array(z.string().url()).default([]),
    r2ImageKeys: z.array(z.string()).default([]),
    price: z.number().nonnegative(),
    compareAtPrice: z.number().nonnegative().optional(),
    stock: z.number().int().nonnegative().default(0),
    tags: z.array(z.string()).default([]),
    isFeatured: z.boolean().default(false),
    isCustomizable: z.boolean().default(false),
    minDeliveryDays: z.number().int().min(1).optional(),
    maxDeliveryDays: z.number().int().min(1).optional(),
  }),
  query: z.object({}),
  params: z.object({}),
});

router.post('/', auth, adminOnly, validate(createSchema), async (req, res, next) => {
  try {
    const product = await Product.create(req.validated.body);
    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', auth, adminOnly, validate(createSchema), async (req, res, next) => {
  try {
    const updated = await Product.findByIdAndUpdate(req.params.id, req.validated.body, { new: true });
    if (!updated) {
      const err = new Error('Product not found');
      err.statusCode = 404;
      throw err;
    }
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', auth, adminOnly, async (req, res, next) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) {
      const err = new Error('Product not found');
      err.statusCode = 404;
      throw err;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

const patchSchema = z.object({
  body: z.object({
    isFeatured: z.boolean()
  }),
  params: z.object({
    id: z.string()
  })
});

const uploadCustomImage = require('multer')({
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});
const { uploadToR2, getObjectUrl, isR2Configured } = require('../utils/r2');
const { optimizeImage } = require('../utils/imageOptimizer');

router.post('/upload-custom', uploadCustomImage.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    if (!isR2Configured()) {
      return res.status(500).json({ message: 'Storage is not configured on the server. Image upload is disabled.' });
    }

    let bufferToUpload = req.file.buffer;
    let mimeType = req.file.mimetype;
    let originalName = req.file.originalname;

    if (mimeType.startsWith('image/')) {
      try {
        const optimized = await optimizeImage(req.file.buffer);
        bufferToUpload = optimized.buffer;
        mimeType = optimized.mimeType;
        // Replace extension in original name with .webp for R2 key generation
        originalName = originalName.replace(/\.[^/.]+$/, "") + ".webp";
      } catch (err) {
        console.warn('Image optimization failed, falling back to original image:', err);
      }
    }

    const key = await uploadToR2(bufferToUpload, mimeType, originalName);
    const url = getObjectUrl(key);

    res.json({ key, url });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/featured', auth, adminOnly, validate(patchSchema), async (req, res, next) => {
  try {
    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      { isFeatured: req.validated.body.isFeatured },
      { new: true }
    );
    if (!updated) {
      const err = new Error('Product not found');
      err.statusCode = 404;
      throw err;
    }
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
