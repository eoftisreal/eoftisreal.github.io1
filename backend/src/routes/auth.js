const express = require('express');
const { z } = require('zod');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const validate = require('../middleware/validate');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const ResetToken = require('../models/ResetToken');
const MagicLink = require('../models/MagicLink');
const env = require('../config/env');
const { sendVerificationEmail, sendMagicLinkEmail, sendPasswordResetEmail } = require('../utils/sendEmail');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');

const router = express.Router();

// Helper to generate auth response
async function generateAuthResponse(user) {
  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    isAdmin: user.isAdmin
  });
  const refreshTokenString = signRefreshToken({ sub: user.id });

  // Hash refresh token for storage
  const tokenHash = crypto.createHash('sha256').update(refreshTokenString).digest('hex');

  // Store refresh token
  await RefreshToken.create({
    userId: user.id,
    tokenHash,
    // Model automatically sets expires: 30d
  });

  return {
    accessToken,
    refreshToken: refreshTokenString,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      role: user.role,
      isVerified: user.isVerified
    }
  };
}

// 1. SIGNUP
const signupSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    username: z.string().min(3, 'Username must be at least 3 characters long').regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores (no spaces)'),
    password: z.string().min(8, 'Password must be at least 8 characters long'),
    name: z.string().optional()
  })
});

router.post('/signup', validate(signupSchema), async (req, res, next) => {
  try {
    const { email, username, password, name } = req.validated.body;

    const existingUser = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }] });
    if (existingUser) {
      const err = new Error('User with this email or username already exists');
      err.statusCode = 400;
      throw err;
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const verificationToken = crypto.randomBytes(36).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');

    const user = await User.create({
      email: email.toLowerCase(),
      username: username.toLowerCase(),
      password: hashedPassword,
      name,
      verificationToken: tokenHash
    });

    const verifyUrl = `${env.appUrl}/auth/verify-email?token=${verificationToken}`;
    await sendVerificationEmail(user.email, verifyUrl);

    res.status(201).json({ message: 'Account created. Please check your email to verify.' });
  } catch (error) {
    next(error);
  }
});

// 2. VERIFY EMAIL
const verifyEmailSchema = z.object({
  body: z.object({ token: z.string().min(10) })
});

router.post('/verify-email', validate(verifyEmailSchema), async (req, res, next) => {
  try {
    const { token } = req.validated.body;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({ verificationToken: tokenHash });

    if (!user) {
      const err = new Error('Invalid or expired verification token');
      err.statusCode = 400;
      throw err;
    }

    user.isVerified = true;
    user.verificationToken = null;
    await user.save();

    res.json({ message: 'Email verified successfully. You can now log in.' });
  } catch (error) {
    next(error);
  }
});

// 3. LOGIN (Password)
const loginSchema = z.object({
  body: z.object({
    identifier: z.string().min(1), // Email or username
    password: z.string().min(1),
  })
});

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { identifier, password } = req.validated.body;
    const id = identifier.toLowerCase();

    const user = await User.findOne({
      $or: [{ email: id }, { username: id }]
    });

    if (!user) {
      const err = new Error('Invalid credentials');
      err.statusCode = 401;
      throw err;
    }

    if (!user.password) {
      const err = new Error('Please use a magic link to log in and set a password.');
      err.statusCode = 401;
      throw err;
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      const err = new Error('Invalid credentials');
      err.statusCode = 401;
      throw err;
    }

    if (!user.isVerified) {
      const err = new Error('Please verify your email address before logging in');
      err.statusCode = 403;
      throw err;
    }

    const authData = await generateAuthResponse(user);
    res.json(authData);
  } catch (error) {
    next(error);
  }
});

// 4. REFRESH TOKEN
const refreshSchema = z.object({
  body: z.object({ refreshToken: z.string().min(1) })
});

router.post('/refresh', validate(refreshSchema), async (req, res, next) => {
  try {
    const { refreshToken } = req.validated.body;

    const payload = verifyRefreshToken(refreshToken);
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const validToken = await RefreshToken.findOne({ tokenHash, userId: payload.sub });

    if (!validToken) {
      const err = new Error('Invalid refresh token');
      err.statusCode = 401;
      throw err;
    }

    const user = await User.findById(payload.sub);
    if (!user || !user.isVerified) {
      const err = new Error('User invalid or unverified');
      err.statusCode = 401;
      throw err;
    }

    // Delete old refresh token (rotation)
    await validToken.deleteOne();

    const authData = await generateAuthResponse(user);
    res.json(authData);
  } catch (error) {
    next(error);
  }
});

// 5. MAGIC LINK LOGIN
const requestMagicSchema = z.object({
  body: z.object({ email: z.string().email() })
});

router.post('/magic-link/request', validate(requestMagicSchema), async (req, res, next) => {
  try {
    const { email } = req.validated.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.isVerified) {
      // Return 202 to prevent email enumeration attacks
      return res.status(202).json({ message: 'If the email exists and is verified, a link was sent.' });
    }

    const magicToken = crypto.randomBytes(36).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(magicToken).digest('hex');

    await MagicLink.create({
      userId: user.id,
      tokenHash
    });

    const magicUrl = `${env.appUrl}/auth/callback?token=${encodeURIComponent(magicToken)}`;
    await sendMagicLinkEmail(user.email, magicUrl);

    res.status(202).json({ message: 'If the email exists and is verified, a link was sent.' });
  } catch (error) {
    next(error);
  }
});

const verifyMagicSchema = z.object({
  body: z.object({ token: z.string().min(20) })
});

router.post('/magic-link/verify', validate(verifyMagicSchema), async (req, res, next) => {
  try {
    const { token } = req.validated.body;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const record = await MagicLink.findOne({ tokenHash }).populate('userId');

    if (!record || record.consumedAt) {
      const err = new Error('Magic link is invalid or expired');
      err.statusCode = 400;
      throw err;
    }

    record.consumedAt = new Date();
    await record.save();

    const user = record.userId;
    if (!user || !user.isVerified) {
      const err = new Error('User invalid or unverified');
      err.statusCode = 401;
      throw err;
    }

    const authData = await generateAuthResponse(user);
    res.json(authData);
  } catch (error) {
    next(error);
  }
});

// 6. FORGOT PASSWORD
const forgotPasswordSchema = z.object({
  body: z.object({ identifier: z.string().min(1) })
});

router.post('/forgot-password', validate(forgotPasswordSchema), async (req, res, next) => {
  try {
    const { identifier } = req.validated.body;
    const id = identifier.toLowerCase();

    const user = await User.findOne({
      $or: [{ email: id }, { username: id }]
    });

    if (user) {
      const resetToken = crypto.randomBytes(36).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

      await ResetToken.create({
        userId: user.id,
        tokenHash
      });

      const resetUrl = `${env.appUrl}/auth/reset-password?token=${encodeURIComponent(resetToken)}`;
      await sendPasswordResetEmail(user.email, resetUrl);
    }

    // Always return 202 to prevent user enumeration
    res.status(202).json({ message: 'If an account exists, a password reset link has been sent.' });
  } catch (error) {
    next(error);
  }
});

// 7. RESET PASSWORD
const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(20),
    newPassword: z.string().min(8)
  })
});

router.post('/reset-password', validate(resetPasswordSchema), async (req, res, next) => {
  try {
    const { token, newPassword } = req.validated.body;

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const record = await ResetToken.findOne({ tokenHash }).populate('userId');

    if (!record) {
      const err = new Error('Reset link is invalid or expired');
      err.statusCode = 400;
      throw err;
    }

    const user = record.userId;
    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    await record.deleteOne(); // Destroy token after use

    res.json({ message: 'Password has been reset successfully.' });
  } catch (error) {
    next(error);
  }
});

// 8. GET CURRENT USER PROFILE
const auth = require('../middleware/auth');
router.get('/me', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Sign a fresh token in case role/admin status has changed
    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      isAdmin: user.isAdmin
    });

    res.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified,
        phone: user.phone,
        address: user.address,
      }
    });
  } catch (error) {
    next(error);
  }
});

const profileUpdateSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    address: z.object({
      line1: z.string().optional(),
      line2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional()
    }).optional()
  }),
  query: z.object({}),
  params: z.object({})
});

router.put('/profile', auth, validate(profileUpdateSchema), async (req, res, next) => {
  try {
    const { name, phone, address } = req.validated.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) {
      if (!user.address) user.address = {};
      Object.assign(user.address, address);
    }
    await user.save();

    res.json(user);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
