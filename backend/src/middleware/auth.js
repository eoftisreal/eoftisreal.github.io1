const User = require('../models/User');
const { verifyAccessToken } = require('../utils/jwt');

async function auth(req, _res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      const err = new Error('Missing access token');
      err.statusCode = 401;
      throw err;
    }

    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);
    if (!user) {
      const err = new Error('Invalid access token');
      err.statusCode = 401;
      throw err;
    }

    req.user = user;
    next();
  } catch (error) {
    error.statusCode = error.statusCode || 401;
    next(error);
  }
}

module.exports = auth;
