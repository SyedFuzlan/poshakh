const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load env vars
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const BASE_URL = `http://127.0.0.1:${process.env.PORT || 9000}`;
const OWNER_EMAIL = process.env.OWNER_EMAIL;
const OWNER_PASSWORD = process.env.OWNER_PASSWORD;

async function fetchJson(url, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`${method} ${url} failed: ${res.status} ${JSON.stringify(data)}`);
  }
  return data;
}

async function runE2E() {
  console.log('🚀 Starting Poshakh E2E Test...');
  
  try {
    // 1. Customer Signup
    const testEmail = `test_${Date.now()}@example.com`;
    const testPassword = 'password123';
    console.log(`Step 1: Signing up customer ${testEmail}...`);
    const signupRes = await fetchJson(`${BASE_URL}/api/customers/signup`, 'POST', {
      firstName: 'Test',
      lastName: 'Customer',
      email: testEmail,
      password: testPassword
    });
    const customerToken = signupRes.token;
    console.log('✅ Signup successful.');

    // 2. Customer Login
    console.log('Step 2: Logging in customer...');
    const loginRes = await fetchJson(`${BASE_URL}/api/customers/login`, 'POST', {
      identifier: testEmail,
      password: testPassword
    });
    if (!loginRes.token) throw new Error('Login failed to return token');
    console.log('✅ Login successful.');

    // 3. Browse Products
    console.log('Step 3: Fetching products...');
    const productsRes = await fetchJson(`${BASE_URL}/api/products`);
    if (!productsRes.products.length) throw new Error('No products found in DB');
    const product = productsRes.products[0];
    console.log(`✅ Found product: ${product.name} (ID: ${product.id})`);

    // 4. Place COD Order
    console.log('Step 4: Placing COD order...');
    const orderData = {
      customer_name: 'Test Customer',
      customer_phone: '9999999999',
      customer_email: testEmail,
      address: {
        line1: '123 Test Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pin_code: '400001'
      },
      items: [{
        product_id: parseInt(product.id),
        name: product.name,
        price: product.price,
        quantity: 1,
        size: 'M'
      }],
      subtotal: product.price,
      shipping_method: 'free',
      shipping_cost: 0,
      total: product.price
    };

    const orderRes = await fetchJson(`${BASE_URL}/api/orders`, 'POST', { order_data: orderData });
    const orderId = orderRes.order_id;
    console.log(`✅ Order placed: ${orderId}`);

    // 5. Owner Dashboard Verification
    console.log('Step 5: Logging in as Owner...');
    const ownerLoginRes = await fetchJson(`${BASE_URL}/api/auth/login`, 'POST', {
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD
    });
    const ownerToken = ownerLoginRes.token;
    console.log('✅ Owner login successful.');

    console.log('Step 6: Verifying order in owner dashboard...');
    const ordersRes = await fetchJson(`${BASE_URL}/api/orders`, 'GET', null, ownerToken);
    const found = ordersRes.orders.find(o => o.id === orderId);
    if (!found) throw new Error(`Order ${orderId} not found in owner list`);
    console.log('✅ Order verified in dashboard list.');

    console.log('Step 7: Verifying stats...');
    const statsRes = await fetchJson(`${BASE_URL}/api/orders/stats`, 'GET', null, ownerToken);
    console.log(`✅ Stats: Total Orders: ${statsRes.total_orders}, Today Orders: ${statsRes.today_orders}`);

    console.log('\n✨ E2E Test Passed Successfully! ✨');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ E2E Test Failed:');
    console.error(err.message);
    process.exit(1);
  }
}

runE2E();
