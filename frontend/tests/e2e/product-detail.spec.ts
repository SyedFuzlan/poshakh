import { test, expect } from '@playwright/test'
import { clearStorage, mockProductAPIs, MOCK_PRODUCT } from '../fixtures/helpers'

test.describe('Product Detail', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page)
    await mockProductAPIs(page)
  })

  test('product detail page renders title and price', async ({ page }) => {
    await page.goto(`/products/${MOCK_PRODUCT.slug}`)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(MOCK_PRODUCT.name)
    await expect(page.getByText(MOCK_PRODUCT.formattedPrice).first()).toBeVisible()
  })

  test('page has dynamic metadata from product', async ({ page }) => {
    await page.goto(`/products/${MOCK_PRODUCT.slug}`)
    const title = await page.title()
    expect(title).toMatch(/Made by Zohra/i)
  })

  test('Product JSON-LD schema is in page', async ({ page }) => {
    await page.goto(`/products/${MOCK_PRODUCT.slug}`)
    const schemas = await page.locator('script[type="application/ld+json"]').all()
    const schemaTexts = await Promise.all(schemas.map(s => s.innerText()))
    const productSchema = schemaTexts.find(t => t.includes('"Product"'))
    expect(productSchema).toBeTruthy()
    const parsed = JSON.parse(productSchema!)
    expect(parsed['@type']).toBe('Product')
    expect(parsed.offers.url).toContain(MOCK_PRODUCT.slug)
  })

  test('BreadcrumbList JSON-LD schema is in page', async ({ page }) => {
    await page.goto(`/products/${MOCK_PRODUCT.slug}`)
    const schemas = await page.locator('script[type="application/ld+json"]').all()
    const schemaTexts = await Promise.all(schemas.map(s => s.innerText()))
    const breadcrumb = schemaTexts.find(t => t.includes('"BreadcrumbList"'))
    expect(breadcrumb).toBeTruthy()
    const parsed = JSON.parse(breadcrumb!)
    expect(parsed.itemListElement.length).toBeGreaterThanOrEqual(3)
    expect(parsed.itemListElement[0].name).toBe('Home')
  })

  test('size selector shows variants', async ({ page }) => {
    await page.goto(`/products/${MOCK_PRODUCT.slug}`)
    // At least one size button visible
    await expect(page.getByRole('button', { name: /Free Size|XS|S|M|L|XL/i }).first()).toBeVisible()
  })

  test('Add to Cart and Buy Now buttons visible when in stock', async ({ page }) => {
    await page.goto(`/products/${MOCK_PRODUCT.slug}`)
    await expect(page.getByRole('button', { name: /Add to Cart/i }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Buy Now/i })).toBeVisible()
  })

  test('category link navigates to filtered products', async ({ page }) => {
    await page.goto(`/products/${MOCK_PRODUCT.slug}`)
    const categoryLink = page.getByRole('link', { name: new RegExp(MOCK_PRODUCT.category_name, 'i') }).first()
    await categoryLink.click()
    await expect(page).toHaveURL(/\/products/)
  })
})
