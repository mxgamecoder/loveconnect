const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: { type: String, unique: true },
  email: { type: String, required: true, unique: true },
  fullName: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phoneNumber: { type: String, required: true, unique: true },
  gender: { type: String, required: true },
  dob: { type: Date, required: true },
  avatar: { type: String, default: 'https://i.ibb.co/JjMphBCP/avatar.jpg' },
  isVerified: { type: Boolean, default: false },
  verificationCode: { type: String },
  isPremium: { type: Boolean, default: false }, // <-- Added
  balance: { type: Number, default: 0 },         // <-- Added
  privacy: {
    type: Object,
    default: {
      profile: 'everyone',
      posts: 'everyone',
      lastSeen: 'everyone',
      messages: 'everyone'
    }
  },
  friends: { type: [String], default: [] },
  followers: { type: [String], default: [] },
  requests: { type: [String], default: [] },
  online: { type: Boolean, default: false },
statuses: [
  {
    type: { type: String },
    text: String,
    mediaUrl: String,
    createdAt: { type: Date, default: Date.now }
  }
]
});

module.exports = mongoose.model('User', userSchema);