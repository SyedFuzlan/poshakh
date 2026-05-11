import { test, expect } from '@playwright/test'
import { clearStorage, mockProductAPIs, seedCart, MOCK_PRODUCT } from '../fixtures/helpers'

test.describe('Cart', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page)
    await mockProductAPIs(page)
  })

  test('cart badge hidden when cart is empty', async ({ page }) => {
    await page.goto('/')
    const badge = page.locator('button[aria-label="Cart"] span')
    await expect(badge).not.toBeVisible()
  })

  test('add product to cart shows badge', async ({ page }) => {
    await page.goto(`/products/${MOCK_PRODUCT.slug}`)
    await page.getByRole('button', { name: /Add to Cart/i }).first().click()
    const badge = page.locator('button[aria-label="Cart"] span')
    await expect(badge).toBeVisible()
    await expect(badge).toHaveText('1')
  })

  test('cart drawer opens with item after add to cart', async ({ page }) => {
    await page.goto(`/products/${MOCK_PRODUCT.slug}`)
    await page.getByRole('button', { name: /Add to Cart/i }).first().click()
    // Drawer opens automatically after add to cart
    await expect(page.getByText(/My Bag/i)).toBeVisible()
    await expect(page.getByText(MOCK_PRODUCT.name).first()).toBeVisible()
  })

  test('cart drawer opens via navbar cart button', async ({ page }) => {
    await seedCart(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'Cart' }).click()
    await expect(page.getByText(/My Bag/i)).toBeVisible()
    await expect(page.getByText(MOCK_PRODUCT.name)).toBeVisible()
  })

  test('quantity increment works', async ({ page }) => {
    await seedCart(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'Cart' }).click()
    await expect(page.getByText(/My Bag/)).toBeVisible()

    const incBtn = page.getByRole('button', { name: '+' }).first()
    await incBtn.click()

    // Drawer might be open — check quantity display
    await expect(page.locator('span').filter({ hasText: '2' }).first()).toBeVisible()
  })

  test('quantity decrement removes item at zero', async ({ page }) => {
    await seedCart(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'Cart' }).click()
    await expect(page.getByText(/My Bag/)).toBeVisible()

    const decBtn = page.getByRole('button', { name: '−' }).first()
    await decBtn.click()

    // Cart should be empty
    await expect(page.getByText(/Your Bag is empty/i)).toBeVisible()
  })

  test('remove button clears item', async ({ page }) => {
    await seedCart(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'Cart' }).click()
    await expect(page.getByText(MOCK_PRODUCT.name)).toBeVisible()

    // Trash icon button (last button in cart item row)
    const cartItem = page.locator('[class*="flex gap-4 items-start"]').first()
    await cartItem.getByRole('button').last().click()

    await expect(page.getByText(/Your Bag is empty/i)).toBeVisible()
  })

  test('SECURE CHECKOUT button navigates to checkout', async ({ page }) => {
    await seedCart(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'Cart' }).click()
    await page.getByRole('button', { name: /SECURE CHECKOUT/i }).click()
    await expect(page).toHaveURL('/checkout')
  })

  test('cart persists across page reload', async ({ page }) => {
    await seedCart(page)
    await page.goto('/')
    const badge = page.locator('button[aria-label="Cart"] span')
    await expect(badge).toBeVisible()
    await expect(badge).toHaveText('1')

    await page.reload()
    await expect(badge).toBeVisible()
    await expect(badge).toHaveText('1')
  })
})
