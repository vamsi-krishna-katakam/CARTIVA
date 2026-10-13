import express from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import User from '../models/User.js';

const router = express.Router();

/**
 * Helper function to retrieve cart items from database (if logged in), session, or guest cookie
 */
function getSessionCart(req) {
  // 1. If logged in and user has a database cart, use it
  if (req.user && Array.isArray(req.user.cart) && req.user.cart.length > 0) {
    req.session.cart = req.user.cart.map(item => ({
      productId: item.productId.toString(),
      quantity: item.quantity
    }));
    return req.session.cart;
  }

  // 2. Check session cart
  if (req.session && Array.isArray(req.session.cart) && req.session.cart.length > 0) {
    return req.session.cart;
  }

  // 3. Fallback to guest_cart cookie
  if (req.cookies && req.cookies.guest_cart) {
    try {
      const parsed = JSON.parse(req.cookies.guest_cart);
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (req.session) req.session.cart = parsed;
        return parsed;
      }
    } catch (e) {
      // Ignore invalid JSON in cookie
    }
  }

  if (!req.session.cart) {
    req.session.cart = [];
  }
  return req.session.cart;
}

/**
 * Helper function to persist cart state to session, cookies (guest), or database (logged in)
 */
async function persistCart(req, res, cart) {
  if (req.session) {
    req.session.cart = cart;
  }

  if (req.user) {
    // Authenticated user: save persistently to MongoDB User document
    const dbCart = cart.map(item => ({
      productId: new mongoose.Types.ObjectId(item.productId),
      quantity: item.quantity
    }));
    await User.findByIdAndUpdate(req.user._id, { cart: dbCart });
    req.user.cart = dbCart;
    // Clear guest cookie now that cart is tied to user account in database
    res.clearCookie('guest_cart');
  } else {
    // Guest mode: save cart in cookie for 30 days
    res.cookie('guest_cart', JSON.stringify(cart), {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax'
    });
  }
}

// ==========================================
// VIEW SHOPPING CART
// ==========================================

// GET /cart - View current items in the cart
router.get('/cart', async (req, res) => {
  try {
    const rawCart = getSessionCart(req);

    // If session cart is empty, render empty state immediately
    if (rawCart.length === 0) {
      return res.render('cart', {
        title: 'Your Cart - CARTIVA',
        cartItems: [],
        grandTotal: 0,
        totalItemsCount: 0,
        error: req.query.error || null,
        success: req.query.success || null
      });
    }

    // Extract valid product IDs
    const validIds = rawCart
      .map(item => item.productId)
      .filter(id => mongoose.Types.ObjectId.isValid(id));

    // Fetch up-to-date products from MongoDB (never trust client prices)
    const products = await Product.find({ _id: { $in: validIds } });

    // Map database products by ID string for quick lookup
    const productMap = {};
    products.forEach(p => {
      productMap[p._id.toString()] = p;
    });

    const activeCartItems = [];
    let grandTotal = 0;
    let totalItemsCount = 0;
    let cartModified = false;

    // Build the verified cart list
    for (const item of rawCart) {
      const product = productMap[item.productId];

      // If the product still exists in the database
      if (product) {
        // Enforce maximum quantity based on available stock
        let qty = parseInt(item.quantity, 10);
        if (isNaN(qty) || qty < 1) qty = 1;

        if (product.stock > 0 && qty > product.stock) {
          qty = product.stock;
          item.quantity = qty;
          cartModified = true;
        }

        const subtotal = product.price * qty;
        grandTotal += subtotal;
        totalItemsCount += qty;

        activeCartItems.push({
          product: product,
          quantity: qty,
          subtotal: subtotal
        });
      } else {
        // Product was deleted from database; flag cart for cleanup
        cartModified = true;
      }
    }

    // Clean up stale or invalid items from session cart if any were found
    if (cartModified) {
      const cleanedCart = activeCartItems.map(item => ({
        productId: item.product._id.toString(),
        quantity: item.quantity
      }));
      await persistCart(req, res, cleanedCart);
    }

    res.render('cart', {
      title: 'Your Cart - CARTIVA',
      cartItems: activeCartItems,
      grandTotal: parseFloat(grandTotal.toFixed(2)),
      totalItemsCount: totalItemsCount,
      error: req.query.error || null,
      success: req.query.success || null
    });
  } catch (error) {
    console.error('Error rendering cart:', error);
    res.status(500).render('error', {
      title: 'Cart Error - CARTIVA',
      message: 'Failed to display your shopping cart.'
    });
  }
});

// ==========================================
// ADD PRODUCT TO CART
// ==========================================

// POST /cart/add - Add a product to the cart
router.post('/cart/add', async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    // 1. Validate product ID
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.redirect('/products?error=' + encodeURIComponent('Invalid product selection.'));
    }

    // 2. Validate quantity (must be positive integer)
    let qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      qty = 1;
    }

    // 3. Retrieve product from database to verify existence and stock
    const product = await Product.findById(productId);
    if (!product) {
      return res.redirect('/products?error=' + encodeURIComponent('Product not found.'));
    }

    if (product.stock <= 0) {
      return res.redirect(`/products/${productId}?error=` + encodeURIComponent('This product is currently out of stock.'));
    }

    const cart = getSessionCart(req);

    // 4. Check if product already exists in cart
    const existingItem = cart.find(item => item.productId === productId);

    if (existingItem) {
      const newTotalQty = existingItem.quantity + qty;
      if (newTotalQty > product.stock) {
        existingItem.quantity = product.stock;
        return res.redirect('/cart?error=' + encodeURIComponent(`Cannot add more. Limited to ${product.stock} available in stock.`));
      } else {
        existingItem.quantity = newTotalQty;
      }
    } else {
      // Add new entry
      const actualQty = Math.min(qty, product.stock);
      cart.push({
        productId: productId,
        quantity: actualQty
      });
    }

    await persistCart(req, res, cart);
    res.redirect('/cart?success=' + encodeURIComponent(`Added ${product.name} to your cart.`));
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.redirect('/cart?error=' + encodeURIComponent('Could not add item to cart.'));
  }
});

// ==========================================
// UPDATE CART QUANTITY
// ==========================================

// POST /cart/update - Increase, decrease, or set quantity
router.post('/cart/update', async (req, res) => {
  try {
    const { productId, action, quantity } = req.body;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.redirect('/cart?error=' + encodeURIComponent('Invalid item.'));
    }

    const product = await Product.findById(productId);
    if (!product) {
      // If product no longer exists, remove it from cart
      const updatedCart = getSessionCart(req).filter(item => item.productId !== productId);
      await persistCart(req, res, updatedCart);
      return res.redirect('/cart?error=' + encodeURIComponent('Item is no longer available.'));
    }

    const cart = getSessionCart(req);
    const itemIndex = cart.findIndex(item => item.productId === productId);

    if (itemIndex > -1) {
      if (action === 'increase') {
        if (cart[itemIndex].quantity < product.stock) {
          cart[itemIndex].quantity += 1;
        } else {
          return res.redirect('/cart?error=' + encodeURIComponent(`Maximum stock available is ${product.stock}.`));
        }
      } else if (action === 'decrease') {
        cart[itemIndex].quantity -= 1;
        if (cart[itemIndex].quantity <= 0) {
          // Remove item if quantity falls to zero
          cart.splice(itemIndex, 1);
        }
      } else if (quantity !== undefined) {
        const parsedQty = parseInt(quantity, 10);
        if (parsedQty <= 0) {
          cart.splice(itemIndex, 1);
        } else {
          cart[itemIndex].quantity = Math.min(parsedQty, product.stock);
        }
      }
    }

    await persistCart(req, res, cart);
    res.redirect('/cart');
  } catch (error) {
    console.error('Error updating cart:', error);
    res.redirect('/cart?error=' + encodeURIComponent('Could not update cart quantity.'));
  }
});

// ==========================================
// REMOVE ITEM FROM CART
// ==========================================

// POST /cart/remove - Remove a single product from the cart
router.post('/cart/remove', async (req, res) => {
  try {
    const { productId } = req.body;
    const cart = getSessionCart(req);

    const updatedCart = cart.filter(item => item.productId !== productId);
    await persistCart(req, res, updatedCart);
    res.redirect('/cart?success=' + encodeURIComponent('Item removed from cart.'));
  } catch (error) {
    console.error('Error removing cart item:', error);
    res.redirect('/cart?error=' + encodeURIComponent('Could not remove item.'));
  }
});

export default router;
