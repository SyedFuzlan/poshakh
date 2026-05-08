import type { Page } from '@playwright/test'

const BACKEND = process.env.BACKEND_URL || 'http://localhost:9000'

export const MOCK_PRODUCT = {
  id: 'test-saree-1',
  name: 'Test Silk Saree',
  slug: 'test-silk-saree',
  price: 5000,
  formattedPrice: '₹5,000',
  images: ['/images/products/saree1.png'],
  category_id: 1,
  category_name: 'sarees',
  description: 'A beautiful test saree',
  variants: [
    { id: 'v1', size: 'Free Size', stock: 10 },
  ],
}

export const MOCK_CATEGORIES = [
  { id: 1, name: 'Sarees', slug: 'sarees', parent_id: null, position: 1, description: null },
  { id: 2, name: 'Lehenga', slug: 'lehenga', parent_id: null, position: 2, description: null },
]

export const MOCK_CUSTOMER = {
  id: 'test-user-1',
  email: 'test@madebyzohra.in',
  phone: '9876543210',
  firstName: 'Test',
  lastName: 'User',
}

/** Mock all product API calls (client-side fetches from browser) */
export async function mockProductAPIs(page: Page) {
  await page.route(`${BACKEND}/api/products`, (route) => {
    const url = route.request().url()
    if (url.includes('category=')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ products: [MOCK_PRODUCT] }),
      })
    } else {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ products: [MOCK_PRODUCT] }),
      })
    }
  })
  await page.route(`${BACKEND}/api/products/categories`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_CATEGORIES),
    })
  })
  for (const id of [MOCK_PRODUCT.slug, MOCK_PRODUCT.id]) {
    await page.route(`${BACKEND}/api/products/${id}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ product: MOCK_PRODUCT }),
      })
    })
  }
}

/** Mock auth API routes (Next.js API routes — same origin) */
export async function mockAuthAPIs(page: Page, opts: { loginSuccess?: boolean } = {}) {
  const loginSuccess = opts.loginSuccess ?? true

  await page.route('/api/auth/login', (route) => {
    if (loginSuccess) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, customer: MOCK_CUSTOMER }),
      })
    } else {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Invalid credentials' }),
      })
    }
  })

  await page.route('/api/auth/signup', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, customer: MOCK_CUSTOMER }),
    })
  })

  await page.route('/api/auth/logout', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    })
  })

  await page.route('/api/auth/session', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ customer: null }),
    })
  })
}

/** Seed cart via localStorage before page load */
export async function seedCart(page: Page, quantity = 1) {
  await page.addInitScript(
    ({ product, qty }) => {
      const cartItem = {
        id: `${product.id}-Free Size`,
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: qty,
        image: product.images[0],
        size: 'Free Size',
      }
      localStorage.setItem('zohra_cart', JSON.stringify([cartItem]))
    },
    { product: MOCK_PRODUCT, qty: quantity }
  )
}

/** Clear all Zustand-persisted state */
export async function clearStorage(page: Page) {
  await page.addInitScript(() => {
    localStorage.removeItem('zohra_cart')
    localStorage.removeItem('zohra_cart_id')
    localStorage.removeItem('zohra_orders')
    localStorage.removeItem('zohra_last_customer_id')
  })
}
