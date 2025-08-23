const express = require('express');
const mongoose = require('mongoose');
const cors = require("cors");
const multer = require('multer');
require('dotenv').config();
const User = require('./models/User'); // ✅ add this
const path = require('path');
const fs = require('fs');
const adminRoutes = require('./routes/admin');

const app = express(); // ✅ must be before http.createServer

const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: '*' } });

app.use(cors({ origin: "*" }));

app.use(express.json());

// MongoDB connection
async function connectDB() {
  try {
    console.log("🔄 Connecting to MongoDB...");
    console.log("🔍 Using URI:", process.env.MONGODB_URI.replace(/\/\/(.*?):(.*?)@/, "//$1:********@")); // hide password in logs

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");
  } catch (err) {
    console.error("❌ MongoDB connection error:");
    console.error("   Message:", err.message);
    if (err.reason) console.error("   Reason:", err.reason);
    if (err.codeName) console.error("   Code Name:", err.codeName);
    process.exit(1);
  }
}
connectDB();

// Routes
const userRoutes = require('./routes/userRoutes');
app.use('/api', userRoutes);

const user = require('./routes/user');
app.use('/api', user);

const post = require('./routes/posts');
app.use('/api', post);

app.use('/api', adminRoutes);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

const HEARTBEAT_INTERVAL = 10000; // 10s
const TIMEOUT = 30000; // 30s → after this user is offline

const userSockets = {}; // userId -> Set of socket ids

io.on("connection", socket => {
  let userId = null;

  socket.on("online", async uid => {
    userId = uid;
    if (!userSockets[userId]) userSockets[userId] = new Set();
    userSockets[userId].add(socket.id);

    // Join a personal room for notifications
    socket.join(userId);

    await User.updateOne({ userId }, { online: true, lastSeen: Date.now() });
    io.emit("status", { userId, online: true });
  });

  socket.on("heartbeat", async uid => {
    userId = uid;
    await User.updateOne({ userId }, { lastSeen: Date.now() });
  });

  socket.on("disconnect", async () => {
    if (userId && userSockets[userId]) {
      userSockets[userId].delete(socket.id);
      if (userSockets[userId].size === 0) {
        const now = Date.now();
        await User.updateOne({ userId }, { online: false, lastSeen: now });
        io.emit("status", { userId, online: false, lastSeen: now });
        delete userSockets[userId];
      }
    }
  });

  // Chat room logic
  socket.on('joinRoom', roomId => {
    socket.join(roomId);
  });

  // When a message is sent
  socket.on('chatMessage', msg => {
    // Check if recipient has blocked the sender
    const blockedSet = blockList[msg.to];
    if (blockedSet && blockedSet.has(msg.from)) {
      // Recipient has blocked sender: do NOT deliver message
      return;
    }
    // Only save text messages here!
    if (!msg.fileUrl) {
      const file = getMessageFile(msg.roomId);
      let messages = [];
      if (fs.existsSync(file)) {
        try { messages = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
      }
      messages.push(msg);
      fs.writeFileSync(file, JSON.stringify(messages));
    }
    io.to(msg.roomId).emit('chatMessage', msg);
    // After io.to(msg.roomId).emit('chatMessage', msg);
if (msg.to) {
  io.to(msg.to).emit('newMessageNotification', {
    from: msg.from,
    to: msg.to,
    time: msg.time,
    roomId: msg.roomId
  });
}
  });

  // When a message is delivered (received by recipient)
  socket.on('delivered', data => {
    const file = getMessageFile(data.roomId);
    let messages = [];
    if (fs.existsSync(file)) {
      try { messages = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
    }
    // Find the message and mark as delivered
    const idx = messages.findIndex(m => m.time === data.time && m.from === data.from);
    if (idx !== -1) {
      messages[idx].delivered = true;
      fs.writeFileSync(file, JSON.stringify(messages));
      io.to(data.roomId).emit('delivered', messages[idx]);
    }
  });

  // When a message is seen
  socket.on('seen', data => {
    const file = getMessageFile(data.roomId);
    let messages = [];
    if (fs.existsSync(file)) {
      try { messages = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
    }
    // Find the message and mark as seen
    const idx = messages.findIndex(m => m.time === data.time && m.from === data.from);
    if (idx !== -1) {
      messages[idx].seen = true;
      fs.writeFileSync(file, JSON.stringify(messages));
      io.to(data.roomId).emit('seen', messages[idx]);
    }
  });

  socket.on('typing', data => {
    socket.to(data.roomId).emit('typing', data);
  });

  socket.on('status', status => {
    if (status.userId === friendId) {
      // Always fetch the latest profile/status from backend
      loadFriendProfile();
    }
  });
});

// 🕒 Background job to mark inactive users offline
setInterval(async () => {
  const inactiveUsers = await User.find({
    online: true,
    lastSeen: { $lt: Date.now() - TIMEOUT }
  });

  for (let u of inactiveUsers) {
    await User.updateOne({ userId: u.userId }, { online: false });
    io.emit("status", { userId: u.userId, online: false, lastSeen: u.lastSeen }); // <-- add lastSeen
  }
}, HEARTBEAT_INTERVAL);

// Messages directory
const messagesDir = path.join(__dirname, 'messages');
if (!fs.existsSync(messagesDir)) fs.mkdirSync(messagesDir);

// Helper to get message file path
function getMessageFile(roomId) {
  return path.join(messagesDir, `${roomId}.json`);
}

// API to fetch messages for a room
app.get('/api/messages/:roomId', (req, res) => {
  const file = getMessageFile(req.params.roomId);
  if (!fs.existsSync(file)) return res.json([]);
  const data = fs.readFileSync(file, 'utf8');
  try {
    res.json(JSON.parse(data));
  } catch {
    res.json([]);
  }
});

// File uploads
const uploadsDir = path.join(__dirname, 'messages_uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + Math.random().toString(36).slice(2) + ext);
  }
});
const upload = multer({ storage });

app.post('/api/messages/upload', upload.single('file'), (req, res) => {
  const { roomId, from, to, time } = req.body;
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const fileUrl = `/messages_uploads/${req.file.filename}`;
  const msg = {
    from,
    to,
    time: Number(time),
    fileUrl,
    fileType: req.file.mimetype,
    delivered: false,
    seen: false
  };
  // Save to messages file
  const file = getMessageFile(roomId);
  let messages = [];
  if (fs.existsSync(file)) {
    try { messages = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  }
  messages.push(msg);
  fs.writeFileSync(file, JSON.stringify(messages));
  res.json(msg);
});
app.use('/messages_uploads', express.static(uploadsDir));

// In-memory block list (replace with DB for production)
const blockList = {}; // userId -> Set of blocked userIds

app.post('/api/block', (req, res) => {
  const { userId, targetId } = req.body;
  if (!blockList[userId]) blockList[userId] = new Set();
  blockList[userId].add(targetId);
  res.json({ blocked: true });
});
app.post('/api/unblock', (req, res) => {
  const { userId, targetId } = req.body;
  if (blockList[userId]) blockList[userId].delete(targetId);
  res.json({ blocked: false });
});
app.get('/api/block-status', (req, res) => {
  const { userId, targetId } = req.query;
  const blocked = blockList[userId] && blockList[userId].has(targetId);
  res.json({ blocked });
});

app.post('/api/messages/delete', (req, res) => {
  const { roomId, ids, type, userId } = req.body;
  const file = getMessageFile(roomId);
  let messages = [];
  if (fs.existsSync(file)) {
    try { messages = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  }
  if (type === "me") {
    // Mark as deleted for this user (add a deletedFor array)
    ids.forEach(id => {
      const idx = messages.findIndex(m => `${m.from}-${m.time}` === id);
      if (idx !== -1) {
        if (!messages[idx].deletedFor) messages[idx].deletedFor = [];
        messages[idx].deletedFor.push(userId);
      }
    });
  } else if (type === "everyone") {
    // Remove message for all
    messages = messages.filter(m => !ids.includes(`${m.from}-${m.time}`));
  }
  fs.writeFileSync(file, JSON.stringify(messages));
  res.json({ success: true });
});

app.post('/api/messages/edit', (req, res) => {
  const { roomId, msgId, text, userId } = req.body;
  const file = getMessageFile(roomId);
  let messages = [];
  if (fs.existsSync(file)) {
    try { messages = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  }
  const idx = messages.findIndex(m => `${m.from}-${m.time}` === msgId && m.from === userId);
  if (idx !== -1) {
    messages[idx].text = text;
    messages[idx].edited = true;
  }
  fs.writeFileSync(file, JSON.stringify(messages));
  res.json({ success: true });
});
// Reports directory
const reportsDir = path.join(__dirname, 'reports');
if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir);

app.post('/api/report', (req, res) => {
  const { reporter, reported, reason, time } = req.body;
  if (!reporter || !reported || !reason) return res.status(400).json({ error: "Missing fields" });
  const report = { reporter, reported, reason, time };
  const file = path.join(reportsDir, `${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  res.json({ success: true });
});
app.get('/api/blocked-users', async (req, res) => {
  const { userId } = req.query;
  const blockedIds = blockList[userId] ? Array.from(blockList[userId]) : [];
  if (!blockedIds.length) return res.json([]);
  // Fetch user info for each blocked user
  const users = await User.find({ userId: { $in: blockedIds } }, 'userId username fullName avatar');
  res.json(users);
});
http.listen(3000, () => {
  console.log('🚀 Server running on http://localhost:3000');
});