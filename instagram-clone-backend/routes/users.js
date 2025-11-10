const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Post = require('../models/Post');
const auth = require('../middleware/auth');

// Search users by username (public)
router.get('/search', async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.json([]);

    const users = await User.find({ username: { $regex: q, $options: 'i' } })
      .select('username profilePicture bio')
      .limit(20);

    res.json(users);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get public profile and their posts
router.get('/:username', async (req, res) => {
  try {
    const username = req.params.username;
    const user = await User.findOne({ username }).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const posts = await Post.find({ user: user._id })
      .sort({ createdAt: -1 })
      .populate('user', 'username profilePicture');

    res.json({ user, posts });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Follow/unfollow user (authenticated)
router.post('/:username/follow', auth, async (req, res) => {
  try {
    const username = req.params.username;
    const target = await User.findOne({ username });
    if (!target) return res.status(404).json({ error: 'User not found' });

    const currentUserId = req.user.id;
    // cannot follow yourself
    if (target._id.toString() === currentUserId) return res.status(400).json({ error: 'Cannot follow yourself' });

    const currentUser = await User.findById(currentUserId);
    if (!currentUser) return res.status(404).json({ error: 'Current user not found' });

    const alreadyFollowing = target.followers.some((f) => f.toString() === currentUserId);

    if (alreadyFollowing) {
      // unfollow
      target.followers = target.followers.filter((f) => f.toString() !== currentUserId);
      currentUser.following = currentUser.following.filter((f) => f.toString() !== target._id.toString());
    } else {
      // follow
      target.followers.push(currentUserId);
      currentUser.following.push(target._id);
    }

    await target.save();
    await currentUser.save();

    return res.json({ following: !alreadyFollowing, followersCount: target.followers.length });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

// Get followers list for a user
router.get('/:username/followers', async (req, res) => {
  try {
    const username = req.params.username;
    const user = await User.findOne({ username }).populate('followers', 'username profilePicture bio');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user.followers || []);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get following list for a user
router.get('/:username/following', async (req, res) => {
  try {
    const username = req.params.username;
    const user = await User.findOne({ username }).populate('following', 'username profilePicture bio');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user.following || []);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
