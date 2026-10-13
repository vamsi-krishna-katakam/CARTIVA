import express from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * Helper to fetch verified cart items from database
 */
async function getVerifiedCart(req) {
  let sessionCart = [];
  if (req.user && Array.isArray(req.user.cart) && req.user.cart.length > 0) {
    sessionCart = req.user.cart.map(i => ({
      productId: i.productId.toString(),
      quantity: i.quantity
    }));
  } else if (req.session && req.session.cart && req.session.cart.length > 0) {
    sessionCart = req.session.cart;
  } else if (req.cookies && req.cookies.guest_cart) {
    try {
      sessionCart = JSON.parse(req.cookies.guest_cart);
    } catch (e) {
      sessionCart = [];
    }
  }

  if (sessionCart.length === 0) {
    return { items: [], grandTotal: 0 };
  }

  const validIds = sessionCart
    .map(i => i.productId)
    .filter(id => mongoose.Types.ObjectId.isValid(id));

  const products = await Product.find({ _id: { $in: validIds } });
  const productMap = {};
  products.forEach(p => {
    productMap[p._id.toString()] = p;
  });

  const items = [];
  let grandTotal = 0;

  for (const sessionItem of sessionCart) {
    const product = productMap[sessionItem.productId];
    if (product) {
      let qty = parseInt(sessionItem.quantity, 10);
      if (isNaN(qty) || qty < 1) qty = 1;
      const subtotal = product.price * qty;
      grandTotal += subtotal;

      items.push({
        product: product,
        name: product.name,
        price: product.price,
        quantity: qty,
        subtotal: subtotal
      });
    }
  }

  return {
    items,
    grandTotal: parseFloat(grandTotal.toFixed(2))
  };
}

// ==========================================
// CHECKOUT PAGE
// ==========================================

// GET /checkout - Display checkout form and order review (Login required)
router.get('/checkout', requireAuth, async (req, res) => {
  try {
    const { items, grandTotal } = await getVerifiedCart(req);

    if (items.length === 0) {
      return res.redirect('/cart?error=' + encodeURIComponent('Your cart is empty. Add products before checking out.'));
    }

    res.render('checkout', {
      title: 'Checkout - CARTIVA',
      cartItems: items,
      grandTotal: grandTotal,
      error: req.query.error || null,
      formData: {
        fullName: req.user ? req.user.name : '',
        address: '',
        city: '',
        state: '',
        postalCode: ''
      }
    });
  } catch (error) {
    console.error('Error opening checkout:', error);
    res.status(500).render('error', {
      title: 'Checkout Error - CARTIVA',
      message: 'Could not load the checkout page.'
    });
  }
});

// POST /checkout - Process order submission (Login required)
router.post('/checkout', requireAuth, async (req, res) => {
  try {
    const { fullName, address, city, state, postalCode } = req.body;

    // 1. Validate shipping address fields
    if (!fullName || !address || !city || !state || !postalCode) {
      const { items, grandTotal } = await getVerifiedCart(req);
      return res.status(400).render('checkout', {
        title: 'Checkout - CARTIVA',
        cartItems: items,
        grandTotal: grandTotal,
        error: 'Please fill in all required shipping address fields.',
        formData: req.body
      });
    }

    const { items } = await getVerifiedCart(req);
    if (items.length === 0) {
      return res.redirect('/cart?error=' + encodeURIComponent('Your cart is empty.'));
    }

    // 2. Validate stock availability for each item and prepare order items
    const orderItems = [];
    let calculatedTotal = 0;

    for (const item of items) {
      const dbProduct = await Product.findById(item.product._id);

      if (!dbProduct) {
        return res.redirect('/cart?error=' + encodeURIComponent(`"${item.name}" is no longer available.`));
      }

      if (dbProduct.stock < item.quantity) {
        return res.redirect(
          '/cart?error=' + encodeURIComponent(`Insufficient stock for "${dbProduct.name}". Only ${dbProduct.stock} left.`)
        );
      }

      const itemSubtotal = dbProduct.price * item.quantity;
      calculatedTotal += itemSubtotal;

      orderItems.push({
        product: dbProduct._id,
        name: dbProduct.name,
        price: dbProduct.price,
        quantity: item.quantity
      });
    }

    // 3. Deduct purchased stock from database
    for (const item of items) {
      await Product.findByIdAndUpdate(item.product._id, {
        $inc: { stock: -item.quantity }
      });
    }

    // 4. Create and save new order in MongoDB (guaranteed to be linked to user)
    const newOrder = new Order({
      user: req.user._id,
      items: orderItems,
      shippingAddress: {
        fullName: fullName.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        postalCode: postalCode.trim()
      },
      total: parseFloat(calculatedTotal.toFixed(2)),
      status: 'Processing'
    });

    await newOrder.save();

    // 5. Clear both session cart, user's database cart, and guest cookie
    req.session.cart = [];
    if (req.user) {
      req.user.cart = [];
      await User.findByIdAndUpdate(req.user._id, { cart: [] });
    }
    res.clearCookie('guest_cart');

    // 6. Redirect to confirmation page
    res.redirect(`/orders/confirmation/${newOrder._id}`);
  } catch (error) {
    console.error('Checkout processing error:', error);
    res.status(500).render('error', {
      title: 'Checkout Failed - CARTIVA',
      message: 'An error occurred while placing your order. Please try again.'
    });
  }
});

// ==========================================
// ORDER CONFIRMATION
// ==========================================

// GET /orders/confirmation/:id - View post-purchase confirmation
router.get('/orders/confirmation/:id', async (req, res) => {
  try {
    const orderId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(404).render('error', {
        title: 'Order Not Found - CARTIVA',
        message: 'Invalid order identifier.'
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).render('error', {
        title: 'Order Not Found - CARTIVA',
        message: 'Order confirmation could not be found.'
      });
    }

    res.render('order-details', {
      title: `Order Confirmation #${order._id.toString().slice(-6).toUpperCase()} - CARTIVA`,
      order: order,
      isConfirmation: true,
      success: 'Thank you for your purchase! Your order has been placed successfully.'
    });
  } catch (error) {
    console.error('Error fetching confirmation:', error);
    res.status(500).render('error', {
      title: 'Error - CARTIVA',
      message: 'Failed to display order confirmation.'
    });
  }
});

// ==========================================
// CUSTOMER ORDER HISTORY
// ==========================================

// GET /orders - View logged-in customer's order history
router.get('/orders', requireAuth, async (req, res) => {
  try {
    // Only fetch orders belonging to the logged-in user
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });

    res.render('orders', {
      title: 'My Orders - CARTIVA',
      orders: orders
    });
  } catch (error) {
    console.error('Error loading order history:', error);
    res.status(500).render('error', {
      title: 'Orders Error - CARTIVA',
      message: 'Could not retrieve your orders at this time.'
    });
  }
});

// ==========================================
// ORDER DETAILS WITH STRICT OWNERSHIP CHECK
// ==========================================

// GET /orders/:id - View specific order details
router.get('/orders/:id', requireAuth, async (req, res) => {
  try {
    const orderId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(404).render('error', {
        title: 'Order Not Found - CARTIVA',
        message: 'Invalid order identifier.'
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).render('error', {
        title: 'Order Not Found - CARTIVA',
        message: 'The requested order does not exist.'
      });
    }

    // STRICT OWNERSHIP VERIFICATION:
    // Only the customer who placed the order or an administrator can view this order
    const isOwner = order.user && order.user.equals(req.user._id);
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).render('error', {
        title: '403 Forbidden - CARTIVA',
        message: 'Access denied: You do not have permission to view this order.'
      });
    }

    res.render('order-details', {
      title: `Order #${order._id.toString().slice(-6).toUpperCase()} - CARTIVA`,
      order: order,
      isConfirmation: false,
      success: null
    });
  } catch (error) {
    console.error('Error loading order details:', error);
    res.status(500).render('error', {
      title: 'Order Details Error - CARTIVA',
      message: 'Failed to display order details.'
    });
  }
});

export default router;
