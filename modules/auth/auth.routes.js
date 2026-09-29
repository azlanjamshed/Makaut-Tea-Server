const express = require('express');
const { registerUser, loginUser, logoutUser, getMe, changePassword } = require('./auth.controller');
const { validateRegister, validateLogin, validateChangePassword } = require('./auth.validate');
const { protect } = require('../../middleware/authMiddleware');
const upload = require('../../middleware/uploadMiddleware');

const router = express.Router();

router.post('/register', upload.single('image'), validateRegister, registerUser);
router.post('/login', validateLogin, loginUser);
router.post('/logout', logoutUser);
router.get('/me', protect, getMe);
router.put('/change-password', protect, validateChangePassword, changePassword);

module.exports = router;
