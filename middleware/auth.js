import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * attachUser Middleware
 * Runs on every request. Inspects the HTTP-only 'token' cookie.
 * If valid, decodes the user payload and attaches user data to req.user and res.locals.currentUser.
 * If token is missing, expired, or invalid, safely clears the cookie and leaves currentUser null.
 */
async function attachUser(req, res, next) {
  // Always initialize res.locals.currentUser so EJS templates can safely access it
  res.locals.currentUser = null;
  req.user = null;

  const token = req.cookies && req.cookies.token;
  if (!token) {
    return next();
  }

  try {
    // Verify token using secret stored in environment variables
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user from database to ensure account still exists and has current role
    const user = await User.findById(decoded.id).select('-passwordHash');

    if (user) {
      req.user = user;
      res.locals.currentUser = user;

      // Ensure session cart is populated from user's persistent MongoDB cart
      if (req.session && (!req.session.cart || req.session.cart.length === 0) && user.cart && user.cart.length > 0) {
        req.session.cart = user.cart.map(item => ({
          productId: item.productId.toString(),
          quantity: item.quantity
        }));
      }
    } else {
      // User ID from token was not found in database; clear stale cookie
      res.clearCookie('token');
    }
  } catch (error) {
    // If token verification fails (expired or tampered), clear cookie
    res.clearCookie('token');
  }

  next();
}

/**
 * requireAuth Middleware
 * Protects routes requiring customer login (such as order history).
 * Redirects unauthenticated users to the login page.
 */
function requireAuth(req, res, next) {
  if (!req.user) {
    // Save intended destination so user can be redirected back after logging in
    if (req.session) {
      req.session.returnTo = req.originalUrl;
    }
    return res.redirect('/login?error=' + encodeURIComponent('Please log in to continue.'));
  }
  next();
}

/**
 * requireAdmin Middleware
 * Protects administrative routes (/admin/*).
 * Verifies that the user is logged in AND has role === 'admin'.
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    if (req.session) {
      req.session.returnTo = req.originalUrl;
    }
    return res.redirect('/login?error=' + encodeURIComponent('Administrator login required.'));
  }

  if (req.user.role !== 'admin') {
    return res.status(403).render('error', {
      title: '403 Forbidden - CARTIVA',
      message: 'Access denied: You do not have administrator permissions to access this page.'
    });
  }

  next();
}

export {
  attachUser,
  requireAuth,
  requireAdmin
};
