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

// Toggle like/unlike on a post
router.post('/:id/like', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const userId = req.user.id;
    const alreadyLiked = post.likes.some((l) => l.toString() === userId);

    if (alreadyLiked) {
      // unlike
      post.likes = post.likes.filter((l) => l.toString() !== userId);
    } else {
      // like
      post.likes.push(userId);
    }

    await post.save();
    return res.json({ liked: !alreadyLiked, likesCount: post.likes.length });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

// Add a comment to a post
router.post('/:id/comments', auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    const post = await Post.findById(req.params.id).populate('comments.user', 'username profilePicture');
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const comment = { user: req.user.id, text, createdAt: new Date() };
    post.comments.push(comment);
    await post.save();

    // populate the newly added comment's user before returning
    await post.populate('comments.user', 'username profilePicture');
    const newComment = post.comments[post.comments.length - 1];
    return res.status(201).json(newComment);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

// Delete a comment (only comment author or post owner)
router.delete('/:id/comments/:commentId', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    // check permission: comment author or post owner
    if (comment.user.toString() !== req.user.id && post.user.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    comment.remove();
    await post.save();
    return res.json({ message: 'Comment deleted' });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

// ✅ FIX: Export the router
module.exports = router;
