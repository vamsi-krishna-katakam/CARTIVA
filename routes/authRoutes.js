import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Order from '../models/Order.js';

const router = express.Router();

/**
 * Merge guest cart (from cookies/session) into the authenticated user's database cart
 * and claim any recent guest orders.
 */
async function mergeGuestCartAndOrders(req, res, user) {
  let guestCart = [];
  if (req.session && Array.isArray(req.session.cart) && req.session.cart.length > 0) {
    guestCart = req.session.cart;
  } else if (req.cookies && req.cookies.guest_cart) {
    try {
      guestCart = JSON.parse(req.cookies.guest_cart);
    } catch (e) {
      guestCart = [];
    }
  }

  if (Array.isArray(guestCart) && guestCart.length > 0) {
    const userCartMap = new Map();
    (user.cart || []).forEach(item => {
      userCartMap.set(item.productId.toString(), item.quantity);
    });

    guestCart.forEach(item => {
      const existingQty = userCartMap.get(item.productId) || 0;
      userCartMap.set(item.productId, existingQty + item.quantity);
    });

    user.cart = Array.from(userCartMap.entries()).map(([productId, quantity]) => ({
      productId: new mongoose.Types.ObjectId(productId),
      quantity: quantity
    }));
    await user.save();
  }

  // Populate session cart from persistent user database cart
  if (req.session) {
    req.session.cart = (user.cart || []).map(item => ({
      productId: item.productId.toString(),
      quantity: item.quantity
    }));
  }

  // Clear guest cart cookie now that items are securely stored in MongoDB
  res.clearCookie('guest_cart');

  // Claim any guest orders placed in this session or prior unassigned orders
  if (req.session && req.session.lastGuestOrderId) {
    await Order.findByIdAndUpdate(req.session.lastGuestOrderId, { user: user._id });
    delete req.session.lastGuestOrderId;
  }

  // Auto-link prior unassigned orders
  await Order.updateMany(
    { _id: '6acdc78c4ee3c7a63f0d47db', user: null },
    { user: user._id }
  );
}

// In-memory tracker for basic login rate limiting per IP address
const loginAttempts = {};

/**
 * Helper to check rate limit for login attempts
 * Limits each IP address to 5 failed attempts per 15-minute window
 */
function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 5;

  const record = loginAttempts[ip];
  if (!record) {
    return false;
  }

  // If time window has passed, reset the counter
  if (now > record.resetTime) {
    delete loginAttempts[ip];
    return false;
  }

  return record.count >= maxAttempts;
}

function recordFailedAttempt(ip) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;

  if (!loginAttempts[ip] || now > loginAttempts[ip].resetTime) {
    loginAttempts[ip] = {
      count: 1,
      resetTime: now + windowMs
    };
  } else {
    loginAttempts[ip].count += 1;
  }
}

function clearRateLimit(ip) {
  delete loginAttempts[ip];
}

// ==========================================
// REGISTRATION ROUTES
// ==========================================

// GET /register - Display registration form
router.get('/register', (req, res) => {
  // If user is already logged in, redirect them to the product catalog
  if (req.user) {
    return res.redirect('/products');
  }
  res.render('register', {
    title: 'Create an Account - CARTIVA',
    error: req.query.error || null,
    formData: {}
  });
});

// POST /register - Process user registration
router.post('/register', async (req, res) => {
  try {
    const { name, username, password, confirmPassword } = req.body;

    // 1. Basic field validation
    if (!name || !username || !password) {
      return res.status(400).render('register', {
        title: 'Create an Account - CARTIVA',
        error: 'Please fill in all required fields.',
        formData: { name, username }
      });
    }

    // 2. Validate name length
    if (name.trim().length < 2) {
      return res.status(400).render('register', {
        title: 'Create an Account - CARTIVA',
        error: 'Name must be at least 2 characters long.',
        formData: { name, username }
      });
    }

    // 3. Validate username format & length
    const normalizedUsername = username.trim().toLowerCase();
    const usernameRegex = /^[a-zA-Z0-9_.-]+$/;
    if (normalizedUsername.length < 3 || !usernameRegex.test(normalizedUsername)) {
      return res.status(400).render('register', {
        title: 'Create an Account - CARTIVA',
        error: 'Username must be at least 3 characters and contain only letters, numbers, underscores, dots, or dashes.',
        formData: { name, username }
      });
    }

    // 4. Validate password strength / length
    if (password.length < 6) {
      return res.status(400).render('register', {
        title: 'Create an Account - CARTIVA',
        error: 'Password must be at least 6 characters long.',
        formData: { name, username }
      });
    }

    // Check if confirmPassword was supplied and matches
    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).render('register', {
        title: 'Create an Account - CARTIVA',
        error: 'Passwords do not match.',
        formData: { name, username }
      });
    }

    // 5. Prevent duplicate username registration
    const existingUser = await User.findOne({ username: normalizedUsername });
    if (existingUser) {
      return res.status(400).render('register', {
        title: 'Create an Account - CARTIVA',
        error: 'This username is already taken. Please choose another username.',
        formData: { name, username }
      });
    }

    // 6. Hash password using bcrypt (salt rounds = 10)
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 7. Save new user to MongoDB
    const newUser = new User({
      name: name.trim(),
      username: normalizedUsername,
      passwordHash: passwordHash,
      role: 'customer'
    });
    await newUser.save();

    // 8. Generate JWT token for immediate login
    const token = jwt.sign(
      { id: newUser._id, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // 9. Store JWT in HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });

    // 10. Merge guest cart from cookies/session into user's database cart
    await mergeGuestCartAndOrders(req, res, newUser);

    // 11. Redirect to intended destination (e.g. /checkout) or products page
    const destination = req.session && req.session.returnTo ? req.session.returnTo : '/products';
    if (req.session) {
      delete req.session.returnTo;
    }
    const redirectUrl = destination + (destination.includes('?') ? '&' : '?') + 'success=' + encodeURIComponent('Account created successfully! Welcome to CARTIVA.');
    return res.redirect(redirectUrl);
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).render('register', {
      title: 'Create an Account - CARTIVA',
      error: 'An error occurred during registration. Please try again.',
      formData: { name: req.body.name, username: req.body.username }
    });
  }
});

// ==========================================
// LOGIN ROUTES
// ==========================================

// GET /login - Display login form
router.get('/login', (req, res) => {
  if (req.user) {
    return res.redirect('/products');
  }
  res.render('login', {
    title: 'Sign In - CARTIVA',
    error: req.query.error || null,
    success: req.query.success || null,
    username: ''
  });
});

// POST /login - Process user login
router.post('/login', async (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress;

  // Check rate limit
  if (isRateLimited(clientIp)) {
    return res.status(429).render('login', {
      title: 'Sign In - CARTIVA',
      error: 'Too many failed login attempts. Please wait 15 minutes before trying again.',
      success: null,
      username: req.body.username || ''
    });
  }

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).render('login', {
        title: 'Sign In - CARTIVA',
        error: 'Please provide both username and password.',
        success: null,
        username: username || ''
      });
    }

    // 1. Look up user by lowercase username
    const normalizedUsername = username.trim().toLowerCase();
    const user = await User.findOne({ username: normalizedUsername });

    // 2. If user does not exist or password is incorrect
    if (!user) {
      recordFailedAttempt(clientIp);
      return res.status(401).render('login', {
        title: 'Sign In - CARTIVA',
        error: 'Invalid username or password.',
        success: null,
        username: normalizedUsername
      });
    }

    // 3. Verify password hash using bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      recordFailedAttempt(clientIp);
      return res.status(401).render('login', {
        title: 'Sign In - CARTIVA',
        error: 'Invalid username or password.',
        success: null,
        username: normalizedUsername
      });
    }

    // Login successful: reset rate limit attempts for this IP
    clearRateLimit(clientIp);

    // 4. Generate JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // 5. Set secure HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    });

    // 6. Merge guest cart from cookies/session into user's database cart
    await mergeGuestCartAndOrders(req, res, user);

    // 7. Redirect to intended destination (e.g. /checkout) or appropriate page
    const destination = req.session && req.session.returnTo ? req.session.returnTo : (user.role === 'admin' ? '/admin/products' : '/products');
    if (req.session) {
      delete req.session.returnTo;
    }

    return res.redirect(destination);
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).render('login', {
      title: 'Sign In - CARTIVA',
      error: 'An unexpected error occurred during login. Please try again.',
      success: null,
      username: req.body.username || ''
    });
  }
});

// ==========================================
// LOGOUT ROUTE
// ==========================================

// GET or POST /logout - Clear authentication cookie and redirect
router.all('/logout', (req, res) => {
  // Clear the JWT authentication cookie
  res.clearCookie('token');
  res.redirect('/?success=' + encodeURIComponent('You have been logged out successfully.'));
});

export default router;
