import { test, expect } from '@playwright/test'
import { MOCK_CUSTOMER } from '../fixtures/helpers'

const MOCK_ORDER = {
  id: 'PSK-TESTORD-001',
  paymentId: 'pay_test123',
  date: new Date().toISOString(),
  items: [{
    id: 'test-saree-1-Free Size',
    productId: 'test-saree-1',
    name: 'Test Silk Saree',
    price: 5000,
    quantity: 1,
    image: '/images/products/saree1.png',
    size: 'Free Size',
  }],
  subtotal: 5000,
  shippingAddress: {
    firstName: 'Test', lastName: 'User',
    address: '123 Test St', city: 'Hyderabad',
    state: 'Telangana', pinCode: '500001', phone: '9876543210',
  },
  shippingMethod: 'free' as const,
}

test.describe('Account — order history', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      ({ customerId, orders }) => {
        localStorage.setItem('zohra_last_customer_id', customerId)
        localStorage.setItem('zohra_orders', JSON.stringify(orders))
      },
      { customerId: MOCK_CUSTOMER.id, orders: [MOCK_ORDER] }
    )

    await page.route('/api/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ customer: MOCK_CUSTOMER }),
      })
    )

    await page.route('/api/auth/logout', (route) =>
      route.fulfill({ status: 200, body: '{"success":true}' })
    )
  })

  test('logged-in user sees order history with correct count', async ({ page }) => {
    await page.goto('/account')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(/ORDERS \(1\)/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('pay_test123')).toBeVisible()
  })

  test('order item thumbnails visible in order card', async ({ page }) => {
    await page.goto('/account')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(/ORDERS \(1\)/i)).toBeVisible({ timeout: 10000 })

    const orderCard = page.locator('div').filter({ hasText: 'pay_test123' }).first()
    await expect(orderCard).toBeVisible()
  })

  test('expand order shows item details', async ({ page }) => {
    await page.goto('/account')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(/ORDERS \(1\)/i)).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: /View details/i }).click()

    await expect(page.getByText('Test Silk Saree')).toBeVisible()
    await expect(page.getByText(/Hyderabad/)).toBeVisible()
  })

  test('shows profile info alongside orders', async ({ page }) => {
    await page.goto('/account')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Test User')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(MOCK_CUSTOMER.email)).toBeVisible()
  })
})
