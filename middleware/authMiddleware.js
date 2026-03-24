const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    console.log("HEADER:", authHeader); // debug

    if (!authHeader) {
      return res.json({
        success: false,
        message: "No token provided"
      });
    }

    const token = authHeader.split(' ')[1];

    console.log("TOKEN:", token); // debug

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    console.log("DECODED:", decoded); // debug

    req.user = decoded; // 🔥 THIS IS THE KEY

    next();

  } catch (error) {
    console.log("JWT ERROR:", error.message);

    return res.json({
      success: false,
      message: "Invalid token"
    });
  }
};