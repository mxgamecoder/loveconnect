const express = require('express');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Post = require('../models/Post');
const router = express.Router();

// Simple admin login (JSON-based)
router.post('/admin/login', (req, res) => {
  const { name, password } = req.body;
  const admins = JSON.parse(fs.readFileSync(path.join(__dirname, '../admin.json')));
  const found = admins.find(a => a.name === name && a.password === password);
  if (found) {
    // In production, use JWT/session!
    res.json({ success: true, admin: name });
  } else {
    res.status(401).json({ success: false, message: "Invalid credentials" });
  }
});

// Get total users
router.get('/admin/total-users', async (req, res) => {
  const count = await User.countDocuments();
  res.json({ count });
});

// Get online users
router.get('/admin/online-users', async (req, res) => {
  const count = await User.countDocuments({ online: true });
  res.json({ count });
});

// Get all users
router.get('/admin/users', async (req, res) => {
  const users = await User.find({}, 'userId username fullName email online avatar');
  res.json(users);
});

// Get all posts
router.get('/admin/posts', async (req, res) => {
  const posts = await Post.find().sort({ createdAt: -1 });
  res.json(posts);
});

// Get all reports
router.get('/admin/reports', (req, res) => {
  const reportsDir = path.join(__dirname, '../reports');
  if (!fs.existsSync(reportsDir)) return res.json([]);
  const files = fs.readdirSync(reportsDir);
  const reports = files.map(f => {
    const data = fs.readFileSync(path.join(reportsDir, f), 'utf8');
    try { return JSON.parse(data); } catch { return null; }
  }).filter(Boolean);
  res.json(reports);
});

// Get all messages for a user (by userId)
router.get('/admin/messages/:userId', (req, res) => {
  const messagesDir = path.join(__dirname, '../messages');
  if (!fs.existsSync(messagesDir)) return res.json([]);
  const files = fs.readdirSync(messagesDir);
  let allMessages = [];
  files.forEach(f => {
    const data = fs.readFileSync(path.join(messagesDir, f), 'utf8');
    try {
      const msgs = JSON.parse(data);
      allMessages = allMessages.concat(msgs.filter(m => m.from === req.params.userId || m.to === req.params.userId));
    } catch {}
  });
  res.json(allMessages);
});

module.exports = router;