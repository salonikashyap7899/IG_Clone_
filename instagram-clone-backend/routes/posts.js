const express = require('express');
const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const Post = require('../models/Post');
const auth = require('../middleware/auth');
const router = express.Router();

const upload = multer({ dest: 'uploads/' });

router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    const result = await cloudinary.uploader.upload(req.file.path);
    const post = new Post({
      user: req.user.id,
      image: result.secure_url,
      caption: req.body.caption,
    });
    await post.save();
    res.status(201).json(post);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const posts = await Post.find()
      .populate('user', 'username profilePicture')
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ✅ FIX: Export the router
module.exports = router;
