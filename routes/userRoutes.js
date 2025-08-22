const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User'); // We'll create this model file below
const { isValidEmail, isValidPhone, isValidFullName } = require('../helpers/validators');
const router = express.Router();
const cloudinary = require('cloudinary').v2;
const nodemailer = require('nodemailer');

function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Get user profile by userId
router.get('/profile/:userId', async (req, res) => {
  const { userId } = req.params;
  const viewerId = req.query.viewerId;

  const user = await User.findOne({ userId });
  if (!user) return res.status(404).json({ message: 'User not found.' });

  let isFriend = false;
  let requested = false;
  let incoming = false;

  if (viewerId && viewerId !== userId) {
    const viewer = await User.findOne({ userId: viewerId });
    if (viewer) {
      isFriend = user.friends?.includes(viewerId);
      requested = user.requests?.includes(viewerId);
      incoming = viewer.requests?.includes(userId);
    }
  }

  // Only send online/lastSeen if privacy allows
  let showStatus = true;
  if (user.privacy && user.privacy.lastSeen === "nobody" && viewerId !== userId) {
    showStatus = false;
  }

  res.json({
    userId: user.userId,
    email: user.email,
    fullName: user.fullName,
    username: user.username,
    phoneNumber: user.phoneNumber,
    gender: user.gender,
    dob: user.dob,
    avatar: user.avatar,
    isVerified: user.isVerified,
    friends: user.friends || [],
    isFriend,
    requested,
    incoming,
    privacy: user.privacy,
    online: showStatus ? user.online : undefined,
    lastSeen: showStatus ? user.lastSeen : undefined
  });
});

// Configure with your environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Endpoint to generate a signed upload signature
router.get('/cloudinary-signature', (req, res) => {
  const timestamp = Math.floor(Date.now() / 1000); // current time in seconds
  const signature = cloudinary.utils.api_sign_request(
    { timestamp },
    process.env.CLOUDINARY_API_SECRET
  );
  res.json({ timestamp, signature, cloudName: process.env.CLOUDINARY_CLOUD_NAME, apiKey: process.env.CLOUDINARY_API_KEY });
});

// Update profile info (full name, avatar)
router.post('/update-profile', async (req, res) => {
  const { userId, fullName, avatar, gender, dob, newUsername } = req.body;
  const user = await User.findOne({ userId });
  if (!user) return res.status(400).json({ message: 'User not found.' });

  // Full name
  if (fullName) {
    if (!isValidFullName(fullName)) return res.status(400).json({ message: 'Full name must contain only letters and spaces.' });
    if (fullName === user.fullName) return res.status(400).json({ message: 'New full name cannot be the same as the old one.' });
    if (await User.findOne({ fullName })) return res.status(400).json({ message: 'Full name already in use.' });
    user.fullName = fullName;
  }

  // Avatar
  if (avatar) user.avatar = avatar;

  // Gender
  if (gender) {
    if (!['Male', 'Female', 'Other'].includes(gender)) return res.status(400).json({ message: 'Invalid gender value.' });
    user.gender = gender;
  }

  // DOB
  if (dob) {
    const newDob = new Date(dob);
    if (isNaN(newDob.getTime())) return res.status(400).json({ message: 'Invalid date format.' });
    user.dob = newDob;
  }

  // Username
  if (newUsername) {
    if (newUsername === user.username) return res.status(400).json({ message: 'New username cannot be the same as the old one.' });
    if (await User.findOne({ username: newUsername })) return res.status(400).json({ message: 'Username already in use.' });
    user.username = newUsername;
  }

  await user.save();
  res.json({
    userId: user.userId,
    email: user.email,
    fullName: user.fullName,
    username: user.username,
    phoneNumber: user.phoneNumber,
    gender: user.gender,
    dob: user.dob,
    avatar: user.avatar,
    isVerified: user.isVerified
  });
});

// Update email with code verification
router.post('/update-email', async (req, res) => {
  const { userId, code, newEmail } = req.body;
  const user = await User.findOne({ userId });
  if (!user) return res.status(400).json({ message: 'User not found.' });

  if (!isValidEmail(newEmail)) return res.status(400).json({ message: 'Email must be gmail.com, yahoo.com, or outlook.com.' });
  if (newEmail === user.email) return res.status(400).json({ message: 'New email cannot be the same as the old one.' });
  if (await User.findOne({ email: newEmail })) return res.status(400).json({ message: 'Email already in use.' });
  if (user.verificationCode !== code) return res.status(400).json({ message: 'Invalid code.' });

  user.email = newEmail;
  user.verificationCode = null;
  await user.save();
  res.json({ message: 'Email updated.' });
});

// Update phone with code verification
router.post('/update-phone', async (req, res) => {
  const { userId, code, newPhone } = req.body;
  const user = await User.findOne({ userId });
  if (!user) return res.status(400).json({ message: 'User not found.' });

  if (!isValidPhone(newPhone)) return res.status(400).json({ message: 'Phone must be in format +countrycode and numbers only.' });
  if (newPhone === user.phoneNumber) return res.status(400).json({ message: 'New phone number cannot be the same as the old one.' });
  if (await User.findOne({ phoneNumber: newPhone })) return res.status(400).json({ message: 'Phone number already in use.' });
  if (user.verificationCode !== code) return res.status(400).json({ message: 'Invalid code.' });

  user.phoneNumber = newPhone;
  user.verificationCode = null;
  await user.save();
  res.json({ message: 'Phone updated.' });
});

// Change password with code verification
router.post('/change-password', async (req, res) => {
  const { userId, code, newPassword } = req.body;
  const user = await User.findOne({ userId });
  if (!user) return res.status(400).json({ message: 'User not found.' });

  if (user.verificationCode !== code) return res.status(400).json({ message: 'Invalid code.' });

  // Prevent setting the same password again
  const isSame = await bcrypt.compare(newPassword, user.password);
  if (isSame) return res.status(400).json({ message: 'New password cannot be the same as the old password.' });

  // Save new password
  user.password = await bcrypt.hash(newPassword, 10);
  user.verificationCode = null;
  await user.save();

  res.json({ message: 'Password changed.' });
});

router.post('/verify-code', async (req, res) => {
  const { userId, code } = req.body;
  const user = await User.findOne({ userId });
  if (!user) return res.status(400).json({ message: 'User not found.' });
  if (user.verificationCode !== code) return res.status(400).json({ message: 'Invalid code.' });
  res.json({ message: 'Code verified.' });
});

router.post('/send-verification-code', async (req, res) => {
  const { userId, email } = req.body;
  const user = userId 
      ? await User.findOne({ userId }) 
      : await User.findOne({ email });

  if (!user) return res.status(400).json({ message: 'User not found.' });

  const code = generateVerificationCode();
  user.verificationCode = code;
  await user.save();

  transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: user.email,
    subject: 'Your Love Connect Verification Code',
    text: `Hello from Love Connect! 💖

You (or someone using your email) requested a verification code for your Love Connect account.

Your verification code is: ${code}

If you did not request this, you can safely ignore this email.

Thank you for being part of the Love Connect community!

Best regards,
The Love Connect Team`
  }, (err) => {
    if (err) return res.status(500).json({ message: 'Error sending code.' });
    res.json({ message: 'Verification code sent.' });
  });
});

router.post('/check-phone', async (req, res) => {
  const { phoneNumber } = req.body;
  const user = await User.findOne({ phoneNumber });
  if (user) {
    return res.status(400).json({ message: 'Phone already in use.' });
  }
  res.json({ message: 'Phone is available.' });
});

router.post('/support-message', async (req, res) => {
  const { email, message } = req.body;
  if (!email || !message) return res.status(400).json({ message: "Both fields are required." });

  // simple email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: "Invalid email." });
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,    // always your Gmail
      to: process.env.EMAIL_USER,      // send it to yourself
      replyTo: email,                  // user’s email (so you can reply)
      subject: "LoveConnect Support Message",
      text: `You have received a new support message on Love Connect!

From: ${email}

Message:
${message}

Please reply to this user as soon as possible.

With love,
The Love Connect Team`
    });

    res.json({ message: "Message sent!" });
  } catch (err) {
    console.error("SendMail error:", err); // log actual error to debug
    res.status(500).json({ message: "Failed to send message." });
  }
});

router.post('/delete-account', async (req, res) => {
  const { userId, code } = req.body;
  const user = await User.findOne({ userId });
  if (!user) return res.status(400).json({ message: 'User not found.' });
  if (user.verificationCode !== code) return res.status(400).json({ message: 'Invalid code.' });

  await User.deleteOne({ userId });
  res.json({ message: 'Account deleted.' });
});

router.get('/account-status/:userId', async (req, res) => {
  const { userId } = req.params;
  const user = await User.findOne({ userId });
  if (!user) return res.status(404).json({ message: 'User not found.' });
  res.json({
    fullName: user.fullName,
    username: user.username,
    email: user.email,
    avatar: user.avatar,           // <-- Added this line
    isPremium: user.isPremium,
    balance: user.balance
  });
});

router.post('/update-privacy', async (req, res) => {
  const { userId, privacy } = req.body;
  const user = await User.findOne({ userId });
  if (!user) return res.status(400).json({ message: 'User not found.' });

  // Ensure all keys exist and default to 'everyone'
  user.privacy = {
    profile: privacy.profile || 'everyone',
    posts: privacy.posts || 'everyone',
    lastSeen: privacy.lastSeen || 'everyone',
    messages: privacy.messages || 'everyone'
  };

  await user.save();
  res.json({ message: 'Privacy updated.' });
});


// Get suggested users (People you may know)
router.get('/users/:userId', async (req, res) => {
  const { userId } = req.params;
  const user = await User.findOne({ userId });
  if (!user) return res.status(400).json({ message: 'User not found.' });

  // Fetch all users except me
  let users = await User.find(
    { userId: { $ne: userId } },
    'userId username fullName avatar online friends requests'
  );

  // Transform users for frontend
  users = users.map(u => {
    const isFriend = u.friends && u.friends.includes(userId);
    const iRequested = u.requests && u.requests.includes(userId);   // I sent request
    const theyRequested = user.requests && user.requests.includes(u.userId); // They sent me request

    return {
      userId: u.userId,
      username: u.username,
      fullName: u.fullName,
      avatar: u.avatar,
      online: u.online,
      friends: u.friends,
      requested: iRequested,       // show Cancel Request
      incoming: theyRequested,     // hide from suggestions, show in Requests tab
      isFriend
    };
  });

  // Filter out people who already requested me (they show in requests tab instead)
  users = users.filter(u => !u.incoming);

  res.json(users);
});


// Add friend/follow
router.post('/add-friend', async (req, res) => {
  const { userId, targetId } = req.body;
  const user = await User.findOne({ userId });
  const target = await User.findOne({ userId: targetId });
  if (!user || !target) return res.status(400).json({ message: 'User not found.' });

  // Add to requests
  if (!target.requests) target.requests = [];
  if (!target.requests.includes(userId)) target.requests.push(userId);
  await target.save();
  res.json({ message: 'Friend request sent.' });
});

// Get friend requests for a user
router.get('/followers/:userId', async (req, res) => {
  const { userId } = req.params;
  const user = await User.findOne({ userId });
  if (!user) return res.status(400).json({ message: 'User not found.' });

  // fetch full user details for each request
  const followers = await User.find(
    { userId: { $in: user.requests } },
    'userId username fullName avatar online'
  );

  res.json(followers);
});

// Confirm friend request
router.post('/confirm-friend', async (req, res) => {
  const { userId, requesterId } = req.body;
  const user = await User.findOne({ userId });
  const requester = await User.findOne({ userId: requesterId });
  if (!user || !requester) return res.status(400).json({ message: 'User not found.' });

  // Remove request
  user.requests = user.requests.filter(id => id !== requesterId);
  // Add each other as friends
  if (!user.friends) user.friends = [];
  if (!requester.friends) requester.friends = [];
  if (!user.friends.includes(requesterId)) user.friends.push(requesterId);
  if (!requester.friends.includes(userId)) requester.friends.push(userId);
  await user.save();
  await requester.save();
  res.json({ message: 'Friend request confirmed.' });
});

// Cancel friend request (sent by me)
router.post('/cancel-request', async (req, res) => {
  const { userId, targetId } = req.body;
  const target = await User.findOne({ userId: targetId });
  if (!target) return res.status(400).json({ message: 'Target not found.' });

  target.requests = target.requests.filter(id => id !== userId);
  await target.save();

  res.json({ message: 'Friend request cancelled.' });
});

// Delete friend request (received by me)
router.post('/delete-request', async (req, res) => {
  const { userId, requesterId } = req.body;
  const user = await User.findOne({ userId });
  if (!user) return res.status(400).json({ message: 'User not found.' });

  user.requests = user.requests.filter(id => id !== requesterId);
  await user.save();

  res.json({ message: 'Friend request deleted.' });
});

// Save status
router.post('/status', async (req, res) => {
  const { userId, type, text, mediaUrl } = req.body;
  const user = await User.findOne({ userId });
  if (!user) return res.status(400).json({ message: 'User not found.' });

  const newStatus = {
    type,
    text: type === 'text' ? text : undefined,
    mediaUrl: type === 'media' ? mediaUrl : undefined,
    createdAt: new Date()
  };

  user.statuses.push(newStatus);
  await user.save();

  res.json({ message: 'Status saved.' });
});


// Get statuses
router.get('/status/:userId', async (req, res) => {
  const { userId } = req.params;
  const user = await User.findOne({ userId });
  if (!user || !user.statuses || user.statuses.length === 0) {
    return res.status(404).json({ message: 'No status.' });
  }

  const now = Date.now();
  const expireTime = 24 * 60 * 60 * 1000; // 24 hours

  // Find expired statuses
  const expired = user.statuses.filter(s => now - new Date(s.createdAt) >= expireTime);
  for (const status of expired) {
    if (status.mediaUrl) {
      const matches = status.mediaUrl.match(/\/([^\/]+)\.(jpg|jpeg|png|mp4|webm|mov)$/);
      if (matches) {
        const publicId = matches[1];
        try {
          await cloudinary.uploader.destroy(publicId, { resource_type: status.mediaUrl.endsWith('.mp4') ? 'video' : 'image' });
        } catch (err) {
          console.error('Cloudinary delete error:', err.message);
        }
      }
    }
  }

  // Remove expired statuses
  user.statuses = user.statuses.filter(s => now - new Date(s.createdAt) < expireTime);
  await user.save();

  if (user.statuses.length === 0) {
    return res.status(404).json({ message: 'No status.' });
  }

  res.json(user.statuses);
});

// Delete a specific status by index (or latest if not specified)
router.post('/delete-status', async (req, res) => {
  const { userId, index } = req.body;
  const user = await User.findOne({ userId });
  if (!user || !user.statuses || user.statuses.length === 0) {
    return res.status(404).json({ message: 'No status to delete.' });
  }

  let idx = typeof index === 'number' ? index : user.statuses.length - 1; // default: latest
  if (idx < 0 || idx >= user.statuses.length) {
    return res.status(400).json({ message: 'Invalid status index.' });
  }

  const status = user.statuses[idx];
  // Delete from Cloudinary if media
  if (status.mediaUrl) {
    // Extract public_id from Cloudinary URL
    const matches = status.mediaUrl.match(/\/([^\/]+)\.(jpg|jpeg|png|mp4|webm|mov)$/);
    if (matches) {
      const publicId = matches[1];
      try {
        await cloudinary.uploader.destroy(publicId, { resource_type: status.mediaUrl.endsWith('.mp4') ? 'video' : 'image' });
      } catch (err) {
        console.error('Cloudinary delete error:', err.message);
      }
    }
  }

  user.statuses.splice(idx, 1);
  await user.save();

  res.json({ message: 'Status deleted.' });
});

// Get active statuses (excluding current user)
router.get('/active-statuses/:userId', async (req, res) => {
  const { userId } = req.params;
  const now = Date.now();
  const expireTime = 4 * 60 * 1000; // 4 min

  // find the requesting user
  const currentUser = await User.findOne({ userId });
  if (!currentUser) return res.json([]);

  // only fetch statuses from friends
  const friends = await User.find({ userId: { $in: currentUser.friends } });

  const activeStatuses = friends.map(friend => {
    const validStatuses = (friend.statuses || []).filter(
      s => now - new Date(s.createdAt) < expireTime
    );

    if (validStatuses.length > 0) {
      return {
        userId: friend.userId,
        username: friend.username,
        fullName: friend.fullName,
        avatar: friend.avatar,
        online: friend.online,
        status: validStatuses[validStatuses.length - 1] // latest
      };
    }
    return null;
  }).filter(Boolean);

  res.json(activeStatuses);
});

module.exports = router;