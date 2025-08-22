// routes/posts.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const User = require('../models/User');
const Post = require('../models/Post');
const { v4: uuidv4 } = require('uuid'); // npm install uuid

const router = express.Router();

// configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Create Post
router.post('/create-post', upload.single('file'), async (req, res) => {
  try {
    const { userId, type } = req.body;
    const user = await User.findOne({ userId });
    if (!user) return res.status(400).json({ message: 'User not found.' });

    const postId = `${userId}-${Date.now()}`;
    let mediaUrl = null;

    if ((type === 'picture' || type === 'video') && req.file) {
      // 👇 full url instead of just /uploads/...
      mediaUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    }

    const post = new Post({
      postId,
      userId,
      type,
      message: req.body.message || "",
      hashtags: req.body.hashtags ? req.body.hashtags.trim().split(/\s+/) : [],
      caption: req.body.caption || "",
      allowComments: req.body.allowComments || "on",
      location: req.body.location || "",
      mediaUrl,
      privacy: user.privacy?.posts || "everyone",
      createdAt: new Date()
    });

    await post.save();

    res.json({ message: "Post saved!", postId });
  } catch (err) {
    console.error("❌ Create Post Error:", err);
    res.status(500).json({ message: "Failed to save post." });
  }
});

// Fetch single post
router.get('/post/:postId', async (req, res) => {
  const { postId } = req.params;
  const post = await Post.findOne({ postId });
  if (!post) return res.status(404).json({ message: "Post not found." });
  res.json(post);
});

router.get('/user-posts/:userId', async (req, res) => {
  const { userId } = req.params;
  const viewerId = req.query.viewerId;
  const user = await User.findOne({ userId });
  if (!user) return res.status(404).json({ message: 'User not found.' });

  // Fetch posts for this user
  const posts = await Post.find({ userId }).sort({ createdAt: -1 });

  // Get viewer info
  let isOwner = viewerId === userId;
  let isFriend = false;
  if (!isOwner && viewerId) {
    const viewer = await User.findOne({ userId: viewerId });
    if (viewer && user.friends.includes(viewerId)) isFriend = true;
  }

  // Filter posts by privacy
  const visiblePosts = posts.filter(post => {
    if (post.privacy === 'everyone') return true;
    if (post.privacy === 'friends') return isOwner || isFriend;
    if (post.privacy === 'private') return isOwner;
    return false;
  });

  res.json(visiblePosts);
});

router.post('/post/:postId/like', async (req, res) => {
  const { postId } = req.params;
  const { userId } = req.body;
  const post = await Post.findOne({ postId });
  if (!post) return res.status(404).json({ message: "Post not found." });

  const idx = post.likes.indexOf(userId);
  if (idx === -1) {
    post.likes.push(userId); // Like
  } else {
    post.likes.splice(idx, 1); // Unlike
  }
  await post.save();
  res.json({ likes: post.likes.length });
});

// Add comment
router.post('/post/:postId/comment', async (req, res) => {
  const { postId } = req.params;
  const { userId, text } = req.body;
  const post = await Post.findOne({ postId });
  if (!post) return res.status(404).json({ message: "Post not found." });

  const user = await User.findOne({ userId });
  if (!user) return res.status(404).json({ message: "User not found." });

  const comment = {
    commentId: uuidv4(),
    userId,
    username: user.username,
    avatar: user.avatar,
    text,
    createdAt: new Date(),
    replies: []
  };

  post.comments.push(comment);
  await post.save();
  res.json({ comments: post.comments });
});

// Add a reply to a comment
router.post('/post/:postId/comment/:commentId/reply', async (req, res) => {
  const { postId, commentId } = req.params;
  const { userId, text } = req.body;
  const post = await Post.findOne({ postId });
  if (!post) return res.status(404).json({ message: "Post not found." });

  const comment = post.comments.find(c => c.commentId === commentId);
  if (!comment) return res.status(404).json({ message: "Comment not found." });

  const user = await User.findOne({ userId });
  if (!user) return res.status(404).json({ message: "User not found." });

  const reply = {
    replyId: uuidv4(),
    userId,
    username: user.username,
    avatar: user.avatar,
    text,
    createdAt: new Date()
  };

  comment.replies.push(reply);
  await post.save();
  res.json({ comments: post.comments });
});

router.post('/post/:postId/share', async (req, res) => {
  const { postId } = req.params;
  const { userId } = req.body;
  const post = await Post.findOne({ postId });
  if (!post) return res.status(404).json({ message: "Post not found." });

  if (!post.sharedBy.includes(userId)) {
    post.shares = (post.shares || 0) + 1;
    post.sharedBy.push(userId);
    await post.save();
  }
  res.json({ shares: post.shares });
});

router.patch('/post/:postId/privacy', async (req, res) => {
  const { postId } = req.params;
  const { privacy } = req.body;
  const post = await Post.findOne({ postId });
  if (!post) return res.status(404).json({ message: "Post not found." });
  post.privacy = privacy;
  await post.save();
  res.json({ message: "Privacy updated." });
});

router.delete('/post/:postId', async (req, res) => {
  const { postId } = req.params;
  const post = await Post.findOneAndDelete({ postId });
  if (!post) return res.status(404).json({ message: "Post not found." });
  res.json({ message: "Post deleted." });
});

router.get('/posts/reels/:viewerId', async (req, res) => {
  const viewerId = req.params.viewerId;
  const posts = await Post.find({
    $or: [
      { privacy: 'everyone' },
      { privacy: 'friends', friends: viewerId }
    ]
  }).sort({ createdAt: -1 });
  res.json(posts);
});

module.exports = router;
