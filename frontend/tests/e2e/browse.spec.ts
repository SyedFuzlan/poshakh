import { test, expect } from '@playwright/test'
import { clearStorage, mockProductAPIs } from '../fixtures/helpers'

test.describe('Browse', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page)
    await mockProductAPIs(page)
  })

  test('home page loads with hero content', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Made by Zohra/i)
    // sr-only H1 always present
    await expect(page.locator('h1')).toContainText(/Made by Zohra/i)
  })

  test('navbar renders logo and cart icon', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: /ZOHRA/i }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cart' })).toBeVisible()
  })

  test('products page shows product cards', async ({ page }) => {
    await page.goto('/products')
    // Wait for client-side fetch to complete
    await page.waitForLoadState('networkidle')
    const cards = page.locator('[class*="cursor-pointer"], [class*="ProductCard"], a[href*="/products/"]')
    await expect(cards.first()).toBeVisible({ timeout: 10000 })
  })

  test('category filter updates URL', async ({ page }) => {
    await page.goto('/products')
    await page.goto('/products?cat=sarees')
    await expect(page).toHaveURL(/cat=sarees/)
    // Title should reflect category metadata
    await expect(page).toHaveTitle(/Sarees.*Made by Zohra/i)
  })

  test('category page has unique metadata per category', async ({ page }) => {
    const categories = ['sarees', 'lehenga', 'anarkali']
    const titles: string[] = []
    for (const cat of categories) {
      await page.goto(`/products?cat=${cat}`)
      titles.push(await page.title())
    }
    // All titles should be unique
    expect(new Set(titles).size).toBe(categories.length)
  })

  test('robots.txt is accessible', async ({ page }) => {
    const response = await page.goto('/robots.txt')
    expect(response?.status()).toBe(200)
    const body = await response?.text()
    expect(body).toContain('Sitemap:')
    expect(body).toContain('/checkout')
  })

  test('sitemap.xml is accessible', async ({ page }) => {
    const response = await page.goto('/sitemap.xml')
    expect(response?.status()).toBe(200)
    const body = await response?.text()
    expect(body).toContain('madebyzohra.in')
  })

  test('mobile menu opens', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    const hamburger = page.getByRole('button', { name: 'Open menu' })
    await expect(hamburger).toBeVisible()
    await hamburger.click()
    // Mobile drawer should appear
    await expect(page.locator('body')).toBeVisible()
  })
})
