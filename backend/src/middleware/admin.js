function adminOnly(req, _res, next) {
  if (req.user?.role !== 'admin' && req.user?.role !== 'master_admin') {
    const err = new Error('Admin access required');
    err.statusCode = 403;
    return next(err);
  }

  return next();
}

module.exports = adminOnly;
