// Load environment variables
import 'dotenv/config';

import mongoose from 'mongoose';
import Product from '../models/Product.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cartiva';

// Sample curated catalog for CARTIVA (16 products across 4 categories)
const sampleProducts = [
  // 1. Home Essentials
  {
    name: 'Minimalist Ceramic Table Lamp',
    description: 'Warm ambient lighting housed in handcrafted stoneware ceramic with a textured linen shade. Perfect for bedside tables and living room reading nooks.',
    price: 49.99,
    category: 'Home Essentials',
    image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=80',
    stock: 15
  },
  {
    name: 'Woven Cotton Throw Blanket',
    description: '100% organic breathable cotton woven blanket featuring a subtle herringbone weave and knotted fringe tassels. Measures 50 x 60 inches.',
    price: 38.50,
    category: 'Home Essentials',
    image: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=800&q=80',
    stock: 22
  },
  {
    name: 'Matte White Ceramic Vase',
    description: 'Contemporary sculptural flower vase made from kiln-fired ceramic with a smooth tactile matte finish. Ideal for dried botanicals or fresh eucalyptus.',
    price: 24.00,
    category: 'Home Essentials',
    image: 'https://images.unsplash.com/photo-1612196808214-b8e1d6145a8c?auto=format&fit=crop&w=800&q=80',
    stock: 18
  },
  {
    name: 'Nordic Oak Floating Wall Shelf',
    description: 'Sustainably sourced solid white oak shelf with hidden heavy-duty wall mounting brackets. Holds books, plants, and art prints securely.',
    price: 42.00,
    category: 'Home Essentials',
    image: 'https://images.unsplash.com/photo-1594026112284-02bb6f3352fe?auto=format&fit=crop&w=800&q=80',
    stock: 12
  },

  // 2. Kitchen Accessories
  {
    name: 'Ceramic Pour-Over Coffee Dripper',
    description: 'Precision ribbed interior designed for optimal extraction flow rate. Compatible with standard cone paper filters for the cleanest morning cup.',
    price: 26.50,
    category: 'Kitchen Accessories',
    image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80',
    stock: 30
  },
  {
    name: 'Cast Iron Dutch Oven 5.5 Qt',
    description: 'Heavyweight enameled cast iron pot with tight-fitting condensation lid. Superior heat retention for artisan sourdough bread and slow stews.',
    price: 79.00,
    category: 'Kitchen Accessories',
    image: 'https://images.unsplash.com/photo-1585515320310-259814833e62?auto=format&fit=crop&w=800&q=80',
    stock: 8
  },
  {
    name: 'Acacia Wood End-Grain Cutting Board',
    description: 'Natural moisture-resistant acacia hardwood butcher block. Gentle on knife edges and includes a deep perimeter juice groove.',
    price: 34.99,
    category: 'Kitchen Accessories',
    image: 'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?auto=format&fit=crop&w=800&q=80',
    stock: 16
  },
  {
    name: 'Stoneware Everyday Coffee Mugs (Set of 2)',
    description: 'Ergonomic dual-tone reactive glazed ceramic coffee cups with comfortable loop handles. 14 oz capacity, dishwasher and microwave safe.',
    price: 22.00,
    category: 'Kitchen Accessories',
    image: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=800&q=80',
    stock: 25
  },

  // 3. Office Supplies
  {
    name: 'Full-Grain Leather Desk Mat',
    description: 'Smooth oil-waxed leather desk protector pad providing an ultra-responsive mouse glide and an elevated aesthetic for workspace setups.',
    price: 45.00,
    category: 'Office Supplies',
    image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=800&q=80',
    stock: 14
  },
  {
    name: 'Solid Walnut Laptop Stand',
    description: 'Ergonomically angled wooden stand elevating laptop displays by 5.5 inches for improved posture, neck comfort, and laptop cooling.',
    price: 52.50,
    category: 'Office Supplies',
    image: 'https://images.unsplash.com/photo-1588702547919-26089e690ecc?auto=format&fit=crop&w=800&q=80',
    stock: 10
  },
  {
    name: 'Aluminum Matte Mechanical Pencil Set',
    description: 'Aircraft-grade anodized aluminum body pencil with knurled grip and 0.5mm brass drafting lead mechanism. Includes refill leads.',
    price: 18.00,
    category: 'Office Supplies',
    image: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=800&q=80',
    stock: 40
  },
  {
    name: 'Hardcover Linen Grid Notebook',
    description: '192 numbered pages of 120gsm ink-proof bleed-resistant archival paper with smyth-sewn lay-flat binding and ribbon marker.',
    price: 16.50,
    category: 'Office Supplies',
    image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
    stock: 35
  },

  // 4. Lifestyle
  {
    name: 'Heavyweight Canvas Weekend Tote',
    description: 'Durable 16oz natural cotton canvas duffle bag with reinforced vegetable-tanned leather handles and an interior zippered valuables pocket.',
    price: 58.00,
    category: 'Lifestyle',
    image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80',
    stock: 11
  },
  {
    name: 'Double-Walled Insulated Water Bottle',
    description: '32 oz stainless steel thermal flask keeping beverages cold for 24 hours or steaming hot for 12 hours. Matte powder-coat scratch-proof exterior.',
    price: 28.00,
    category: 'Lifestyle',
    image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=800&q=80',
    stock: 28
  },
  {
    name: 'Soy Wax Aromatherapy Candle',
    description: 'Hand-poured 100% natural soy wax candle scented with cedarwood, amber, and wild bergamot. Lead-free cotton wick with 55 hour burn time.',
    price: 21.00,
    category: 'Lifestyle',
    image: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=800&q=80',
    stock: 19
  },
  {
    name: 'Polarized Acetate Sunglasses',
    description: 'Handmade plant-based cellulose acetate frames fitted with UV400 polarized anti-glare scratch-resistant lenses and 5-barrel hinges.',
    price: 65.00,
    category: 'Lifestyle',
    image: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=800&q=80',
    stock: 15
  }
];

async function seedDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB:', MONGODB_URI);

    // Clear existing products to ensure clean slate
    const deletedCount = await Product.deleteMany({});
    console.log(`Cleared ${deletedCount.deletedCount} existing products.`);

    // Insert new sample products
    const inserted = await Product.insertMany(sampleProducts);
    console.log(`✓ Successfully seeded ${inserted.length} sample products into CARTIVA database!`);

    console.log('\nCategories seeded:');
    const categories = await Product.distinct('category');
    categories.forEach(cat => console.log(`  - ${cat}`));

    console.log('\nSeeding complete.');
  } catch (error) {
    console.error('✗ Error seeding database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  }
}

seedDatabase();
