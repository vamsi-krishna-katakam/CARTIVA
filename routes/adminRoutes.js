import express from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Apply requireAdmin middleware to ALL admin routes
router.use(requireAdmin);

// ==========================================
// ADMIN DASHBOARD / PRODUCT LIST
// ==========================================

// GET /admin or /admin/products - List all products for management
router.get('/', (req, res) => {
  res.redirect('/admin/products');
});

router.get('/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });

    res.render('admin/products', {
      title: 'Product Management - CARTIVA Admin',
      products: products,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (error) {
    console.error('Admin product list error:', error);
    res.status(500).render('error', {
      title: 'Server Error - CARTIVA Admin',
      message: 'Failed to load products for administration.'
    });
  }
});

// ==========================================
// CREATE NEW PRODUCT
// ==========================================

// GET /admin/products/new - Form to create a new product
router.get('/products/new', (req, res) => {
  res.render('admin/product-form', {
    title: 'Add New Product - CARTIVA Admin',
    isEdit: false,
    product: {
      name: '',
      description: '',
      price: '',
      category: '',
      image: '',
      stock: 10
    },
    error: null
  });
});

// POST /admin/products/new - Handle creation of a new product
router.post('/products/new', async (req, res) => {
  try {
    const { name, description, price, category, image, stock } = req.body;

    // Validation
    if (!name || !description || !price || !category || !image) {
      return res.status(400).render('admin/product-form', {
        title: 'Add New Product - CARTIVA Admin',
        isEdit: false,
        product: req.body,
        error: 'All fields are required.'
      });
    }

    const numericPrice = parseFloat(price);
    const numericStock = parseInt(stock, 10);

    if (isNaN(numericPrice) || numericPrice < 0) {
      return res.status(400).render('admin/product-form', {
        title: 'Add New Product - CARTIVA Admin',
        isEdit: false,
        product: req.body,
        error: 'Price must be a valid positive number.'
      });
    }

    if (isNaN(numericStock) || numericStock < 0) {
      return res.status(400).render('admin/product-form', {
        title: 'Add New Product - CARTIVA Admin',
        isEdit: false,
        product: req.body,
        error: 'Stock must be a valid non-negative number.'
      });
    }

    const newProduct = new Product({
      name: name.trim(),
      description: description.trim(),
      price: numericPrice,
      category: category.trim(),
      image: image.trim(),
      stock: numericStock
    });

    await newProduct.save();

    res.redirect('/admin/products?success=' + encodeURIComponent(`Product "${newProduct.name}" created successfully.`));
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).render('admin/product-form', {
      title: 'Add New Product - CARTIVA Admin',
      isEdit: false,
      product: req.body,
      error: 'Failed to create product. ' + error.message
    });
  }
});

// ==========================================
// EDIT EXISTING PRODUCT
// ==========================================

// GET /admin/products/:id/edit - Form to edit product
router.get('/products/:id/edit', async (req, res) => {
  try {
    const productId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.redirect('/admin/products?error=' + encodeURIComponent('Invalid product ID.'));
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.redirect('/admin/products?error=' + encodeURIComponent('Product not found.'));
    }

    res.render('admin/product-form', {
      title: `Edit ${product.name} - CARTIVA Admin`,
      isEdit: true,
      product: product,
      error: null
    });
  } catch (error) {
    console.error('Error opening product edit form:', error);
    res.redirect('/admin/products?error=' + encodeURIComponent('Could not load edit form.'));
  }
});

// POST /admin/products/:id/edit - Update existing product
router.post('/products/:id/edit', async (req, res) => {
  const productId = req.params.id;

  try {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.redirect('/admin/products?error=' + encodeURIComponent('Invalid product ID.'));
    }

    const { name, description, price, category, image, stock } = req.body;

    if (!name || !description || !price || !category || !image) {
      return res.status(400).render('admin/product-form', {
        title: 'Edit Product - CARTIVA Admin',
        isEdit: true,
        product: { _id: productId, ...req.body },
        error: 'All fields are required.'
      });
    }

    const numericPrice = parseFloat(price);
    const numericStock = parseInt(stock, 10);

    if (isNaN(numericPrice) || numericPrice < 0) {
      return res.status(400).render('admin/product-form', {
        title: 'Edit Product - CARTIVA Admin',
        isEdit: true,
        product: { _id: productId, ...req.body },
        error: 'Price must be a valid positive number.'
      });
    }

    if (isNaN(numericStock) || numericStock < 0) {
      return res.status(400).render('admin/product-form', {
        title: 'Edit Product - CARTIVA Admin',
        isEdit: true,
        product: { _id: productId, ...req.body },
        error: 'Stock must be a valid non-negative number.'
      });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      {
        name: name.trim(),
        description: description.trim(),
        price: numericPrice,
        category: category.trim(),
        image: image.trim(),
        stock: numericStock
      },
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.redirect('/admin/products?error=' + encodeURIComponent('Product not found.'));
    }

    res.redirect('/admin/products?success=' + encodeURIComponent(`Product "${updatedProduct.name}" updated successfully.`));
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).render('admin/product-form', {
      title: 'Edit Product - CARTIVA Admin',
      isEdit: true,
      product: { _id: productId, ...req.body },
      error: 'Failed to update product: ' + error.message
    });
  }
});

// ==========================================
// DELETE PRODUCT
// ==========================================

// POST /admin/products/:id/delete - Delete a product
router.post('/products/:id/delete', async (req, res) => {
  try {
    const productId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.redirect('/admin/products?error=' + encodeURIComponent('Invalid product ID.'));
    }

    const deletedProduct = await Product.findByIdAndDelete(productId);
    if (!deletedProduct) {
      return res.redirect('/admin/products?error=' + encodeURIComponent('Product not found.'));
    }

    res.redirect('/admin/products?success=' + encodeURIComponent(`Product "${deletedProduct.name}" has been deleted.`));
  } catch (error) {
    console.error('Error deleting product:', error);
    res.redirect('/admin/products?error=' + encodeURIComponent('Could not delete product.'));
  }
});

// ==========================================
// ADMIN ORDERS MANAGEMENT
// ==========================================

// GET /admin/orders - View all customer orders
router.get('/orders', async (req, res) => {
  try {
    const orders = await Order.find().populate('user', 'name username email').sort({ createdAt: -1 });

    res.render('admin/orders', {
      title: 'Order Management - CARTIVA Admin',
      orders: orders,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (error) {
    console.error('Admin orders error:', error);
    res.status(500).render('error', {
      title: 'Server Error - CARTIVA Admin',
      message: 'Failed to load customer orders.'
    });
  }
});

// POST /admin/orders/:id/status - Update order status
router.post('/orders/:id/status', async (req, res) => {
  try {
    const orderId = req.params.id;
    const { status } = req.body;

    const allowedStatuses = ['Processing', 'Shipped', 'Delivered', 'Cancelled'];
    if (!allowedStatuses.includes(status)) {
      return res.redirect('/admin/orders?error=' + encodeURIComponent('Invalid status value.'));
    }

    await Order.findByIdAndUpdate(orderId, { status: status });
    res.redirect('/admin/orders?success=' + encodeURIComponent('Order status updated successfully.'));
  } catch (error) {
    console.error('Error updating order status:', error);
    res.redirect('/admin/orders?error=' + encodeURIComponent('Failed to update order status.'));
  }
});

export default router;
