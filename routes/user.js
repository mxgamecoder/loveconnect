const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const router = express.Router();
const nodemailer = require('nodemailer');
require('dotenv').config();

// Helper: Generate random ID
function generateUserId() {
  return 'loveconnect' + Math.random().toString(36).substr(2, 9);
}

// Helper: Generate 6-digit verification code
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Check if email exists
router.post('/check-email', async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (user) {
    return res.status(400).json({ message: 'Email is already in use.' });
  }
  res.json({ message: 'Email is available.' });
});

// Check if username exists
router.post('/check-username', async (req, res) => {
  const { username } = req.body;
  const user = await User.findOne({ username });
  if (user) {
    return res.status(400).json({ message: 'Username is already in use.' });
  }
  res.json({ message: 'Username is available.' });
});

// Check if phone exists
router.post('/check-phone', async (req, res) => {
  const { phoneNumber } = req.body;
  const user = await User.findOne({ phoneNumber });
  if (user) {
    return res.status(400).json({ message: 'Phone number is already in use.' });
  }
  res.json({ message: 'Phone number is available.' });
});

// Signup Route (Step 1: Register & send code)
router.post('/signup', async (req, res) => {
  try {
    const { email, fullName, username, password, phoneNumber, gender, dob } = req.body;

    // Check each field separately
    if (await User.findOne({ email })) {
      return res.status(400).json({ type: 'email', message: 'Email is already in use.' });
    }
    if (await User.findOne({ username })) {
      return res.status(400).json({ type: 'username', message: 'Username is already in use.' });
    }
    if (await User.findOne({ phoneNumber })) {
      return res.status(400).json({ type: 'phone', message: 'Phone number is already in use.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = generateUserId();
    const verificationCode = generateVerificationCode();

    const user = new User({
      userId,
      email,
      fullName,
      username,
      password: hashedPassword,
      phoneNumber,
      gender,
      dob,
      avatar: 'https://i.ibb.co/JjMphBCP/avatar.jpg',
      verificationCode,
      isVerified: false
    });
    await user.save();

    // Send verification code via email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'LoveConnect Verification Code',
      text: `Your LoveConnect verification code is: ${verificationCode}`
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return res.status(500).json({ message: 'Error sending verification email.' });
      } else {
        return res.status(200).json({
          message: 'Verification code sent to your email! Please enter the code to verify your account.',
          userId
        });
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// Verification Route (Step 2: Verify code)
router.post('/verify', async (req, res) => {
  try {
    const { userId, code } = req.body;
    const user = await User.findOne({ userId });
    if (!user) return res.status(400).json({ message: 'User not found.' });
    if (user.isVerified) return res.status(400).json({ message: 'User already verified.' });

    if (user.verificationCode === code) {
      user.isVerified = true;
      user.verificationCode = null;
      await user.save();
      return res.status(200).json({ message: 'Signup successful! Redirecting to login...' });
    } else {
      return res.status(400).json({ message: 'Invalid verification code.' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// Login Route (only verified users)
router.post('/login', async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;
    if (!emailOrUsername || !password) {
      return res.status(400).json({ message: 'Email/Username and password are required.' });
    }

    const user = await User.findOne({
      $or: [{ email: emailOrUsername }, { username: emailOrUsername }],
    });

    if (!user) {
      return res.status(400).json({ message: 'User not found.' });
    }
    if (!user.isVerified) {
      return res.status(400).json({ message: 'Account not verified. Please check your email for the verification code.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    // Send login notification email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'LoveConnect Login Notification',
      text: `Hello ${user.fullName},\n\nYou have just logged in to your LoveConnect account.\n\nIf this wasn't you, please reset your password immediately.`
    };
    transporter.sendMail(mailOptions, (error, info) => {
      // Optional: log error/info, but don't block login
    });

    res.status(200).json({
      message: 'Login successful.',
      userId: user.userId,
      avatar: user.avatar,
      fullName: user.fullName,
      email: user.email,
      username: user.username
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// Resend Verification Code Route
router.post('/resend-code', async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findOne({ userId });
    if (!user) return res.status(400).json({ message: 'User not found.' });
    if (user.isVerified) return res.status(400).json({ message: 'User already verified.' });

    const newCode = generateVerificationCode();
    user.verificationCode = newCode;
    await user.save();

    // Send new code via email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'LoveConnect Verification Code (Resent)',
      text: `Your new LoveConnect verification code is: ${newCode}`
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return res.status(500).json({ message: 'Error resending verification email.' });
      } else {
        return res.status(200).json({ message: 'Verification code resent to your email.' });
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// Forgot Password: Send code
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Email not found.' });

    const code = generateVerificationCode();
    user.verificationCode = code;
    await user.save();

    // Send code via email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'LoveConnect Password Reset Code',
      text: `Your LoveConnect password reset code is: ${code}`
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return res.status(500).json({ message: 'Error sending reset code.' });
      } else {
        return res.status(200).json({
          message: 'Reset code sent to your email.',
          userId: user.userId
        });
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// Reset Password: Verify code and set new password
router.post('/reset-password', async (req, res) => {
  try {
    const { userId, code, newPassword } = req.body;
    if (!userId || !code || !newPassword) {
      return res.status(400).json({ message: 'All fields are required.' });
    }
    const user = await User.findOne({ userId });
    if (!user) return res.status(400).json({ message: 'User not found.' });
    if (user.verificationCode !== code) return res.status(400).json({ message: 'Invalid code.' });

    const isSame = await bcrypt.compare(newPassword, user.password);
    if (isSame) return res.status(400).json({ message: 'New password cannot be the same as the old password.' });

    user.password = await bcrypt.hash(newPassword, 10);
    user.verificationCode = null;
    await user.save();

    // Send password change notification email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'LoveConnect Password Changed',
      text: `Hello ${user.fullName},\n\nYour LoveConnect password has been changed successfully.\n\nIf this wasn't you, please contact support immediately.`
    };
    transporter.sendMail(mailOptions, (error, info) => {
      // Optional: log error/info, but don't block response
    });

    return res.status(200).json({ message: 'Password reset successful! Redirecting to login...' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;