import { test, expect } from '@playwright/test'
import { clearStorage, seedCart, mockProductAPIs } from '../fixtures/helpers'

const BACKEND = process.env.BACKEND_URL || 'http://localhost:9000'

const TEST_ADDRESS = {
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  address: '123 Test Street',
  city: 'Hyderabad',
  state: 'Telangana',
  pin: '500001',
  phone: '9876543210',
}

test.describe('Checkout', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page)
    await mockProductAPIs(page)
  })

  test('empty cart redirects to products', async ({ page }) => {
    await page.goto('/checkout')
    await expect(page.getByText(/Your cart is empty/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /SHOP NOW/i })).toBeVisible()
  })

  test('step 1: fills shipping info and proceeds', async ({ page }) => {
    await seedCart(page)
    await page.goto('/checkout')

    await expect(page.getByText(/Information/i).first()).toBeVisible()

    // Fill contact
    const emailField = page.getByPlaceholder('Email address')
    await emailField.fill(TEST_ADDRESS.email)

    // Fill address
    await page.getByLabel('First name').fill(TEST_ADDRESS.firstName)
    await page.getByLabel('Last name').fill(TEST_ADDRESS.lastName)
    await page.getByLabel('Address').fill(TEST_ADDRESS.address)
    await page.getByLabel('City').fill(TEST_ADDRESS.city)
    await page.locator('select[name="state"], select').selectOption(TEST_ADDRESS.state)
    await page.getByLabel(/PIN Code/i).fill(TEST_ADDRESS.pin)
    await page.getByPlaceholder(/9876543210/i).fill(TEST_ADDRESS.phone)

    // Mock checkout intent tracking
    await page.route(`${BACKEND}/api/checkouts`, (route) => route.fulfill({ status: 200, body: '{}' }))

    await page.getByRole('button', { name: /Continue to shipping/i }).click()

    // Should advance to step 2
    await expect(page.getByText(/Shipping method/i)).toBeVisible()
  })

  test('step 2: selects shipping and proceeds to payment', async ({ page }) => {
    await seedCart(page)
    await page.goto('/checkout')

    // Fast-forward via route fill: fill info and click continue
    await page.route(`${BACKEND}/api/checkouts`, (route) => route.fulfill({ status: 200, body: '{}' }))

    await page.getByPlaceholder('Email address').fill(TEST_ADDRESS.email)
    await page.getByLabel('First name').fill(TEST_ADDRESS.firstName)
    await page.getByLabel('Last name').fill(TEST_ADDRESS.lastName)
    await page.getByLabel('Address').fill(TEST_ADDRESS.address)
    await page.getByLabel('City').fill(TEST_ADDRESS.city)
    await page.locator('select').selectOption(TEST_ADDRESS.state)
    await page.getByLabel(/PIN Code/i).fill(TEST_ADDRESS.pin)
    await page.getByPlaceholder(/9876543210/i).fill(TEST_ADDRESS.phone)
    await page.getByRole('button', { name: /Continue to shipping/i }).click()

    await expect(page.getByText(/Shipping method/i)).toBeVisible()

    // Default is free shipping — just continue
    await page.getByRole('button', { name: /Continue to payment/i }).click()

    await expect(page.getByText(/Payment/i).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /CASH ON DELIVERY/i })).toBeVisible()
  })

  test('step 3: dev simulate completes order', async ({ page }) => {
    // Requires NEXT_PUBLIC_DEV_SIMULATE=true in the dev server (set in playwright.config.ts webServer)
    await seedCart(page)

    // Mock COD order endpoint
    await page.route(`${BACKEND}/api/orders`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, order_id: 'test-order-123' }),
      })
    })
    await page.route(`${BACKEND}/api/checkouts`, (route) => route.fulfill({ status: 200, body: '{}' }))

    await page.goto('/checkout')

    // Step 1
    await page.getByPlaceholder('Email address').fill(TEST_ADDRESS.email)
    await page.getByLabel('First name').fill(TEST_ADDRESS.firstName)
    await page.getByLabel('Last name').fill(TEST_ADDRESS.lastName)
    await page.getByLabel('Address').fill(TEST_ADDRESS.address)
    await page.getByLabel('City').fill(TEST_ADDRESS.city)
    await page.locator('select').selectOption(TEST_ADDRESS.state)
    await page.getByLabel(/PIN Code/i).fill(TEST_ADDRESS.pin)
    await page.getByPlaceholder(/9876543210/i).fill(TEST_ADDRESS.phone)
    await page.getByRole('button', { name: /Continue to shipping/i }).click()

    // Step 2
    await expect(page.getByText(/Shipping method/i)).toBeVisible()
    await page.getByRole('button', { name: /Continue to payment/i }).click()

    // Step 3 — use dev simulate if available, else COD
    await expect(page.getByText(/Payment/)).toBeVisible()

    const devBtn = page.getByRole('button', { name: /Simulate Payment/i })
    if (await devBtn.isVisible()) {
      await devBtn.click()
    } else {
      await page.getByRole('button', { name: /CASH ON DELIVERY/i }).click()
    }

    await expect(page).toHaveURL(/order-confirmation/, { timeout: 10000 })
  })

  test('order summary shows cart item', async ({ page }) => {
    await seedCart(page)
    await page.goto('/checkout')
    await expect(page.getByText('Test Silk Saree')).toBeVisible()
    await expect(page.getByText('₹5,000')).toBeVisible()
  })

  test('change link on step 2 goes back to step 1', async ({ page }) => {
    await seedCart(page)
    await page.route(`${BACKEND}/api/checkouts`, (route) => route.fulfill({ status: 200, body: '{}' }))
    await page.goto('/checkout')

    await page.getByPlaceholder('Email address').fill(TEST_ADDRESS.email)
    await page.getByLabel('First name').fill(TEST_ADDRESS.firstName)
    await page.getByLabel('Last name').fill(TEST_ADDRESS.lastName)
    await page.getByLabel('Address').fill(TEST_ADDRESS.address)
    await page.getByLabel('City').fill(TEST_ADDRESS.city)
    await page.locator('select').selectOption(TEST_ADDRESS.state)
    await page.getByLabel(/PIN Code/i).fill(TEST_ADDRESS.pin)
    await page.getByPlaceholder(/9876543210/i).fill(TEST_ADDRESS.phone)
    await page.getByRole('button', { name: /Continue to shipping/i }).click()

    await expect(page.getByText(/Shipping method/i)).toBeVisible()
    await page.getByRole('button', { name: /← Return to information/i }).click()
    await expect(page.getByText(/Contact/)).toBeVisible()
  })
})
