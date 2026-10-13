import mongoose from 'mongoose';

// Item sub-schema preserving a snapshot of product details at checkout time
const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  }
}, { _id: false });

// Schema definition for CARTIVA orders
const orderSchema = new mongoose.Schema({
  // Customer reference (populated if user was logged in during checkout)
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  items: {
    type: [orderItemSchema],
    validate: [
      function(val) {
        return val && val.length > 0;
      },
      'Order must contain at least one item'
    ]
  },
  shippingAddress: {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true
    },
    address: {
      type: String,
      required: [true, 'Shipping street address is required'],
      trim: true
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true
    },
    state: {
      type: String,
      required: [true, 'State or province is required'],
      trim: true
    },
    postalCode: {
      type: String,
      required: [true, 'Postal code is required'],
      trim: true
    }
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['Processing', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Processing'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Order', orderSchema);
