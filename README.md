# CARTIVA — Modern Full-Stack E-Commerce Website

**CARTIVA** is a clean, reliable, and beginner-friendly full-stack e-commerce web application built for a personal developer portfolio. It demonstrates modern web development practices using Node.js, Express, MongoDB, EJS templating, and vanilla CSS3 without any heavy front-end or CSS frameworks.

---

## 🌟 Key Features

### 🛍️ Customer Experience
- **Dynamic Storefront**: Hero banner introducing CARTIVA, value proposition badges, category highlights, and featured products.
- **Product Catalog**: Live MongoDB product retrieval with:
  - Real-time search by product title with regex sanitization.
  - Category filtering across multiple departments (*Home Essentials, Kitchen Accessories, Office Supplies, Lifestyle*).
  - Price sorting (*Low to High, High to Low, Newest First*).
  - User-friendly empty states when no products match.
- **Product Details**: High-resolution imagery, stock inventory indicators, category badges, full descriptions, and related products suggestions.
- **Shopping Cart**:
  - Session-backed guest cart requiring no login to browse and add items.
  - Real-time quantity increment/decrement controls bounded by stock.
  - Complete server-side price verification and subtotal/grand total recalculation.
  - Empty cart notification and cleanup of deleted items.
- **Streamlined Checkout**:
  - Shipping address collection and server validation.
  - Stock verification and atomic inventory decrements.
  - Demo payment method (mock checkout without third-party gateways).
  - Immediate post-purchase order confirmation screen.
- **Customer Account & Orders**:
  - Strict ownership-verified order history (`/orders`).
  - Detailed receipts displaying snapshot prices from the moment of purchase.

### 🔐 Authentication & Security
- **Secure Password Hashing**: Passwords salted and hashed with `bcryptjs`.
- **JWT Authentication**: Signed JSON Web Tokens stored securely in `httpOnly`, `sameSite: 'lax'` cookies.
- **In-Memory Rate Limiting**: Protects login routes against brute-force attacks (5 failed attempts per 15-minute window).
- **Strict Role Authorization**: Customer vs. Administrator route protection with automatic redirects.
- **Server Price Validation**: Browser-submitted prices and totals are never trusted; all computations are made against live database values.

### 🛠️ Administrator Dashboard (`/admin`)
- **Inventory Overview**: View all products in a clean management table with stock status pills.
- **Create Products**: Form to add new catalog items with auto-suggested categories.
- **Edit Products**: Update prices, descriptions, and stock counts.
- **Delete Products**: Remove obsolete catalog items.
- **Order Fulfillment**: Track all customer orders and update shipping statuses (*Processing, Shipped, Delivered, Cancelled*).

---

## 📦 Technology Stack & Essential Dependencies

| Technology / Package | Version | Purpose in CARTIVA |
| :--- | :--- | :--- |
| **Node.js** | `>=18` | JavaScript runtime engine powering server-side execution. |
| **Express.js** | `^4.21.2` | Minimalist web framework for routing, middleware, and request handling. |
| **MongoDB** | `>=6.0` | NoSQL document database storing products, orders, and user records. |
| **Mongoose** | `^8.9.5` | Object Data Modeling (ODM) library providing schemas and validation. |
| **EJS** | `^3.1.10` | Embedded JavaScript templating engine for rendering server-side HTML. |
| **Vanilla CSS3** | — | Clean, responsive custom styling (Flexbox, CSS Grid) in `public/css/style.css`. |
| **Vanilla JavaScript** | — | Minimal client script in `public/js/main.js` for alert dismissals and form UX. |
| **bcryptjs** | `^2.4.3` | Pure JavaScript library for securely hashing and verifying passwords. |
| **jsonwebtoken** | `^9.0.2` | Signs and verifies tamper-proof authentication tokens. |
| **express-session** | `^1.18.1` | Manages server-side sessions for guest shopping carts. |
| **cookie-parser** | `^1.4.7` | Parses cookie headers and populates `req.cookies` with the JWT token. |
| **dotenv** | `^16.4.7` | Loads sensitive environment variables from `.env` into `process.env`. |

*Note: CARTIVA intentionally avoids frontend frameworks (React, Next.js, Bootstrap, Tailwind, jQuery) to remain easy to explain line by line in technical interviews.*

---

## 📂 Project Structure

```text
CARTIVA/
├── models/
│   ├── User.js                 # User schema (name, email, passwordHash, role, createdAt)
│   ├── Product.js              # Product schema (name, description, price, category, image, stock)
│   └── Order.js                # Order schema (user ref, item snapshots, shippingAddress, total, status)
├── routes/
│   ├── authRoutes.js           # Registration, login with rate limiting, and logout
│   ├── productRoutes.js        # Homepage, catalog search, category filters, product details
│   ├── cartRoutes.js           # Session cart viewing, adding, quantity updating, removal
│   ├── orderRoutes.js          # Checkout, order confirmation, history, ownership check
│   └── adminRoutes.js          # Admin product CRUD and order status fulfillment
├── middleware/
│   └── auth.js                 # attachUser, requireAuth, and requireAdmin middlewares
├── views/
│   ├── partials/
│   │   ├── header.ejs          # Global navigation, search bar, active link states, flash alerts
│   │   └── footer.ejs          # Brand summary, tech badges, category links, scripts
│   ├── home.ejs                # Hero section, feature pillars, category tiles, featured products
│   ├── products.ejs            # Full catalog with search, category pills, price sorting
│   ├── product-details.ejs     # Detail view with quantity selector, stock pill, related products
│   ├── cart.ejs                # Shopping cart with quantity buttons, subtotal, order summary
│   ├── checkout.ejs            # Shipping address form and order placement
│   ├── login.ejs               # Customer sign in form
│   ├── register.ejs            # Account registration form
│   ├── orders.ejs              # Customer order history list
│   ├── order-details.ejs       # Detailed receipt with shipping address and item breakdown
│   ├── error.ejs               # Friendly 404, 403, and 500 error display
│   └── admin/
│       ├── products.ejs        # Admin product inventory table
│       ├── product-form.ejs    # Reusable form for creating and updating products
│       └── orders.ejs          # Admin customer order management and status update
├── public/
│   ├── css/
│   │   └── style.css           # Vanilla CSS stylesheet (tokens, flexbox, grid, media queries)
│   ├── js/
│   │   └── main.js             # Vanilla frontend JS for alert auto-dismissal
│   └── images/
│       └── placeholder.svg     # Fallback SVG when remote images fail to load
├── scripts/
│   ├── seedProducts.js         # Inserts 16 curated sample products into MongoDB
│   ├── createAdmin.js          # CLI script to create or promote an admin account safely
│   └── testApp.js              # 60-point automated E2E test suite
├── .env.example                # Environment variables template
├── .env                        # Local configuration secrets (git-ignored)
├── .gitignore                  # Git ignore rules protecting node_modules and secrets
├── app.js                      # Express application entry point and configuration
├── package.json                # Project dependencies and npm scripts
├── README.md                   # Project documentation
└── INTERVIEW_PREPARATION.md    # In-depth architectural breakdown and interview Q&As
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18 or higher)
- **MongoDB Server** (running locally on port 27017 or a MongoDB Atlas URI)

### 2. Installation
Clone the repository and install the dependencies:
```bash
npm install
```

### 3. Environment Variables
Copy the example environment file and customize it if needed:
```bash
cp .env.example .env
```

Default `.env` configuration:
```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/cartiva
JWT_SECRET=cartiva_jwt_secret_key_change_in_production_123456
SESSION_SECRET=cartiva_session_secret_key_change_in_production_654321
NODE_ENV=development
```

### 4. Seed the Database
Populate the database with 16 curated sample products across Home Essentials, Kitchen Accessories, Office Supplies, and Lifestyle:
```bash
npm run seed
```

### 5. Create an Administrator Account
Run the admin creation script to generate the default administrator:
```bash
npm run create-admin
```
*Default Administrator Credentials:*
- **Email:** `admin@cartiva.com`
- **Password:** `admin123456`

To create an administrator with custom credentials:
```bash
node scripts/createAdmin.js "Your Name" your_email@example.com your_password
```

### 6. Run the Application
Start the local server:
```bash
npm start
```
Or run with auto-reload during development:
```bash
npm run dev
```

Open your browser and navigate to: **`http://localhost:3000`**

### 7. Run Automated Tests
Execute the comprehensive end-to-end test suite:
```bash
node scripts/testApp.js
```
*(All 60 automated test cases pass out-of-the-box!)*

---

## 🗺️ Application Routes

| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Homepage with hero section and featured items | Public |
| `GET` | `/products` | Catalog with search, category filtering, and sorting | Public |
| `GET` | `/products/:id` | Detailed view for a single product | Public |
| `GET` | `/cart` | View current shopping cart and order summary | Public / Guest |
| `POST` | `/cart/add` | Add product to session cart | Public / Guest |
| `POST` | `/cart/update` | Increase or decrease item quantity | Public / Guest |
| `POST` | `/cart/remove` | Remove item from session cart | Public / Guest |
| `GET` | `/checkout` | Checkout form with shipping address inputs | Public / Guest |
| `POST` | `/checkout` | Validate shipping details, deduct stock, create order | Public / Guest |
| `GET` | `/orders/confirmation/:id` | Post-purchase confirmation page | Public / Customer |
| `GET` | `/orders` | View logged-in customer's order history | Authenticated Customer |
| `GET` | `/orders/:id` | View order receipt (strict ownership check) | Customer (Owner) / Admin |
| `GET` | `/register` | Display user registration form | Guests |
| `POST` | `/register` | Register new account and issue JWT cookie | Guests |
| `GET` | `/login` | Display login form | Guests |
| `POST` | `/login` | Authenticate credentials and issue JWT cookie | Guests |
| `GET` | `/logout` | Clear authentication cookie and redirect | Authenticated |
| `GET` | `/admin/products` | Manage product inventory | Admin Only |
| `GET` | `/admin/products/new` | Form to create a new product | Admin Only |
| `POST` | `/admin/products/new` | Save new product to database | Admin Only |
| `GET` | `/admin/products/:id/edit`| Form to edit product details | Admin Only |
| `POST`| `/admin/products/:id/edit`| Update product in database | Admin Only |
| `POST`| `/admin/products/:id/delete`| Delete product from database | Admin Only |
| `GET` | `/admin/orders` | View all customer orders | Admin Only |
| `POST`| `/admin/orders/:id/status` | Update fulfillment status of an order | Admin Only |

---

## 🛡️ Security Architecture

1. **Password Protection**: Passwords are never saved in plain text. `bcryptjs.hash(password, 10)` generates a salted hash with 10 calculation rounds before persistence.
2. **Token Security**: JWTs are transmitted exclusively via HTTP-only cookies (`httpOnly: true, sameSite: 'lax'`). This prevents malicious client-side JavaScript or XSS scripts from reading the token.
3. **Price Manipulation Prevention**: Clients cannot tamper with product prices by modifying HTML forms or payloads. The server retrieves active prices directly from MongoDB and computes subtotals and grand totals internally.
4. **Access Control**: Administrator endpoints require both valid JWT verification and `role === 'admin'`. Non-administrators receive `403 Forbidden`.
5. **Order Privacy**: Every order-detail request verifies that `order.user.equals(req.user._id)` or that the viewer has administrator privileges.
6. **Input Sanitization**: Search queries escape special regular expression characters (`replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`) to prevent regex injection attacks.

---

## 💡 The 5 Most Important Files to Study First

When preparing to present or explain this codebase, start with these five core files:

1. **`app.js`**: The central entry point. Shows how middleware is stacked in order, how database connections are established, and how routes are mounted.
2. **`middleware/auth.js`**: Demonstrates the three authentication stages (`attachUser`, `requireAuth`, `requireAdmin`) and how JWT verification works.
3. **`routes/cartRoutes.js`**: Demonstrates session-based cart management, database price verification, and quantity synchronization without trusting client prices.
4. **`routes/orderRoutes.js`**: Demonstrates transactional business logic: server-side stock availability validation, atomic stock decrements (`$inc: { stock: -quantity }`), order item price snapshots, and ownership authorization.
5. **`public/css/style.css`**: Demonstrates how a clean, professional, responsive design system can be constructed using pure CSS custom properties, Flexbox, and CSS Grid without external frameworks.

---

## 📝 Known Limitations & Design Decisions

- **Mock Payment Gateway**: To keep the project accessible and runnable without external API keys or sandbox accounts, checkout uses an instant demo payment mechanism.
- **Session Store**: By default, `express-session` uses the built-in MemoryStore for simplicity in local portfolio demonstrations. In an enterprise production deployment with multiple server instances, a persistent session store like `connect-mongo` would be connected.
- **Image Hosting**: Curated high-resolution Unsplash URLs are used with SVG fallback handling (`onerror`) to prevent broken layouts.
