import express from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product.js';

const router = express.Router();

// ==========================================
// HOMEPAGE
// ==========================================

// GET / - Homepage with Hero section and Featured Products
router.get('/', async (req, res) => {
  try {
    // Fetch top 6 featured products to display on the homepage
    const featuredProducts = await Product.find().sort({ createdAt: -1 }).limit(6);
    
    // Fetch unique categories for category highlights
    const categories = await Product.distinct('category');

    res.render('home', {
      title: 'CARTIVA — Modern Essentials for Home, Work & Everyday Life',
      featuredProducts: featuredProducts,
      categories: categories,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (error) {
    console.error('Error loading homepage:', error);
    res.status(500).render('error', {
      title: 'Server Error - CARTIVA',
      message: 'Unable to load homepage products at this time.'
    });
  }
});

// ==========================================
// PRODUCT CATALOG (SEARCH, FILTER, SORT)
// ==========================================

// GET /products - Full product catalog with search, category filtering, and sorting
router.get('/products', async (req, res) => {
  try {
    const { search, category, sort } = req.query;

    // 1. Build database query filter dynamically
    const queryFilter = {};

    // Search by product name if search query is provided
    if (search && search.trim() !== '') {
      // Escape any special regex characters to prevent regex injection
      const safeSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      queryFilter.name = { $regex: safeSearch, $options: 'i' };
    }

    // Filter by specific category if selected
    if (category && category.trim() !== '' && category !== 'All') {
      queryFilter.category = category.trim();
    }

    // 2. Configure sorting option
    let sortOption = { createdAt: -1 }; // Default to newest items first
    if (sort === 'price_asc') {
      sortOption = { price: 1 };
    } else if (sort === 'price_desc') {
      sortOption = { price: -1 };
    } else if (sort === 'name_asc') {
      sortOption = { name: 1 };
    }

    // 3. Query MongoDB for products
    const products = await Product.find(queryFilter).sort(sortOption);

    // 4. Fetch list of all unique categories for the filter dropdown
    const allCategories = await Product.distinct('category');

    res.render('products', {
      title: 'Products - CARTIVA',
      products: products,
      categories: allCategories,
      selectedCategory: category || 'All',
      searchQuery: search || '',
      selectedSort: sort || '',
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).render('error', {
      title: 'Server Error - CARTIVA',
      message: 'Failed to retrieve products from the database.'
    });
  }
});

// ==========================================
// PRODUCT DETAILS PAGE
// ==========================================

// GET /products/:id - Single product details
router.get('/products/:id', async (req, res) => {
  try {
    const productId = req.params.id;

    // Validate that the parameter is a valid 24-character hex MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(404).render('error', {
        title: 'Product Not Found - CARTIVA',
        message: 'The requested product could not be found.'
      });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).render('error', {
        title: 'Product Not Found - CARTIVA',
        message: 'The requested product does not exist in our catalog.'
      });
    }

    // Fetch up to 4 related products from the same category
    const relatedProducts = await Product.find({
      category: product.category,
      _id: { $ne: product._id }
    }).limit(4);

    res.render('product-details', {
      title: `${product.name} - CARTIVA`,
      product: product,
      relatedProducts: relatedProducts,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (error) {
    console.error('Error fetching product details:', error);
    res.status(500).render('error', {
      title: 'Server Error - CARTIVA',
      message: 'Failed to retrieve product details.'
    });
  }
});

export default router;
