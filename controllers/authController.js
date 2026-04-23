const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// REGISTER
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.json({ success: false, message: "All fields are required" });
    if (password.length < 6)
      return res.json({ success: false, message: "Password must be at least 6 characters" });

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser)
      return res.json({ success: false, message: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({ name: name.trim(), email: email.toLowerCase().trim(), password: hashedPassword });

    res.json({ success: true, message: "Registration successful" });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// LOGIN
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.json({ success: false, message: "Email and password are required" });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.json({ success: false, message: "No account found with that email" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.json({ success: false, message: "Incorrect password" });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// CHANGE PASSWORD
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword)
      return res.json({ success: false, message: "All fields are required" });
    if (newPassword.length < 6)
      return res.json({ success: false, message: "New password must be at least 6 characters" });

    const user = await User.findById(userId);
    if (!user) return res.json({ success: false, message: "User not found" });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.json({ success: false, message: "Current password is incorrect" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// FORGOT PASSWORD — generates a 6-char recovery code
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.json({ success: false, message: "Email is required" });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.json({ success: false, message: "No account found with that email" });

    // Generate a 6-character uppercase alphanumeric code
    const code = crypto.randomBytes(3).toString('hex').toUpperCase(); // e.g. "A3F9B2"
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    user.resetToken = code;
    user.resetTokenExpiry = expiry;
    await user.save();

    // Return code in response (no email service — shown on screen for thesis demo)
    res.json({
      success: true,
      message: "Recovery code generated. Save this code — it expires in 15 minutes.",
      code,
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// RESET PASSWORD — validates code and sets new password
exports.resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword)
      return res.json({ success: false, message: "All fields are required" });
    if (newPassword.length < 6)
      return res.json({ success: false, message: "Password must be at least 6 characters" });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.json({ success: false, message: "No account found with that email" });

    if (!user.resetToken || user.resetToken !== code.toUpperCase())
      return res.json({ success: false, message: "Invalid recovery code" });

    if (!user.resetTokenExpiry || new Date() > user.resetTokenExpiry)
      return res.json({ success: false, message: "Recovery code has expired. Please request a new one." });

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    res.json({ success: true, message: "Password reset successfully. You can now log in." });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};
