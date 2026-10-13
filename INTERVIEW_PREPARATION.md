# CARTIVA — Technical Interview Preparation Guide

This guide breaks down every core architectural concept, data flow, and function in **CARTIVA** using plain, beginner-friendly language. Use this document to prepare for portfolio walkthroughs and technical interviews.

---

## Table of Contents
1. [Core Concepts Explained Simply](#1-core-concepts-explained-simply)
   - [1. How app.js starts the application](#1-how-appjs-starts-the-application)
   - [2. How Express routes handle requests](#2-how-express-routes-handle-requests)
   - [3. How EJS renders dynamic pages](#3-how-ejs-renders-dynamic-pages)
   - [4. How data moves from MongoDB to the product page](#4-how-data-moves-from-mongodb-to-the-product-page)
   - [5. What Mongoose models do](#5-what-mongoose-models-do)
   - [6. How user registration and bcrypt password hashing work](#6-how-user-registration-and-bcrypt-password-hashing-work)
   - [7. How JWT authentication works](#7-how-jwt-authentication-works)
   - [8. What HTTP-only cookies do](#8-what-http-only-cookies-do)
   - [9. How authentication middleware works](#9-how-authentication-middleware-works)
   - [10. How administrator authorization works](#10-how-administrator-authorization-works)
   - [11. How product search and category filtering work](#11-how-product-search-and-category-filtering-work)
   - [12. How the shopping cart is maintained between requests](#12-how-the-shopping-cart-is-maintained-between-requests)
   - [13. How cart totals are calculated](#13-how-cart-totals-are-calculated)
   - [14. How checkout creates an order](#14-how-checkout-creates-an-order)
   - [15. How customers are prevented from accessing other customers' orders](#15-how-customers-are-prevented-from-accessing-other-customers-orders)
   - [16. How the administrator adds, edits, and deletes products](#16-how-the-administrator-adds-edits-and-deletes-products)
   - [17. How async/await and try/catch work in this codebase](#17-how-asyncawait-and-trycatch-work-in-this-codebase)
   - [18. How the browser communicates with the Express server](#18-how-the-browser-communicates-with-the-express-server)
2. [Deep Dive into Important Functions](#2-deep-dive-into-important-functions)
   - [`attachUser(req, res, next)`](#attachuserreq-res-next)
   - [`requireAuth(req, res, next)`](#requireauthreq-res-next)
   - [`requireAdmin(req, res, next)`](#requireadminreq-res-next)
   - [`isRateLimited(ip)` & `recordFailedAttempt(ip)`](#isratelimitedip--recordfailedattemptip)
   - [`getSessionCart(req)`](#getsessioncartreq)
   - [`getVerifiedCart(req)`](#getverifiedcartreq)
   - [`POST /checkout` route handler](#post-checkout-route-handler)
   - [`POST /login` route handler](#post-login-route-handler)

---

## 1. Core Concepts Explained Simply

### 1. How app.js starts the application
- **What happens:** `app.js` is the server's control center. When you type `node app.js`:
  1. `import 'dotenv/config'` loads configuration secrets (port number, database URI, JWT secret) from the `.env` file into `process.env`.
  2. An Express server instance (`app = express()`) is created.
  3. `mongoose.connect()` establishes a long-lived TCP connection to MongoDB.
  4. Middleware functions are registered in sequence using `app.use()` (body parsers, cookie parser, session manager, auth detector, static assets).
  5. Route files are attached (`app.use('/', productRoutes)`, etc.).
  6. `app.listen(PORT)` starts listening for incoming network traffic on port 3000.

### 2. How Express routes handle requests
- An incoming HTTP request consists of an **HTTP Method** (GET, POST), a **Path** (e.g., `/products`), and **Headers/Body**.
- Express checks the route definitions in the order they were registered.
- When a matching method and path are found (e.g. `router.get('/products')`), Express executes the corresponding handler callback function `async (req, res) => { ... }`.
- Inside the handler, `req` represents the incoming request (query parameters, form data, cookies), and `res` provides methods to respond back to the browser (such as `res.render()`, `res.redirect()`, or `res.status()`).

### 3. How EJS renders dynamic pages
- **EJS** stands for *Embedded JavaScript*. It lets you write ordinary HTML combined with dynamic server variables.
- When a route calls `res.render('products', { products: items })`:
  1. Express finds the file `views/products.ejs`.
  2. EJS runs on the server and executes code enclosed in `<% ... %>` (loops and conditions) and evaluates `<%= ... %>` (printing escaped text).
  3. EJS outputs a pure, static HTML string.
  4. Express sends this finalized HTML string over HTTP to the browser.
  5. The browser receives clean HTML—it never sees the `<% %>` tags or the database queries.

### 4. How data moves from MongoDB to the product page
1. **User action:** The customer clicks "Products" in their browser, triggering a `GET /products` request.
2. **Controller/Route:** Express receives the request in `routes/productRoutes.js`.
3. **Database query:** The route calls `await Product.find(queryFilter).sort(sortOption)`.
4. **Mongoose/MongoDB:** Mongoose converts this into a MongoDB wire protocol query and fetches documents from the `products` collection.
5. **Template injection:** The route calls `res.render('products', { products })`, passing the array of documents to `views/products.ejs`.
6. **EJS loop:** Inside `products.ejs`, a `<% products.forEach(product => { %>` loop generates a card for each item.
7. **HTML Delivery:** The completed HTML page is delivered to the browser and painted on screen.

### 5. What Mongoose models do
- MongoDB by default is "schemaless," which means it allows arbitrary fields. However, e-commerce applications require strict structure.
- **Mongoose models** define a strict blueprint (**Schema**) for documents:
  - Enforces required fields (e.g., `name`, `price`, `stock`).
  - Sets data types (String, Number, Date, ObjectId).
  - Validates boundaries (e.g., `min: 0` for price and stock, email regex validation).
  - Provides intuitive JavaScript methods to interact with data (such as `.find()`, `.findById()`, `.save()`, `.findByIdAndUpdate()`).

### 6. How user registration and bcrypt password hashing work
- Storing passwords in plain text is a dangerous security flaw. If a database is ever compromised, plain text passwords expose users.
- **Bcrypt hashing:**
  1. When a user submits a registration form, we extract their plain password (e.g. `"secret123"`).
  2. `bcrypt.hash(password, 10)` generates a unique random string called a **salt** and hashes the password 10 rounds through a cryptographic mathematical function.
  3. The resulting hash looks like `$2a$10$e8wF3Q...`.
  4. This hash is saved in MongoDB under `passwordHash`.
  5. It is mathematically impossible to reverse-engineer the original password from this hash.
  6. When logging in later, `bcrypt.compare(enteredPassword, user.passwordHash)` hashes the entered input with the same salt to verify whether they match.

### 7. How JWT authentication works
- **JWT** stands for *JSON Web Token*. It is a digitally signed, compact string consisting of three parts separated by dots: `Header.Payload.Signature`.
- **Flow:**
  1. User enters correct email and password.
  2. The server creates a token using `jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' })`.
  3. The signature is mathematically calculated using our secret key (`JWT_SECRET`).
  4. The client cannot tamper with the payload (e.g., changing `role` from `'customer'` to `'admin'`) because changing any character invalidates the cryptographic signature.
  5. The server can verify the token on any subsequent request simply using `jwt.verify(token, secret)` without having to perform heavy session lookups.

### 8. What HTTP-only cookies do
- Normal cookies can be read by JavaScript code running in the browser via `document.cookie`. If a website has an XSS vulnerability, malicious scripts can steal credentials.
- Setting `{ httpOnly: true }` instructs the browser that **only the browser's HTTP networking engine may touch the cookie**.
- JavaScript running on the page is strictly blocked from reading or altering the cookie.
- Every time the browser makes a request to the server, it automatically includes the cookie in the HTTP `Cookie` header.

### 9. How authentication middleware works
- In Express, **middleware** is a function that runs *between* receiving a request and sending the response (`(req, res, next) => { ... }`).
- In CARTIVA:
  1. `attachUser`: Runs on every single request. Checks if a `token` cookie exists. If valid, fetches the user from MongoDB and attaches them to `req.user` and `res.locals.currentUser`.
  2. `requireAuth`: Protects customer routes (e.g. `/orders`). If `req.user` is absent, it redirects the visitor to `/login`.
  3. If authenticated, it calls `next()` to hand execution to the final route handler.

### 10. How administrator authorization works
- Authorization answers: *"Does this user have permission to do this action?"*
- `requireAdmin` checks two conditions:
  1. Is the visitor logged in? (`req.user !== null`)
  2. Is their role an administrator? (`req.user.role === 'admin'`)
- If a regular customer attempts to navigate to `/admin/products`, the middleware immediately stops execution and renders a `403 Forbidden` response. They cannot view or submit administrative actions.

### 11. How product search and category filtering work
- **Search:** The header search form submits a GET query: `/products?search=Pour-Over`.
  - In `productRoutes.js`, we sanitize the search term to prevent regex injection:
    `const safeSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');`
  - We query MongoDB using a case-insensitive regular expression:
    `queryFilter.name = { $regex: safeSearch, $options: 'i' };`
- **Category Filter:** Clicking a category pill adds `?category=Kitchen+Accessories`.
  - `queryFilter.category = category.trim();`
- Both filters can be used together or combined with sorting (`?sort=price_asc`).

### 12. How the shopping cart is maintained between requests
- CARTIVA uses an **Express session cart** stored in `req.session.cart`.
- The session is tied to the visitor through a unique session cookie (`connect.sid`).
- Even if a customer has not logged in, their cart persists across page refreshes because their browser sends the session ID with each request.
- The session stores only essential identifiers:
  `[{ productId: '65f...', quantity: 2 }]`

### 13. How cart totals are calculated
- **Critical security rule:** Never trust prices submitted by the client browser. A malicious user could edit the HTML form to submit `price: 0.01`.
- In `routes/cartRoutes.js`:
  1. The server reads the product IDs from `req.session.cart`.
  2. It queries MongoDB for the real, current products: `await Product.find({ _id: { $in: validIds } })`.
  3. It multiplies each verified database price by the validated quantity:
     `subtotal = product.price * quantity`.
  4. It sums all subtotals on the server to compute `grandTotal`.

### 14. How checkout creates an order
1. Customer enters their shipping address on `/checkout` and clicks "Place Order".
2. The server validates that all address fields are non-empty.
3. The server retrieves the active cart and checks database inventory stock for each item.
4. If stock is sufficient, it decrements the inventory in MongoDB:
   `await Product.findByIdAndUpdate(item.product._id, { $inc: { stock: -item.quantity } });`
5. It creates a new `Order` document in MongoDB with a snapshot of product names, IDs, unit prices, the shipping address, and the server-calculated total.
6. The session cart is cleared: `req.session.cart = []`.
7. The customer is redirected to the confirmation page (`/orders/confirmation/:id`).

### 15. How customers are prevented from accessing other customers' orders
- When an order is placed by an authenticated user, its `user` field is set to `req.user._id`.
- When any user requests `/orders/:id`:
  ```javascript
  const isOwner = order.user && order.user.equals(req.user._id);
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isAdmin) {
    return res.status(403).render('error', {
      title: '403 Forbidden',
      message: 'Access denied: You do not have permission to view this order.'
    });
  }
  ```
- If Customer B guesses the MongoDB ID of an order placed by Customer A, Customer B receives a `403 Forbidden` response.

### 16. How the administrator adds, edits, and deletes products
- **Add:** The admin navigates to `/admin/products/new`, fills out the form, and submits a POST request. The server validates the fields and executes `new Product({ ... }).save()`.
- **Edit:** The admin navigates to `/admin/products/:id/edit`. The form pre-populates with current database values. On submission, `Product.findByIdAndUpdate(id, updates)` updates the record.
- **Delete:** The admin clicks "Delete" on a row, which submits a POST request to `/admin/products/:id/delete`. The server executes `Product.findByIdAndDelete(id)`.

### 17. How async/await and try/catch work in this codebase
- Database queries take time because they involve network communication between Node.js and MongoDB.
- Instead of using complicated callback nesting ("callback hell"), JavaScript provides `async` and `await`:
  - `async` marks a function as asynchronous.
  - `await` pauses execution inside that function until the database Promise resolves, without blocking the entire Node.js server.
- Every asynchronous operation is wrapped in a `try { ... } catch (error) { ... }` block. If MongoDB disconnects or a query fails, execution jumps into `catch`, where the error is logged and a clean 500 error page is returned rather than crashing the server.

### 18. How the browser communicates with the Express server
- Communication follows standard **HTTP Request-Response cycles**:
  1. The browser initiates a request (e.g. `POST /cart/add`).
  2. The browser sends HTTP headers (cookies, user-agent, content-type) and an HTTP body containing form-encoded data.
  3. Express parses the data through middleware and passes it to the route handler.
  4. The handler queries MongoDB, prepares data, and issues an HTTP response:
     - `res.render(...)` sends HTTP status `200` with an HTML body.
     - `res.redirect(...)` sends HTTP status `302` with a `Location` header telling the browser where to navigate next.
     - `res.cookie(...)` sends a `Set-Cookie` header directing the browser to store the JWT.

---

## 2. Deep Dive into Important Functions

### `attachUser(req, res, next)`
- **File:** `middleware/auth.js`
- **Purpose:** Identifies the user on every incoming request by decoding the HTTP-only JWT cookie.
- **Parameters:**
  - `req`: Express request object.
  - `res`: Express response object.
  - `next`: Callback to invoke the next middleware in the chain.
- **What it returns or changes:**
  - Attaches `req.user = user` (or `null`).
  - Sets `res.locals.currentUser = user` (or `null`) so all EJS templates can display account status or admin badges.
- **Step-by-step explanation:**
  ```javascript
  const token = req.cookies && req.cookies.token;
  if (!token) return next();
  ```
  1. Checks if the `token` cookie exists. If not, proceeds immediately with `currentUser = null`.
  ```javascript
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.id).select('-passwordHash');
  ```
  2. Verifies the token's cryptographic signature against `JWT_SECRET`. If verified, extracts the user ID and retrieves the latest user document from MongoDB (excluding the password hash).
  ```javascript
  if (user) {
    req.user = user;
    res.locals.currentUser = user;
  } else {
    res.clearCookie('token');
  }
  ```
  3. If user exists in DB, attaches them. If user was deleted from DB, clears the stale cookie.
- **Interview Question:** *"Why do you fetch the user from the database instead of just trusting the data decoded from the JWT payload?"*
- **Clear Answer:** *"Because user attributes can change after a token is issued—for instance, their role might be changed or their account deleted. Fetching the user ensures we always enforce their current database permissions and don't grant access to revoked accounts."*

---

### `requireAuth(req, res, next)`
- **File:** `middleware/auth.js`
- **Purpose:** Route-level guard ensuring only logged-in users access protected endpoints like `/orders`.
- **Parameters:** `(req, res, next)`
- **What it returns or changes:** Calls `next()` if authenticated; otherwise saves return URL and redirects to `/login`.
- **Step-by-step explanation:**
  ```javascript
  if (!req.user) {
    if (req.session) {
      req.session.returnTo = req.originalUrl;
    }
    return res.redirect('/login?error=' + encodeURIComponent('Please log in to continue.'));
  }
  next();
  ```
  1. Checks `req.user` (which was set earlier by `attachUser`).
  2. If absent, stores `req.originalUrl` in the session so that after the user logs in, they are automatically returned to the exact page they were trying to view.
  3. Redirects to `/login` with an informational error query parameter.
- **Interview Question:** *"Why do you save `req.session.returnTo` before redirecting to login?"*
- **Clear Answer:** *"It improves the user experience. If a user clicks 'View Order History' or is deep in checkout, we don't want to dump them on the homepage after login; we redirect them back to where they originally wanted to go."*

---

### `requireAdmin(req, res, next)`
- **File:** `middleware/auth.js`
- **Purpose:** Protects `/admin/*` routes from unauthorized access.
- **Parameters:** `(req, res, next)`
- **What it returns or changes:** Calls `next()` if the user is an admin; otherwise redirects to `/login` (if unauthenticated) or returns a `403 Forbidden` error page (if logged in but not admin).
- **Step-by-step explanation:**
  ```javascript
  if (!req.user) {
    return res.redirect('/login?error=' + encodeURIComponent('Administrator login required.'));
  }
  if (req.user.role !== 'admin') {
    return res.status(403).render('error', {
      title: '403 Forbidden - CARTIVA',
      message: 'Access denied: You do not have administrator permissions to access this page.'
    });
  }
  next();
  ```
  1. Verifies that the user is logged in.
  2. Verifies that `req.user.role === 'admin'`.
  3. If they are a regular customer, terminates the request with HTTP status `403` and an error view.
- **Interview Question:** *"What is the difference between a 401 Unauthorized and a 403 Forbidden HTTP status code?"*
- **Clear Answer:** *"401 Unauthorized means authentication is missing or invalid—the server does not know who you are, so you should log in. 403 Forbidden means the server knows who you are, but you do not have permission to access that specific resource."*

---

### `isRateLimited(ip)` & `recordFailedAttempt(ip)`
- **File:** `routes/authRoutes.js`
- **Purpose:** Defends the login endpoint against automated password-guessing brute force attacks.
- **Parameters:** `ip` (client IP address string).
- **What it returns or changes:** Returns `true` if this IP has failed 5 or more login attempts in the last 15 minutes; returns `false` otherwise.
- **Step-by-step explanation:**
  ```javascript
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 5;

  const record = loginAttempts[ip];
  if (!record) return false;

  if (now > record.resetTime) {
    delete loginAttempts[ip];
    return false;
  }

  return record.count >= maxAttempts;
  ```
  1. Checks if an entry exists for this IP in the `loginAttempts` memory dictionary.
  2. If the 15-minute window has expired, deletes the record and resets the counter.
  3. If the attempt counter is 5 or greater, rejects further login attempts with HTTP `429 Too Many Requests`.
- **Interview Question:** *"Why is rate limiting important on authentication routes?"*
- **Clear Answer:** *"Without rate limiting, an attacker could write a script to test thousands of common passwords against an email in seconds. Rate limiting throttles or blocks suspicious repeated attempts."*

---

### `getSessionCart(req)`
- **File:** `routes/cartRoutes.js`
- **Purpose:** Safely initializes and returns the guest cart array stored in the user's session.
- **Parameters:** `req` (Express request object).
- **What it returns or changes:** Returns `req.session.cart` (an array of `{ productId, quantity }` objects).
- **Step-by-step explanation:**
  ```javascript
  function getSessionCart(req) {
    if (!req.session.cart) {
      req.session.cart = [];
    }
    return req.session.cart;
  }
  ```
  1. Checks if `req.session.cart` exists.
  2. If undefined (such as on a first-time visitor's very first action), initializes it as an empty array `[]`.
  3. Returns the reference so calling routes can push, modify, or filter cart items safely.
- **Interview Question:** *"Why do you store only product IDs and quantities in the session instead of storing the entire product object with its price?"*
- **Clear Answer:** *"Storing only IDs and quantities ensures prices can never become stale or manipulated. If a product's price or stock changes in the database, our cart always reflects the real-time database values."*

---

### `getVerifiedCart(req)`
- **File:** `routes/orderRoutes.js`
- **Purpose:** Reads the session cart, queries MongoDB for up-to-date product records, verifies stock, and computes total amounts on the server.
- **Parameters:** `req` (Express request object).
- **What it returns or changes:** Returns `{ items: Array, grandTotal: Number }`.
- **Step-by-step explanation:**
  1. Reads `req.session.cart`.
  2. Filters for valid 24-character hex MongoDB ObjectIds.
  3. Executes `Product.find({ _id: { $in: validIds } })` to fetch all matching products in a single database query.
  4. Iterates through the items, matching each session item with its real database record.
  5. Calculates `subtotal = product.price * quantity`.
  6. Returns verified items and `grandTotal = parseFloat(grandTotal.toFixed(2))`.
- **Interview Question:** *"Why do you fetch all products in a single `$in` query instead of querying MongoDB inside a loop?"*
- **Clear Answer:** *"Querying inside a loop produces the 'N+1 query problem,' which adds unnecessary network latency for every item in the cart. Using `{ _id: { $in: validIds } }` retrieves all products in a single round-trip to MongoDB."*

---

### `POST /checkout` route handler
- **File:** `routes/orderRoutes.js`
- **Purpose:** Handles order placement, validates inputs, decrements stock atomically, and creates the persistent order in MongoDB.
- **Parameters:** Express route handler `async (req, res) => { ... }`
- **What it returns or changes:** Creates an `Order` document in MongoDB, updates product stock, clears the session cart, and redirects to `/orders/confirmation/:id`.
- **Step-by-step explanation:**
  1. Extracts `fullName, address, city, state, postalCode` from `req.body` and validates that none are blank.
  2. Calls `getVerifiedCart(req)` to get server-verified items and total.
  3. Checks `dbProduct.stock < item.quantity` for each item. If any item is out of stock, cancels checkout and informs the user.
  4. Decrements database stock using `$inc`:
     ```javascript
     await Product.findByIdAndUpdate(item.product._id, {
       $inc: { stock: -item.quantity }
     });
     ```
  5. Creates and saves the `Order` in MongoDB.
  6. Sets `req.session.cart = []` to empty the cart.
  7. Redirects the customer to `/orders/confirmation/${newOrder._id}`.
- **Interview Question:** *"Why do you use `$inc: { stock: -item.quantity }` instead of doing `product.stock -= quantity; await product.save()`?"*
- **Clear Answer:** *"Using `$inc` is an atomic MongoDB operation executed directly inside the database engine. This prevents race conditions where two simultaneous checkouts might overwrite each other's stock count."*

---

### `POST /login` route handler
- **File:** `routes/authRoutes.js`
- **Purpose:** Authenticates user credentials, generates a signed JWT, and sets an HTTP-only cookie.
- **Parameters:** Express route handler `async (req, res) => { ... }`
- **What it returns or changes:** Authenticates user and sets the `'token'` cookie.
- **Step-by-step explanation:**
  1. Checks `isRateLimited(clientIp)`. If blocked, returns status 429.
  2. Looks up user by lowercase email: `User.findOne({ email })`.
  3. Verifies password: `await bcrypt.compare(password, user.passwordHash)`.
  4. If invalid, calls `recordFailedAttempt(clientIp)` and returns status 401.
  5. If valid, calls `clearRateLimit(clientIp)`.
  6. Signs JWT: `jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' })`.
  7. Sets cookie:
     ```javascript
     res.cookie('token', token, {
       httpOnly: true,
       secure: process.env.NODE_ENV === 'production',
       sameSite: 'lax',
       maxAge: 24 * 60 * 60 * 1000
     });
     ```
  8. Redirects to intended destination or appropriate page.
- **Interview Question:** *"What does `sameSite: 'lax'` do on a cookie?"*
- **Clear Answer:** *"The `SameSite` attribute controls whether cookies are sent on cross-site requests. `SameSite: 'lax'` allows cookies to be sent when a user navigates to the site (e.g., following a link), but blocks them during third-party cross-site requests (like unauthorized image or form POST requests from other sites), providing protection against Cross-Site Request Forgery (CSRF)."*
