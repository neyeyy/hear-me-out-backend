// Must run AFTER authMiddleware (needs req.user already set).
// Usage: router.get('/x', authMiddleware, requireRole('counselor'), handler)
module.exports = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: "Not authorized" });
  }
  next();
};
