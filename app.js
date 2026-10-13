// Load environment variables from .env file
import 'dotenv/config';

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import session from 'express-session';

// Import authentication middleware
import { attachUser } from './middleware/auth.js';

// Import application route modules
import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize the Express application
const app = express();

// Set configuration variables
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cartiva';

// ==========================================
// DATABASE CONNECTION
// ==========================================
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✓ Successfully connected to MongoDB:', MONGODB_URI);
  })
  .catch((err) => {
    console.error('✗ MongoDB connection error:', err.message);
    console.error('Please ensure the MongoDB service is running.');
  });

// ==========================================
// VIEW ENGINE CONFIGURATION
// ==========================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ==========================================
// CORE MIDDLEWARE SETUP
// ==========================================

// Parse URL-encoded bodies from HTML forms
app.use(express.urlencoded({ extended: true }));

// Parse JSON request bodies
app.use(express.json());

// Parse cookies (used for JWT authentication)
app.use(cookieParser());

// Serve static assets (CSS, client JS, images) from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Configure session middleware (used for guest shopping cart)
app.use(session({
  secret: process.env.SESSION_SECRET || 'cartiva_session_secret_default_key',
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// Identify authenticated user from JWT cookie on every request
app.use(attachUser);

// Global middleware to provide common template variables
app.use((req, res, next) => {
  // Compute total items currently in cart for header badge (checks user cart, session, or guest cookie)
  let activeCart = [];
  if (req.user && Array.isArray(req.user.cart) && req.user.cart.length > 0) {
    activeCart = req.user.cart;
  } else if (req.session && Array.isArray(req.session.cart) && req.session.cart.length > 0) {
    activeCart = req.session.cart;
  } else if (req.cookies && req.cookies.guest_cart) {
    try {
      const parsed = JSON.parse(req.cookies.guest_cart);
      if (Array.isArray(parsed)) {
        activeCart = parsed;
        if (req.session) req.session.cart = parsed;
      }
    } catch (e) {
      activeCart = [];
    }
  }

  const totalCartCount = activeCart.reduce((total, item) => {
    const qty = parseInt(item.quantity, 10);
    return total + (isNaN(qty) ? 0 : qty);
  }, 0);

  res.locals.cartCount = totalCartCount;
  res.locals.currentPath = req.path;
  res.locals.flashSuccess = req.query.success || null;
  res.locals.flashError = req.query.error || null;
  next();
});

// ==========================================
// APPLICATION ROUTES
// ==========================================
app.use('/', authRoutes);
app.use('/', productRoutes);
app.use('/', cartRoutes);
app.use('/', orderRoutes);
app.use('/admin', adminRoutes);

// ==========================================
// 404 NOT FOUND HANDLER
// ==========================================
app.use((req, res) => {
  res.status(404).render('error', {
    title: '404 Page Not Found - CARTIVA',
    message: `The page "${req.originalUrl}" does not exist on CARTIVA.`
  });
});

// ==========================================
// GLOBAL ERROR HANDLER
// ==========================================
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err);
  res.status(500).render('error', {
    title: '500 Server Error - CARTIVA',
    message: 'An unexpected server error occurred. Please try again shortly.'
  });
});

// Start the HTTP server only if not in testing mode
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`CARTIVA Server running at: http://localhost:${PORT}`);
    console.log(`===============================================`);
  });
}

export default app;
