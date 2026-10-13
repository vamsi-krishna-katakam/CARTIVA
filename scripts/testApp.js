/**
 * CARTIVA — Automated End-to-End Test Suite
 * Tests every requirement: catalog, search, filter, sort, cart, checkout,
 * auth, JWT cookies, security ownership, admin controls, and error states.
 */

const BASE_URL = 'http://localhost:3000';

class SimpleCookieJar {
  constructor() {
    this.cookies = {};
  }

  setFromHeaders(headers) {
    const raw = headers.get('set-cookie');
    if (!raw) return;
    
    // Header can contain multiple cookies separated by comma or array
    const parts = raw.split(/,(?=[^;]+=[^;]+)/);
    for (const part of parts) {
      const match = part.match(/^\s*([^=;]+)=([^;]*)/);
      if (match) {
        this.cookies[match[1].trim()] = match[2].trim();
      }
    }
  }

  getCookieHeader() {
    return Object.entries(this.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }
}

async function request(urlPath, options = {}, jar = null) {
  const url = `${BASE_URL}${urlPath}`;
  const headers = options.headers || {};

  if (jar) {
    const cookieHeader = jar.getCookieHeader();
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
    redirect: options.redirect || 'manual' // don't auto-follow redirects so we can inspect Location and Set-Cookie
  });

  if (jar) {
    jar.setFromHeaders(response.headers);
  }

  const text = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    text,
    location: response.headers.get('location')
  };
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('RUNNING CARTIVA E2E AUTOMATED TEST SUITE');
  console.log('====================================================\n');

  // TEST 1: Homepage
  console.log('Test 1: Homepage Rendering');
  const homeRes = await request('/');
  assert(homeRes.status === 200, 'GET / returns 200 OK');
  assert(homeRes.text.includes('CARTIVA'), 'Homepage contains CARTIVA wordmark');
  assert(homeRes.text.includes('Everyday Essentials'), 'Homepage contains hero text');
  assert(homeRes.text.includes('Featured Products'), 'Homepage displays Featured Products section');

  // TEST 2: Product Catalog
  console.log('\nTest 2: Product Catalog & Category Filter & Search & Sort');
  const catRes = await request('/products');
  assert(catRes.status === 200, 'GET /products returns 200 OK');
  assert(catRes.text.includes('Product Catalog'), 'Catalog page renders title');

  // Category Filter
  const kitchenRes = await request('/products?category=Kitchen+Accessories');
  assert(kitchenRes.status === 200, 'Category filter returns 200 OK');
  assert(kitchenRes.text.includes('Kitchen Accessories'), 'Filter by category applies');

  // Search
  const searchRes = await request('/products?search=Pour-Over');
  assert(searchRes.status === 200, 'Search query returns 200 OK');
  assert(searchRes.text.includes('Ceramic Pour-Over Coffee Dripper'), 'Search found matching product');

  // Sort
  const sortRes = await request('/products?sort=price_asc');
  assert(sortRes.status === 200, 'Sort by price returns 200 OK');

  // Search empty state
  const noMatchRes = await request('/products?search=NonExistentProductXYZ123');
  assert(noMatchRes.text.includes('No matching products found'), 'Empty state displayed when no products match');

  // TEST 3: Product Details & Invalid IDs
  console.log('\nTest 3: Product Details Page');
  // Extract a product ID from searchRes
  const idMatch = searchRes.text.match(/\/products\/([a-f0-9]{24})/);
  assert(idMatch !== null, 'Found valid product ObjectId in page');
  const testProductId = idMatch ? idMatch[1] : null;

  if (testProductId) {
    const detailRes = await request(`/products/${testProductId}`);
    assert(detailRes.status === 200, `GET /products/${testProductId} returns 200 OK`);
    assert(detailRes.text.includes('Ceramic Pour-Over Coffee Dripper'), 'Product details page displays title');
    assert(detailRes.text.includes('Add to Cart'), 'Add to Cart button is present');
  }

  // Invalid ObjectId handling
  const badIdRes = await request('/products/invalid_id_format');
  assert(badIdRes.status === 404, 'Invalid product ID gracefully returns 404 without server crash');

  // TEST 4: Shopping Cart Flow (Guest Session)
  console.log('\nTest 4: Shopping Cart (Guest Session)');
  const guestJar = new SimpleCookieJar();

  // Initial cart is empty
  const emptyCartRes = await request('/cart', {}, guestJar);
  assert(emptyCartRes.status === 200, 'GET /cart returns 200 OK');
  assert(emptyCartRes.text.includes('Your shopping cart is empty'), 'Empty cart state displayed correctly');

  // Add product to cart
  const addRes = await request('/cart/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `productId=${testProductId}&quantity=2`
  }, guestJar);
  assert(addRes.status === 302, 'POST /cart/add redirects on success');

  // View cart with item
  const viewCartRes = await request('/cart', {}, guestJar);
  assert(viewCartRes.status === 200, 'GET /cart returns 200 OK');
  assert(viewCartRes.text.includes('Ceramic Pour-Over Coffee Dripper'), 'Cart shows added product');
  assert(viewCartRes.text.includes('Order Summary'), 'Order summary card displayed');
  assert(viewCartRes.text.includes('$53.00'), 'Server calculated correct subtotal (2 * $26.50 = $53.00)');

  // Update quantity (increase)
  const updateRes = await request('/cart/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `productId=${testProductId}&action=increase`
  }, guestJar);
  assert(updateRes.status === 302, 'POST /cart/update redirects');

  const updatedCartRes = await request('/cart', {}, guestJar);
  assert(updatedCartRes.text.includes('$79.50'), 'Subtotal updated to 3 * $26.50 = $79.50');

  // TEST 5: Mandatory Login at Checkout, Guest Cart Merge & Order Placement
  console.log('\nTest 5: Mandatory Login at Checkout, Guest Cart Merge & Order Placement');
  // Unauthenticated user attempting to checkout must be redirected to login
  const guestCheckoutRes = await request('/checkout', {}, guestJar);
  assert(guestCheckoutRes.status === 302, 'GET /checkout redirects unauthenticated guest to login');
  assert(guestCheckoutRes.location.includes('/login'), 'Redirect destination is login page');

  // Register user while carrying the guest cart
  const checkoutUsername = `shopper_${Date.now()}`;
  const registerRes = await request('/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `name=Jane+Doe&username=${encodeURIComponent(checkoutUsername)}&password=password123&confirmPassword=password123`
  }, guestJar);
  assert(registerRes.status === 302, 'Registration redirects on success');
  assert(!!guestJar.cookies['token'], 'JWT cookie "token" was received upon registration');

  // Now authenticated, user can access checkout with merged cart
  const authCheckoutRes = await request('/checkout', {}, guestJar);
  assert(authCheckoutRes.status === 200, 'GET /checkout returns 200 OK after login');
  assert(authCheckoutRes.text.includes('Shipping Address'), 'Checkout displays shipping form');

  // Submit checkout order
  const placeOrderRes = await request('/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'fullName=Jane+Doe&address=123+Market+St&city=San+Francisco&state=CA&postalCode=94105'
  }, guestJar);
  assert(placeOrderRes.status === 302, 'POST /checkout redirects to order confirmation');
  assert(placeOrderRes.location.includes('/orders/confirmation/'), 'Redirect location contains confirmation URL');

  const orderId = placeOrderRes.location.split('/orders/confirmation/')[1];
  const confirmRes = await request(`/orders/confirmation/${orderId}`, {}, guestJar);
  assert(confirmRes.status === 200, 'Order confirmation page returns 200 OK');
  assert(confirmRes.text.includes('Order Placed Successfully') || confirmRes.text.includes('Order Confirmation'), 'Confirmation page shows success banner');
  assert(confirmRes.text.includes('Jane Doe'), 'Order displays customer shipping name');
  assert(confirmRes.text.includes('$79.50'), 'Order displays verified server total $79.50');

  // Verify customer can see their order in order history
  const ordersHistoryRes = await request('/orders', {}, guestJar);
  assert(ordersHistoryRes.status === 200, 'GET /orders returns 200 OK');
  assert(ordersHistoryRes.text.includes('My Orders'), 'Order history renders title');
  assert(ordersHistoryRes.text.includes(orderId.slice(-6).toUpperCase()), 'Customer order history lists newly placed order');

  // Verify cart is now cleared
  const clearedCartRes = await request('/cart', {}, guestJar);
  assert(clearedCartRes.text.includes('Your shopping cart is empty'), 'Cart was cleared after successful order');

  // TEST 6: User Authentication & Duplicate Prevention
  console.log('\nTest 6: User Registration, JWT Cookie, and Login');
  const userJar = new SimpleCookieJar();
  const testUsername = `testuser_${Date.now()}`;

  // Register another account
  const secondRegRes = await request('/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `name=Sarah+Connor&username=${encodeURIComponent(testUsername)}&password=password123&confirmPassword=password123`
  }, userJar);
  assert(secondRegRes.status === 302, 'Registration redirects on success');
  assert(!!userJar.cookies['token'], 'HTTP-only JWT cookie "token" was received upon registration');

  // Attempt duplicate registration
  const dupJar = new SimpleCookieJar();
  const dupRegisterRes = await request('/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `name=Duplicate+User&username=${encodeURIComponent(testUsername)}&password=password123&confirmPassword=password123`
  }, dupJar);
  assert(dupRegisterRes.status === 400, 'Duplicate username registration returns 400 Bad Request');
  assert(dupRegisterRes.text.includes('already taken'), 'Duplicate registration shows friendly error');

  // Logout
  const logoutRes = await request('/logout', {}, userJar);
  assert(logoutRes.status === 302, 'GET /logout redirects to homepage');

  // Login again
  const loginJar = new SimpleCookieJar();
  const loginRes = await request('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `username=${encodeURIComponent(testUsername)}&password=password123`
  }, loginJar);
  assert(loginRes.status === 302, 'Login redirects on success');
  assert(!!loginJar.cookies['token'], 'JWT cookie received after login');

  // Wrong password
  const badLoginJar = new SimpleCookieJar();
  const badLoginRes = await request('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `username=${encodeURIComponent(testUsername)}&password=wrongpassword`
  }, badLoginJar);
  assert(badLoginRes.status === 401, 'Invalid password returns 401 Unauthorized');

  // TEST 7: Security & Authorization Access Control
  console.log('\nTest 7: Security & Authorization Access Control');
  // Regular customer attempting to access /admin/products
  const unauthorizedAdminRes = await request('/admin/products', {}, loginJar);
  assert(unauthorizedAdminRes.status === 403, 'Regular customer receives 403 Forbidden on /admin/products');
  assert(unauthorizedAdminRes.text.includes('Access denied'), '403 page explains lack of admin permissions');

  // Unauthenticated user attempting to access /orders
  const unauthJar = new SimpleCookieJar();
  const unauthOrdersRes = await request('/orders', {}, unauthJar);
  assert(unauthOrdersRes.status === 302 && unauthOrdersRes.location.includes('/login'), 'Unauthenticated user redirected to /login when visiting /orders');

  // TEST 8: Administrator Functionality
  console.log('\nTest 8: Administrator Functionality');
  const adminJar = new SimpleCookieJar();

  // Admin login
  const adminLoginRes = await request('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'username=admin&password=admin123456'
  }, adminJar);
  assert(adminLoginRes.status === 302, 'Admin login succeeds and redirects');

  // Admin access products
  const adminProductsRes = await request('/admin/products', {}, adminJar);
  assert(adminProductsRes.status === 200, 'Admin can access GET /admin/products');
  assert(adminProductsRes.text.includes('Product Catalog Management'), 'Admin products table rendered');

  // Admin create product
  const createProductRes = await request('/admin/products/new', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'name=Test+Admin+Item&description=A+high+quality+test+item&price=19.99&category=Office+Supplies&image=https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=800&stock=20'
  }, adminJar);
  assert(createProductRes.status === 302, 'Admin can create a new product via POST /admin/products/new');

  // Check product appeared in admin list
  const adminProductsListRes = await request('/admin/products', {}, adminJar);
  assert(adminProductsListRes.text.includes('Test Admin Item'), 'Created product appears in admin products list');

  const newProdIdMatch = adminProductsListRes.text.match(/\/admin\/products\/([a-f0-9]{24})\/edit/);
  assert(newProdIdMatch !== null, 'Found new product ID in admin list');
  const createdProdId = newProdIdMatch ? newProdIdMatch[1] : null;

  if (createdProdId) {
    // Admin edit product
    const editRes = await request(`/admin/products/${createdProdId}/edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'name=Updated+Admin+Item&description=Updated+description&price=24.99&category=Office+Supplies&image=https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=800&stock=25'
    }, adminJar);
    assert(editRes.status === 302, 'Admin can edit product via POST /admin/products/:id/edit');

    // Admin delete product
    const deleteRes = await request(`/admin/products/${createdProdId}/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }, adminJar);
    assert(deleteRes.status === 302, 'Admin can delete product via POST /admin/products/:id/delete');
  }

  // Admin view all orders
  const adminOrdersRes = await request('/admin/orders', {}, adminJar);
  assert(adminOrdersRes.status === 200, 'Admin can view all customer orders at GET /admin/orders');
  assert(adminOrdersRes.text.includes('Customer Order Management'), 'Admin orders table renders');

  // Update order status
  const updateStatusRes = await request(`/admin/orders/${orderId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'status=Shipped'
  }, adminJar);
  assert(updateStatusRes.status === 302, 'Admin can update order status via POST /admin/orders/:id/status');

  const updatedOrdersRes = await request('/admin/orders', {}, adminJar);
  assert(updatedOrdersRes.text.includes('Shipped'), 'Order status updated to Shipped in admin view');

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
