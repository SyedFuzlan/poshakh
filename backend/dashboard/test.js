
console.log('Admin Dashboard script loading...');
const API = '';  // same origin
let token = localStorage.getItem('poshakh_owner_token') || '';
let allOrders = [];
let currentFilter = 'all';

// Explicitly export login to window to avoid ReferenceError
window.login = async function login() {
  const btn = document.querySelector('.btn-login');
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  
  if (!email || !password) return;
  
  const originalText = btn.textContent;
  btn.textContent = 'SIGNING IN...';
  btn.disabled = true;
  
  try {
    console.log('Attempting login for:', email);
    const r = await apiFetch('/api/auth/login', 'POST', { email, password });
    token = r.token;
    localStorage.setItem('poshakh_owner_token', token);
    showApp(r.email);
  } catch (err) {
    console.error('Login error:', err);
    const el = document.getElementById('login-error');
    el.textContent = err.message || 'Invalid credentials. Please try again.';
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 5000);
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
};

// ── Init ──────────────────────────────────────────────
window.onload = async () => {
  if (token) {
    try {
      const r = await apiFetch('/api/auth/verify', 'POST');
      if (r.valid) { showApp(r.email); return; }
    } catch {}
    token = '';
    localStorage.removeItem('poshakh_owner_token');
  }
  document.getElementById('login-screen').style.display = 'flex';
};

// ── Auth ──────────────────────────────────────────────
// The login function is now defined above and attached to window
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('login-screen').style.display !== 'none') login();
});

function logout() {
  token = '';
  localStorage.removeItem('poshakh_owner_token');
  location.reload();
}

function showApp(email) {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('owner-email-display').textContent = email;
  loadStats();
  loadDashboard();
}

let categories = [];
async function loadCategories() {
  try {
    categories = await apiFetch('/api/products/categories');
    // Update main creation dropdown
    const pSelect = document.getElementById('p-category');
    if (pSelect) {
      const val = pSelect.value;
      pSelect.innerHTML = '<option value="">Select category</option>' + 
        categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
      pSelect.value = val;
    }
    // Update edit modal dropdown if it's currently open
    const emSelect = document.getElementById('em-category');
    if (emSelect) {
      const val = emSelect.value;
      emSelect.innerHTML = '<option value="">Select category</option>' + 
        categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
      emSelect.value = val;
    }
  } catch (e) { console.error('Failed to load categories', e); }
}

async function addNewCategoryPrompt() {
  const name = prompt("Enter new category name:");
  if (!name) return;
  try {
    const res = await apiFetch('/api/products/categories', 'POST', { name });
    alert("Category created!");
    await loadCategories();
    // Select the new category in whichever dropdown is relevant
    const pSel = document.getElementById('p-category');
    const emSel = document.getElementById('em-category');
    if (emSel) emSel.value = res.id;
    else if (pSel) pSel.value = res.id;
  } catch (e) { alert("Failed: " + e.message); }
}

// ── Tabs ─────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach((t) => {
    const label = t.textContent.toLowerCase();
    t.classList.toggle('active', label.includes(tab));
  });
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  if (tab === 'dashboard') loadDashboard();
  if (tab === 'orders') loadOrders();
  if (tab === 'products') loadProducts();
  if (tab === 'promo') loadPromo();
  if (tab === 'settings') loadSettings();
}

async function loadDashboard() {
  try {
    const data = await apiFetch('/api/orders/reports');
    renderRevenueChart(data.dailyRevenue);
    renderCategorySales(data.categorySales);
    renderTopProducts(data.topProducts);
  } catch (e) { console.error('Failed to load dashboard', e); }
}

function renderRevenueChart(days) {
  const chart = document.getElementById('report-revenue-chart');
  if (!days.length) { chart.innerHTML = '<p style="color:#888;font-size:12px">No data yet</p>'; return; }
  
  const max = Math.max(...days.map(d => d.revenue), 1);
  chart.innerHTML = days.map(d => {
    const height = (d.revenue / max) * 100;
    const date = new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    return `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;height:100%">
        <div style="width:100%;height:${height}%;background:var(--maroon);border-radius:2px 2px 0 0;position:relative" title="₹${(d.revenue/100).toLocaleString('en-IN')} on ${date}">
        </div>
        <div style="font-size:8px;color:#888;transform:rotate(-45deg);margin-top:10px;white-space:nowrap">${date}</div>
      </div>`;
  }).join('');
}

function renderCategorySales(cats) {
  const list = document.getElementById('report-category-list');
  if (!cats.length) { list.innerHTML = '<p style="color:#888;font-size:12px">No data yet</p>'; return; }
  
  const total = cats.reduce((sum, c) => sum + c.revenue, 0);
  list.innerHTML = cats.map(c => {
    const pct = Math.round((c.revenue / total) * 100);
    return `
      <div style="display:flex;flex-direction:column;gap:4px">
        <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600">
          <span>${esc(c.category)}</span>
          <span>₹${(c.revenue/100).toLocaleString('en-IN')} (${pct}%)</span>
        </div>
        <div style="width:100%;height:6px;background:#f1f5f9;border-radius:3px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:var(--maroon)"></div>
        </div>
      </div>`;
  }).join('');
}

function renderTopProducts(products) {
  const grid = document.getElementById('report-top-products');
  if (!products.length) { grid.innerHTML = '<p style="color:#888;font-size:12px">No data yet</p>'; return; }
  
  grid.innerHTML = products.map(p => `
    <div style="background:#f8fafc;padding:12px;border-radius:6px;border:1px solid #e2e8f0">
      <div style="font-size:13px;font-weight:700;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}</div>
      <div style="font-size:11px;color:#64748b">${p.sold} units sold</div>
    </div>
  `).join('');
}

// ── Stats ─────────────────────────────────────────────
async function loadStats() {
  try {
    const s = await apiFetch('/api/orders/stats');
    document.getElementById('stat-today-orders').textContent = s.today_orders;
    document.getElementById('stat-today-revenue').textContent = s.today_revenue_formatted;
    document.getElementById('stat-pending').textContent = s.pending_shipment;
    document.getElementById('stat-pending-proc').textContent = s.pending_processing;
    document.getElementById('stat-low-stock').textContent = s.low_stock_count;
    document.getElementById('stat-total').textContent = s.total_orders;
  } catch {}
}

// ── Orders ────────────────────────────────────────────
async function loadOrders() {
  const status = document.getElementById('filter-status').value;
  const q = document.getElementById('order-search').value.trim();
  let path = '/api/orders?limit=100';
  if (status) path += `&status=${status}`;
  if (q) path += `&q=${encodeURIComponent(q)}`;

  try {
    const data = await apiFetch(path);
    allOrders = data.orders || [];
    renderOrders();
  } catch {
    document.getElementById('orders-list').innerHTML = '<div class="empty-state">Failed to load orders.</div>';
  }
}

function exportOrdersCSV() {
  const url = `${API}/api/orders/export/csv?token=${token}`;
  window.location.href = url;
}

function renderOrders() {
  const list = document.getElementById('orders-list');
  if (!allOrders.length) { list.innerHTML = '<div class="empty-state">No orders found.</div>'; return; }
  list.innerHTML = allOrders.map(orderCard).join('');
}

function orderCard(o) {
  const statusClass = 'status-' + esc(o.status);
  const statusLabel = {
    paid: 'Paid (Ready)', 
    shipped: 'Shipped', 
    pending: 'COD Pending',
    pending_verification: 'UPI Pending',
    delivered: '✅ Delivered',
    cancelled: '❌ Cancelled'
  }[o.status] || o.status;
  const itemsHtml = o.items.map(it => `
    <div class="item-row">
      ${it.image ? `<img class="item-img" src="${esc(it.image)}" alt="${esc(it.name)}" onerror="this.style.display='none'"/>` : `<div class="item-img-placeholder">🛍️</div>`}
      <div class="item-info">
        <div class="item-name">${esc(it.name)}</div>
        <div class="item-meta">${it.size ? `Size: ${esc(it.size)} · ` : ''}Qty: ${Number(it.quantity)} · ₹${Number(it.price).toLocaleString('en-IN')}</div>
      </div>
    </div>`).join('');
  const payRef = o.payment_method === 'upi' ? `UTR: ${esc(o.utr||'—')}` : `Ref: ${esc(o.razorpay_payment_id||'—')}`;
  const footerBtn = o.status === 'shipped'
    ? `<span class="shipped-label">✅ Shipped on ${esc(o.shipped_at_ist || '—')}</span>`
    : `<button class="btn-ship" onclick="markShipped('${esc(String(o.id))}',this)">${o.status==='pending_verification'?'VERIFY & SHIP':'MARK AS SHIPPED'}</button>`;
  return `<div class="order-card" id="order-${esc(String(o.id))}">
    <div class="order-header">
      <div>
        <div class="order-id">${esc(o.id)}</div>
        <div class="order-date">${esc(o.created_at_ist || o.created_at_utc)} · ${o.payment_method?.toUpperCase()||'—'} · ${payRef}</div>
      </div>
      <span class="status-badge ${statusClass}">${statusLabel}</span>
    </div>
    <div class="order-body">
      <div class="order-section"><h4>Customer</h4>
        <p><strong>${esc(o.customer_name)}</strong><br/>${esc(o.customer_phone)}</p>
      </div>
      <div class="order-section"><h4>Ship To</h4>
        <p>${esc(o.address.full)}</p>
      </div>
      <div class="order-section"><h4>Items</h4>
        <div class="items-list">${itemsHtml}</div>
      </div>
    </div>
    <div class="order-footer">
      <div class="order-total">${esc(o.total_formatted)} <span style="font-size:12px;color:#888;font-weight:400">(Shipping: ${esc(o.shipping_cost_formatted)})</span></div>
      <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">
        <div style="display:flex;gap:8px;margin-bottom:8px">
          <button onclick="window.open('/api/orders/${o.id}/invoice?token='+token)" style="background:none;border:1px solid #ddd;padding:4px 8px;font-size:11px;border-radius:4px;cursor:pointer">📄 Invoice</button>
          <button onclick="openHistoryModal('${o.id}')" style="background:none;border:none;color:var(--maroon);font-size:11px;font-weight:700;text-decoration:underline;cursor:pointer">🕰️ History</button>
        </div>
        ${o.status === 'shipped' 
          ? `<div style="text-align:right">
               <div style="display:flex;gap:8px">
                 <button class="btn-ship" style="background:#16a34a;color:#fff" onclick="updateOrderStatus('${o.id}', 'delivered')">Mark Delivered</button>
                 <button class="btn-delete" style="width:auto;padding:0 12px" onclick="confirmCancel('${o.id}')">Cancel</button>
               </div>
               <div style="font-size:11px;color:#555;margin-top:8px">🚚 ${esc(o.courier_name)}: ${esc(o.tracking_number)}</div>
             </div>`
          : o.status === 'delivered'
            ? `<span style="color:#16a34a;font-weight:700">✅ DELIVERED</span>`
            : o.status === 'cancelled'
              ? `<span style="color:#dc2626;font-weight:700">❌ CANCELLED</span>`
              : `<div style="display:flex;gap:8px">
                   <input type="text" id="courier-${o.id}" placeholder="Courier" style="width:100px;height:32px;font-size:12px;padding:0 8px;border:1px solid #ddd;border-radius:4px"/>
                   <input type="text" id="tracking-${o.id}" placeholder="Tracking ID" style="width:120px;height:32px;font-size:12px;padding:0 8px;border:1px solid #ddd;border-radius:4px"/>
                   <button class="btn-ship" onclick="shipOrder('${esc(String(o.id))}',this)">SHIP</button>
                   <button class="btn-delete" style="width:auto;padding:0 12px" onclick="confirmCancel('${o.id}')">Cancel</button>
                 </div>`
        }
      </div>
    </div>
  </div>`;
}

async function shipOrder(id, btn) {
  const courier = document.getElementById('courier-' + id).value.trim();
  const tracking = document.getElementById('tracking-' + id).value.trim();
  if(!courier || !tracking) return alert('Enter courier and tracking ID');
  updateOrderStatus(id, 'shipped', { courier_name: courier, tracking_number: tracking });
}

function confirmCancel(id) {
  if (confirm("Are you sure you want to CANCEL this order? Items will be restocked automatically.")) {
    updateOrderStatus(id, 'cancelled');
  }
}

async function updateOrderStatus(id, status, extra = {}) {
  try {
    const data = await apiFetch(`/api/orders/${id}`, 'PATCH', { status, ...extra });
    const card = document.getElementById('order-' + id);
    if (card) card.outerHTML = orderCard(data.order);
    loadStats();
  } catch(e) {
    alert('Failed to update order: ' + e.message);
  }
}

async function markShipped(id, btn) {
  if (confirm('Verify and mark this order as shipped?')) {
    updateOrderStatus(id, 'shipped');
  }
}

// ── Products ──────────────────────────────────────────
let showLowStockOnly = false;
function toggleLowStockFilter() {
  showLowStockOnly = !showLowStockOnly;
  const btn = document.getElementById('btn-low-stock');
  btn.classList.toggle('active', showLowStockOnly);
  loadProducts();
}

async function loadProducts() {
  try {
    const data = await apiFetch('/api/products');
    let products = data.products || [];
    if (showLowStockOnly) {
      products = products.filter(p => p.totalStock < 5);
    }
    renderProducts(products);
  } catch {
    document.getElementById('products-grid').innerHTML = '<div class="empty-state">Failed to load products.</div>';
  }
}

function renderProducts(products) {
  const el = document.getElementById('products-grid');
  if (!products.length) { el.innerHTML = '<div class="empty-state">No products yet. Add one above!</div>'; return; }
  el.innerHTML = `<div class="products-grid">${products.map(p => `
    <div class="product-tile" onclick="openEditModal('${esc(String(p.id))}')" style="cursor:pointer">
      <img src="${esc(p.images && p.images[0] ? p.images[0] : '')}" alt="${esc(p.name)}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22220%22 height=%22200%22><rect fill=%22%23f0ece6%22 width=%22100%25%22 height=%22100%25%22/><text x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 fill=%22%23888%22 dy=%22.3em%22 font-size=%2240%22>🛍️</text></svg>'"/>
      <div class="tile-body">
        <div class="tile-name">${esc(p.name)}</div>
        <div class="tile-meta">${esc(p.category)}${p.collection ? ' · ' + esc(p.collection) : ''}</div>
        <div class="tile-price">${esc(p.formattedPrice)}</div>
        <div class="tile-stock" style="font-size:11px;font-weight:700;margin-bottom:12px;${p.totalStock <= 0 ? 'color:var(--error)' : p.totalStock < 5 ? 'color:#854d0e' : 'color:#166534'}">
          ${p.totalStock <= 0 ? 'OUT OF STOCK' : p.totalStock < 5 ? 'LOW STOCK: ' + p.totalStock : p.totalStock + ' IN STOCK'}
        </div>
        <button class="btn-delete" onclick="event.stopPropagation();deleteProduct('${esc(String(p.id))}','${esc(p.name)}')">DELETE</button>
      </div>
    </div>`).join('')}</div>`;
}

function toggleStock(cb) {
  const row = cb.closest('.size-row');
  const stockInput = document.getElementById('stock-' + cb.value);
  if (cb.checked) {
    stockInput.style.display = 'inline-block';
    row.style.borderColor = 'var(--maroon)';
    row.style.background = 'var(--cream-warm)';
  } else {
    stockInput.style.display = 'none';
    stockInput.value = '0';
    row.style.borderColor = 'var(--border-subtle)';
    row.style.background = '#f7f4f0';
  }
}

async function saveProduct() {
  const name = document.getElementById('p-name').value.trim();
  const price = document.getElementById('p-price').value.trim();
  const compareAt = document.getElementById('p-compare-at').value.trim();
  const category = document.getElementById('p-category').value;
  const collection = document.getElementById('p-collection').value.trim();
  const description = document.getElementById('p-description').value.trim();
  const metaTitle = document.getElementById('p-meta-title').value.trim();
  const metaDescription = document.getElementById('p-meta-description').value.trim();
  const slug = document.getElementById('p-slug').value.trim();
  const imageFiles = document.getElementById('product-images').files;

  if (!name || !price || !category) { alert('Name, price and category are required.'); return; }

  // Validate at least one size selected
  const checkedSizes = [...document.querySelectorAll('input[name="sizes[]"]:checked')];
  const sizesError = document.getElementById('sizes-error');
  if (checkedSizes.length === 0) {
    sizesError.style.display = 'block';
    return;
  }
  sizesError.style.display = 'none';

  const fd = new FormData();
  fd.append('name', name);
  fd.append('price', price);
  if (compareAt) fd.append('compare_at_price', compareAt);
  fd.append('category', category); // Now sending category_id
  if (collection) fd.append('collection', collection);
  if (description) fd.append('description', description);
  if (metaTitle) fd.append('meta_title', metaTitle);
  if (metaDescription) fd.append('meta_description', metaDescription);
  if (slug) fd.append('slug', slug);
  
  for (let i = 0; i < imageFiles.length; i++) {
    fd.append('images', imageFiles[i]);
  }

  checkedSizes.forEach(cb => {
    fd.append('sizes[]', cb.value);
    const stock = document.getElementById('stock-' + cb.value).value || '0';
    fd.append('stock[]', stock);
  });

  try {
    const r = await fetch(API + '/api/products', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    alert('✅ Product saved!');
    // Clear fields
    ['p-name', 'p-price', 'p-compare-at', 'p-category', 'p-collection', 'p-description', 'p-meta-title', 'p-meta-description', 'p-slug'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('product-images').value = '';
    document.getElementById('images-preview-container').innerHTML = '';
    document.getElementById('drop-text').style.display = 'block';
    
    document.querySelectorAll('input[name="sizes[]"]').forEach(cb => {
      cb.checked = false;
      const ctrl = document.getElementById('new-stock-ctrl-' + cb.value);
      if (ctrl) ctrl.style.display = 'none';
    });
    loadProducts();
    loadStats();
  } catch(e) { alert('Failed to save product: ' + e.message); }
}

async function deleteProduct(id, name) {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  try {
    await apiFetch('/api/products/' + id, 'DELETE');
    loadProducts();
  } catch { alert('Failed to delete product.'); }
}

// ── Image preview ─────────────────────────────────────
function previewImages(input) {
  const container = document.getElementById('images-preview-container');
  container.innerHTML = '';
  const files = Array.from(input.files);
  if (files.length === 0) {
    document.getElementById('drop-text').style.display = 'block';
    return;
  }
  document.getElementById('drop-text').style.display = 'none';
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = document.createElement('img');
      img.src = e.target.result;
      img.className = 'preview-img';
      img.style.margin = '4px';
      container.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
}
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('drop-zone').classList.remove('dragover');
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
  if (!files.length) return;
  const dt = new DataTransfer();
  files.forEach(f => dt.items.add(f));
  const input = document.getElementById('product-images');
  input.files = dt.files;
  previewImages(input);
}

// ── API helper ────────────────────────────────────────
async function apiFetch(path, method = 'GET', body = null) {
  const opts = { method, headers: { Authorization: 'Bearer ' + token } };
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const r = await fetch(API + path, opts);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || r.status);
  return data;
}
function esc(str) { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── Promo Codes ──────────────────────────────────────
async function loadPromo() {
  const list = document.getElementById('promo-list');
  list.innerHTML = '<div class="loading">Loading promo codes...</div>';
  try {
    const codes = await apiFetch('/api/promo');
    if (!codes.length) { list.innerHTML = '<div class="empty-state">No promo codes yet.</div>'; return; }
    list.innerHTML = codes.map(p => `
      <div class="order-card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:700;color:var(--maroon);font-size:16px">${esc(p.code)}</div>
            <div style="font-size:12px;color:#888">${p.type==='percentage' ? p.value+'%' : '₹'+p.value} off · Min: ₹${p.min_purchase_paise/100}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:11px;text-transform:uppercase;color:#888">${p.times_used} uses</div>
            <button class="btn-delete" onclick="deletePromo(${p.id})" style="margin-top:8px">DELETE</button>
          </div>
        </div>
      </div>`).join('');
  } catch { list.innerHTML = 'Error loading promo codes.'; }
}

async function savePromo() {
  const code = document.getElementById('promo-code').value.trim();
  const type = document.getElementById('promo-type').value;
  const value = document.getElementById('promo-value').value;
  const min = document.getElementById('promo-min').value;
  const expiry = document.getElementById('promo-expiry').value;
  const limit = document.getElementById('promo-limit').value;

  if (!code || !value) return alert('Code and Value are required');
  try {
    await apiFetch('/api/promo', 'POST', { 
      code, type, value: parseFloat(value), 
      min_purchase_paise: Math.round(parseFloat(min||0)*100), 
      expiry_date: expiry, 
      usage_limit: parseInt(limit||0) 
    });
    alert('Code created!');
    loadPromo();
  } catch(e) { alert(e.message); }
}

async function deletePromo(id) {
  if (!confirm('Delete promo code?')) return;
  try {
    await apiFetch('/api/promo/'+id, 'DELETE');
    loadPromo();
  } catch(e) { alert(e.message); }
}

// ── Settings ─────────────────────────────────────────
async function loadSettings() {
  try {
    const s = await apiFetch('/api/settings');
    document.getElementById('setting-announcement').value = s.announcement_text || '';
    document.getElementById('setting-hero-img').value = s.hero_banner_image || '';
    document.getElementById('setting-sale-mode').value = s.is_sale_mode || 'false';
  } catch {}
}

async function saveSettings() {
  const settings = {
    announcement_text: document.getElementById('setting-announcement').value.trim(),
    hero_banner_image: document.getElementById('setting-hero-img').value.trim(),
    is_sale_mode: document.getElementById('setting-sale-mode').value
  };
  
  try {
    for (const [key, value] of Object.entries(settings)) {
      await apiFetch('/api/settings', 'POST', { key, value });
    }
    alert('Settings saved!');
  } catch(e) { alert(e.message); }
}

// ── Edit Modal ────────────────────────────────────────
let _escKeyHandler = null;

function emToggleStock(cb) {
  const row = cb.closest('.size-row');
  const stockCtrl = document.getElementById('em-stock-ctrl-' + cb.value);
  if (cb.checked) {
    stockCtrl.style.display = 'flex';
    row.style.borderColor = 'var(--maroon)';
    row.style.background = 'var(--cream-warm)';
  } else {
    stockCtrl.style.display = 'none';
    const input = document.getElementById('em-stock-' + cb.value);
    if (input) input.value = '0';
    row.style.borderColor = 'var(--border-subtle)';
    row.style.background = '#f7f4f0';
  }
}

function adjustStock(size, delta) {
  const input = document.getElementById('em-stock-' + size);
  if (!input) return;
  let val = parseInt(input.value || '0', 10);
  val = Math.max(0, val + delta);
  input.value = val;
}

function closeEditModal() {
  const overlay = document.getElementById('edit-modal-overlay');
  if (overlay) overlay.remove();
  if (_escKeyHandler) {
    document.removeEventListener('keydown', _escKeyHandler);
    _escKeyHandler = null;
  }
}

async function openEditModal(productId) {
  // Append overlay immediately with loading placeholder (per UI-SPEC loading state)
  const overlayHtml = `<div id="edit-modal-overlay"
    style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center"
    onclick="if(event.target===this)closeEditModal()">
    <div class="em-dialog" style="background:#fff;border-radius:8px;padding:32px;width:min(560px,92vw);max-height:90vh;overflow-y:auto;position:relative;border:1px solid var(--border-subtle);box-shadow:0 20px 60px rgba(0,0,0,.2)" onclick="event.stopPropagation()">
      <div style="text-align:center;padding:40px;color:#888">Loading...</div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', overlayHtml);

  // Escape key closes modal (IC-02); store handler reference to remove on close
  _escKeyHandler = (e) => { if (e.key === 'Escape') closeEditModal(); };
  document.addEventListener('keydown', _escKeyHandler);

  // Fetch fresh product data (D-03)
  let p;
  try {
    const data = await apiFetch('/api/products/' + productId);
    p = data.product;
  } catch (e) {
    closeEditModal();
    alert('Failed to load product: ' + e.message);
    return;
  }

  const existingSizes = new Set(p.variants.map(v => v.size));
  const stockMap = Object.fromEntries(p.variants.map(v => [v.size, v.stock]));
  const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size'];
  existingSizes.forEach(sz => { if (!SIZES.includes(sz)) SIZES.push(sz); });

  const pillsHtml = SIZES.map(sz => {
    const checked = existingSizes.has(sz) ? 'checked' : '';
    const stockVal = stockMap[sz] !== undefined ? stockMap[sz] : 0;
    const display = existingSizes.has(sz) ? 'flex' : 'none';
    const pillBg = existingSizes.has(sz) ? 'var(--cream-warm)' : '#f7f4f0';
    const pillBorder = existingSizes.has(sz) ? 'var(--maroon)' : 'var(--border-subtle)';
    return `<div class="size-row" style="display:flex;align-items:center;justify-content:between;gap:8px;background:${pillBg};border:1px solid ${pillBorder};border-radius:4px;padding:8px 12px;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:8px;flex:1">
        <input type="checkbox" id="em-size-${esc(sz)}" name="em-sizes[]" value="${esc(sz)}" ${checked} onchange="emToggleStock(this)" style="width:16px;height:16px;accent-color:var(--maroon);cursor:pointer"/>
        <label for="em-size-${esc(sz)}" style="font-size:12px;font-weight:700;letter-spacing:1px;cursor:pointer;min-width:36px">${esc(sz)}</label>
      </div>
      <div id="em-stock-ctrl-${esc(sz)}" style="display:${display};align-items:center;gap:4px">
        <span style="font-size:10px;color:#888;margin-right:4px">Stock:</span>
        <button onclick="adjustStock('${esc(sz)}', -1)" style="width:28px;height:28px;border:1px solid #ddd;background:#fff;border-radius:4px;cursor:pointer;font-weight:bold">-</button>
        <input type="number" id="em-stock-${esc(sz)}" min="0" value="${stockVal}" style="width:50px;height:28px;border:1px solid #ddd;border-radius:4px;text-align:center;font-size:12px"/>
        <button onclick="adjustStock('${esc(sz)}', 1)" style="width:28px;height:28px;border:1px solid #ddd;background:#fff;border-radius:4px;cursor:pointer;font-weight:bold">+</button>
      </div>
    </div>`;
  }).join('');

  const formHtml = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px">
      <h2 style="font-size:16px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--maroon)">EDIT PRODUCT</h2>
      <button onclick="closeEditModal()" aria-label="Close edit modal" style="background:none;border:none;font-size:24px;color:#888;cursor:pointer;line-height:1">×</button>
    </div>
    <div class="field" style="margin-bottom:16px">
      <label class="pf-label" for="em-name">Product Name</label>
      <input class="pf-input" type="text" id="em-name" value="${esc(p.name)}" style="width:100%"/>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div>
        <label class="pf-label" for="em-price">Price (₹ INR)</label>
        <input class="pf-input" type="number" id="em-price" min="1" value="${esc(String(p.price))}"/>
      </div>
      <div>
        <label class="pf-label" for="em-compare-at">Compare-at Price</label>
        <input class="pf-input" type="number" id="em-compare-at" min="1" value="${esc(String(p.compare_at_price || ''))}"/>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div>
        <label class="pf-label">Category</label>
        <select class="pf-input" id="em-category">
          <option value="">Select category</option>
          ${categories.map(c => `<option value="${c.id}" ${p.category_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="pf-label">Collection</label>
        <input class="pf-input" type="text" id="em-collection" value="${esc(p.collection || '')}" placeholder="e.g. Summer 2026"/>
      </div>
    </div>
    <div class="field" style="margin-bottom:16px">
      <label class="pf-label" for="em-description">Description (optional)</label>
      <textarea class="pf-input" id="em-description" rows="3">${esc(p.description || '')}</textarea>
    </div>
    
    <!-- SEO SECTION -->
    <div style="background:#f1f5f9;padding:12px;border-radius:6px;margin-bottom:16px;border:1px solid #cbd5e1">
      <div style="font-weight:700;font-size:11px;margin-bottom:8px;color:#475569">SEARCH ENGINE OPTIMIZATION</div>
      <div class="field" style="margin-bottom:8px">
        <label style="font-size:10px;font-weight:700;display:block;margin-bottom:4px">Meta Title</label>
        <input class="pf-input" id="em-meta-title" value="${esc(p.meta_title || '')}" style="height:32px;font-size:12px"/>
      </div>
      <div class="field" style="margin-bottom:8px">
        <label style="font-size:10px;font-weight:700;display:block;margin-bottom:4px">URL Slug</label>
        <input class="pf-input" id="em-slug" value="${esc(p.slug || '')}" style="height:32px;font-size:12px"/>
      </div>
      <div class="field">
        <label style="font-size:10px;font-weight:700;display:block;margin-bottom:4px">Meta Description</label>
        <textarea class="pf-input" id="em-meta-description" rows="2" style="font-size:12px">${esc(p.meta_description || '')}</textarea>
      </div>
    </div>

    <div class="field" style="margin-bottom:16px">
      <label class="pf-label">Sizes &amp; Stock *</label>
      <div id="em-sizes-container" style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
        ${pillsHtml}
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;align-items:center">
        <input type="text" id="em-new-size-name" placeholder="Custom Size (e.g. 4XL)" style="height:32px;border:1px solid #ddd;border-radius:4px;padding:0 8px;font-size:12px;width:140px"/>
        <button type="button" onclick="addCustomSize('em-sizes-container', 'em-new-size-name', 'em-')" style="height:32px;background:var(--maroon);color:#fff;border:none;border-radius:4px;padding:0 12px;font-size:12px;cursor:pointer;font-weight:bold">+ Add</button>
      </div>
    </div>
    <div style="display:flex;gap:16px;margin-top:24px;justify-content:flex-end">
      <button onclick="closeEditModal()" style="background:none;border:1px solid #ddd;color:var(--charcoal);padding:10px 20px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:700;text-transform:uppercase">CANCEL</button>
      <button class="btn-save" onclick="saveEditModal('${esc(String(p.id))}')" style="padding:10px 24px">SAVE PRODUCT</button>
    </div>`;

  // Replace loading placeholder with full form
  const dialog = document.querySelector('#edit-modal-overlay .em-dialog');
  if (dialog) dialog.innerHTML = formHtml;
}

async function saveEditModal(productId) {
  const name = (document.getElementById('em-name').value || '').trim();
  const price = (document.getElementById('em-price').value || '').trim();
  const compareAt = (document.getElementById('em-compare-at').value || '').trim();
  const description = (document.getElementById('em-description').value || '').trim();
  const category_id = document.getElementById('em-category').value;
  const collection = (document.getElementById('em-collection').value || '').trim();
  const meta_title = (document.getElementById('em-meta-title').value || '').trim();
  const slug = (document.getElementById('em-slug').value || '').trim();
  const meta_description = (document.getElementById('em-meta-description').value || '').trim();

  if (!name || !price) { alert('Name and price are required.'); return; }

  const checkedSizes = [...document.querySelectorAll('input[name="em-sizes[]"]:checked')];
  const sizesError = document.getElementById('em-sizes-error');
  if (checkedSizes.length === 0) {
    sizesError.style.display = 'block';
    return;
  }
  sizesError.style.display = 'none';

  const sizes = checkedSizes.map(cb => cb.value);
  const stock = checkedSizes.map(cb => {
    const input = document.getElementById('em-stock-' + cb.value);
    return input ? parseInt(input.value || '0', 10) : 0;
  });

  try {
    await apiFetch('/api/products/' + productId, 'PATCH', {
      name, 
      price: parseFloat(price), 
      compare_at_price: compareAt ? parseFloat(compareAt) : null,
      description, 
      category_id: category_id || null,
      collection,
      meta_title,
      slug,
      meta_description,
      sizes, 
      stock
    });
    closeEditModal();
    loadProducts();
  } catch (e) {
    alert('Failed to save: ' + e.message);
    // Modal stays open on error (IC-04 step 7)
  }
}
// ── Manual Order Modal ────────────────────────────────
async function openManualOrderModal() {
  const overlayHtml = `<div id="manual-order-overlay"
    style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center"
    onclick="if(event.target===this)closeManualOrderModal()">
    <div class="em-dialog" style="background:#fff;border-radius:8px;padding:32px;width:min(640px,95vw);max-height:90vh;overflow-y:auto;position:relative;border:1px solid var(--border-subtle);box-shadow:0 20px 60px rgba(0,0,0,.2)" onclick="event.stopPropagation()">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
        <h2 style="font-size:16px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--maroon)">CREATE MANUAL ORDER</h2>
        <button onclick="closeManualOrderModal()" style="background:none;border:none;font-size:24px;color:#888;cursor:pointer">×</button>
      </div>
      
      <div class="form-grid">
        <div class="full">
          <label class="pf-label">Customer Name</label>
          <input class="pf-input" id="mo-customer-name" type="text" placeholder="John Doe"/>
        </div>
        <div>
          <label class="pf-label">Phone</label>
          <input class="pf-input" id="mo-customer-phone" type="text" placeholder="9876543210"/>
        </div>
        <div>
          <label class="pf-label">Email (optional)</label>
          <input class="pf-input" id="mo-customer-email" type="email" placeholder="john@example.com"/>
        </div>
        <div class="full">
          <label class="pf-label">Shipping Address</label>
          <textarea class="pf-input" id="mo-address" rows="2" placeholder="House No, Street, City, State, PIN"></textarea>
        </div>
      </div>

      <div style="margin-top:24px;border-top:1px solid #eee;padding-top:20px">
        <h3 style="font-size:12px;font-weight:700;margin-bottom:12px">SELECT PRODUCTS</h3>
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <select id="mo-product-select" class="pf-input" onchange="loadMoVariants(this.value)" style="flex:1">
            <option value="">Select a product...</option>
          </select>
          <select id="mo-variant-select" class="pf-input" style="width:120px">
            <option value="">Size</option>
          </select>
          <button onclick="addMoItem()" style="background:var(--maroon);color:var(--gold);border:none;padding:0 16px;border-radius:4px;cursor:pointer;font-weight:700">+</button>
        </div>
        <div id="mo-items-list" style="background:#f9f9f9;padding:12px;border-radius:4px;font-size:13px">
          <p style="color:#888;text-align:center">No items added yet</p>
        </div>
      </div>

      <div style="margin-top:24px;display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:18px;font-weight:700;color:var(--maroon)">Total: ₹<span id="mo-total">0</span></div>
        <button class="btn-save" onclick="submitManualOrder()" style="margin-top:0">CREATE ORDER</button>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', overlayHtml);
  
  // Load products
  const data = await apiFetch('/api/products');
  const sel = document.getElementById('mo-product-select');
  data.products.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.name} (₹${p.price})`;
    opt.dataset.price = p.price;
    opt.dataset.image = p.image_url;
    opt.dataset.name = p.name;
    sel.appendChild(opt);
  });
}

let moItems = [];
async function loadMoVariants(pid) {
  const sel = document.getElementById('mo-variant-select');
  sel.innerHTML = '<option value="">Size</option>';
  if(!pid) return;
  const data = await apiFetch('/api/products/' + pid);
  data.product.variants.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = `${v.size} (${v.stock} in stock)`;
    opt.dataset.size = v.size;
    sel.appendChild(opt);
  });
}

function addMoItem() {
  const pSel = document.getElementById('mo-product-select');
  const vSel = document.getElementById('mo-variant-select');
  if(!pSel.value || !vSel.value) return;
  
  const pOpt = pSel.options[pSel.selectedIndex];
  const vOpt = vSel.options[vSel.selectedIndex];
  
  moItems.push({
    product_id: pSel.value,
    variant_id: vSel.value,
    name: pOpt.dataset.name,
    size: vOpt.dataset.size,
    price: parseFloat(pOpt.dataset.price),
    image: pOpt.dataset.image,
    quantity: 1
  });
  renderMoItems();
}

function renderMoItems() {
  const list = document.getElementById('mo-items-list');
  if(!moItems.length) { list.innerHTML = '<p style="color:#888;text-align:center">No items added yet</p>'; return; }
  list.innerHTML = moItems.map((it, i) => `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span>${esc(it.name)} (${esc(it.size)}) x ${it.quantity}</span>
      <div style="display:flex;align-items:center;gap:12px">
        <span>₹${it.price * it.quantity}</span>
        <button onclick="moItems.splice(${i},1);renderMoItems()" style="background:none;border:none;color:#c00;cursor:pointer">×</button>
      </div>
    </div>
  `).join('');
  const total = moItems.reduce((sum, it) => sum + (it.price * it.quantity), 0);
  document.getElementById('mo-total').textContent = total.toLocaleString('en-IN');
}

async function submitManualOrder() {
  const name = document.getElementById('mo-customer-name').value.trim();
  const phone = document.getElementById('mo-customer-phone').value.trim();
  const email = document.getElementById('mo-customer-email').value.trim();
  const address = document.getElementById('mo-address').value.trim();
  
  if(!name || !phone || !address || !moItems.length) return alert('Fill all fields and add items');
  
  const total = moItems.reduce((sum, it) => sum + (it.price * it.quantity), 0);
  const order_data = {
    customer_name: name,
    customer_phone: phone,
    customer_email: email,
    payment_method: 'manual',
    address: { full: address, line1: address, city: '', state: '', pin_code: '' },
    items: moItems,
    subtotal: total,
    total: total,
    shipping_cost: 0,
    shipping_method: 'free'
  };
  
  try {
    await apiFetch('/api/orders', 'POST', { order_data });
    alert('✅ Manual order created!');
    closeManualOrderModal();
    loadOrders();
    loadStats();
  } catch(e) { alert(e.message); }
}

function closeManualOrderModal() {
  document.getElementById('manual-order-overlay').remove();
  moItems = [];
}

// ── Order History ────────────────────────────────────
async function openHistoryModal(orderId) {
  try {
    const data = await apiFetch(`/api/orders/${orderId}/history`);
    const overlayHtml = `
      <div id="history-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:2000;padding:20px">
        <div style="background:#fff;width:100%;max-width:500px;border-radius:12px;padding:32px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
            <h2 style="font-size:16px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--maroon)">Order History — #${orderId}</h2>
            <button onclick="document.getElementById('history-overlay').remove()" style="background:none;border:none;font-size:24px;color:#888;cursor:pointer">×</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:16px">
            ${data.history.map(h => `
              <div style="display:flex;gap:12px;border-left:2px solid #e2e8f0;padding-left:16px;position:relative">
                <div style="position:absolute;left:-5px;top:0;width:8px;height:8px;border-radius:50%;background:var(--maroon)"></div>
                <div>
                  <div style="font-size:11px;font-weight:700;color:var(--maroon);text-transform:uppercase;margin-bottom:4px">${h.status.replace('_', ' ')}</div>
                  <div style="font-size:13px;color:#1a1a1a">${esc(h.comment || 'Status updated')}</div>
                  <div style="font-size:11px;color:#888;margin-top:4px">${new Date(h.created_at).toLocaleString('en-IN')}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', overlayHtml);
  } catch (e) { alert('Failed to load history'); }
}

// ── Bulk Update ──────────────────────────────────────
function openBulkUpdateModal() {
  const overlayHtml = `
    <div id="bulk-update-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:2000;padding:20px">
      <div style="background:#fff;width:100%;max-width:450px;border-radius:12px;padding:32px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
          <h2 style="font-size:16px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--maroon)">⚖️ Bulk Price Update</h2>
          <button onclick="document.getElementById('bulk-update-overlay').remove()" style="background:none;border:none;font-size:24px;color:#888;cursor:pointer">×</button>
        </div>
        <div style="background:#fff9f0;border:1px solid #ffedd5;padding:12px;border-radius:6px;margin-bottom:20px;font-size:12px;color:#9a3412">
          <strong>Note:</strong> This will affect ALL products in the selected category.
        </div>
        <div class="field">
          <label>Category</label>
          <select id="bulk-category" class="pf-input">
            <option value="all">All Products</option>
            ${categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Adjustment Type</label>
          <select id="bulk-type" class="pf-input">
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed Amount (₹)</option>
          </select>
        </div>
        <div class="field">
          <label>Value (+ increase, - decrease)</label>
          <input type="number" id="bulk-value" class="pf-input" placeholder="e.g. -10 for 10% discount"/>
        </div>
        <div style="margin-top:24px;display:flex;gap:12px">
          <button onclick="document.getElementById('bulk-update-overlay').remove()" class="btn-primary" style="flex:1;background:#fff;color:var(--charcoal);border:1px solid #ddd">Cancel</button>
          <button onclick="submitBulkUpdate()" class="btn-primary" style="flex:1">Apply Changes</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', overlayHtml);
}

async function submitBulkUpdate() {
  const catId = document.getElementById('bulk-category').value;
  const type = document.getElementById('bulk-type').value;
  const value = parseFloat(document.getElementById('bulk-value').value);
  
  if (isNaN(value)) return alert('Enter a valid value');
  if (!confirm(`Are you sure you want to apply a ${value}${type === 'percentage' ? '%' : ' ₹'} change to products?`)) return;
  
  try {
    await apiFetch('/api/products/bulk-update', 'POST', {
      category_id: catId === 'all' ? null : parseInt(catId),
      type,
      value
    });
    alert('✅ Bulk update successful!');
    document.getElementById('bulk-update-overlay').remove();
    loadProducts();
    loadStats();
  } catch (e) { alert(e.message); }
}
// ── Stock Management ─────────────────
function toggleNewStock(cb) {
  const row = cb.closest('.size-row');
  const ctrl = document.getElementById(cb.id.replace('size-', 'new-stock-ctrl-'));
  if (cb.checked) {
    if (ctrl) ctrl.style.display = 'flex';
    row.style.borderColor = 'var(--maroon)';
    row.style.background = 'var(--cream-warm)';
  } else {
    if (ctrl) ctrl.style.display = 'none';
    const stockInput = document.getElementById(cb.id.replace('size-', 'stock-'));
    if (stockInput) stockInput.value = '0';
    row.style.borderColor = 'var(--border-subtle)';
    row.style.background = '#f7f4f0';
  }
}
function adjustNewStock(sz, delta) {
  const input = document.getElementById('stock-' + sz);
  if (!input) return;
  const val = parseInt(input.value || '0', 10);
  input.value = Math.max(0, val + delta);
}
function addCustomSize(containerId, inputId, prefix) {
  const input = document.getElementById(inputId);
  const val = (input.value || '').trim();
  if (!val) return;
  if (document.getElementById(prefix + 'size-' + val)) { alert('Size already exists'); return; }
  const container = document.getElementById(containerId);
  const html = `
    <div class="size-row" style="display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--cream-warm);border:1px solid var(--maroon);border-radius:4px;padding:8px 12px;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:8px;flex:1">
        <input type="checkbox" id="${prefix}size-${val}" name="${prefix}sizes[]" value="${val}" checked onchange="${prefix ? 'emToggleStock(this)' : 'toggleNewStock(this)'}" style="width:16px;height:16px;accent-color:var(--maroon);cursor:pointer"/>
        <label for="${prefix}size-${val}" style="font-size:12px;font-weight:700;letter-spacing:1px;cursor:pointer;min-width:36px">${val}</label>
      </div>
      <div id="${prefix}new-stock-ctrl-${val}" style="display:flex;align-items:center;gap:4px">
        <span style="font-size:10px;color:#888;margin-right:4px">Stock:</span>
        <button type="button" onclick="${prefix ? 'adjustStock' : 'adjustNewStock'}('${val}', -1)" style="width:28px;height:28px;border:1px solid #ddd;background:#fff;border-radius:4px;cursor:pointer;font-weight:bold">-</button>
        <input type="number" id="${prefix}stock-${val}" name="${prefix}stock[]" min="0" value="0" style="width:50px;height:28px;border:1px solid #ddd;border-radius:4px;text-align:center;font-size:12px"/>
        <button type="button" onclick="${prefix ? 'adjustStock' : 'adjustNewStock'}('${val}', 1)" style="width:28px;height:28px;border:1px solid #ddd;background:#fff;border-radius:4px;cursor:pointer;font-weight:bold">+</button>
      </div>
    </div>`;
  container.insertAdjacentHTML('beforeend', html);
  input.value = '';
}
console.log('Admin Dashboard script fully loaded.');
