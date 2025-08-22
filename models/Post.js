// models/Post.js
const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
  replyId: String,
  userId: String,
  username: String, // <-- add this
  avatar: String,   // <-- add this
  text: String,
  createdAt: { type: Date, default: Date.now }
});

const commentSchema = new mongoose.Schema({
  commentId: String,
  userId: String,
  username: String, // <-- add this
  avatar: String,   // <-- add this
  text: String,
  createdAt: { type: Date, default: Date.now },
  replies: [replySchema]
});

const postSchema = new mongoose.Schema({
  postId: { type: String, unique: true },
  userId: String,
  type: { type: String, enum: ['text', 'picture', 'video'], required: true },
  message: String,
  hashtags: [String],
  caption: String,
  allowComments: { type: String, enum: ['on', 'off'], default: 'on' }, // ✅ renamed
  location: String,
  mediaUrl: String,
  privacy: { type: String, default: 'everyone' },
  createdAt: { type: Date, default: Date.now },
  likes: { type: [String], default: [] },
  comments: [commentSchema],
  sharedBy: { type: [String], default: [] },
});

module.exports = mongoose.model('Post', postSchema);
