import { test, expect } from '@playwright/test'
import { clearStorage, mockAuthAPIs, MOCK_CUSTOMER } from '../fixtures/helpers'

test.describe('Auth', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page)
    await mockAuthAPIs(page, { loginSuccess: true })
  })

  test('account button opens auth drawer', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Account' }).click()
    await expect(page.getByText('ACCOUNT', { exact: true })).toBeVisible()
    await expect(page.getByPlaceholder('Phone or Email')).toBeVisible()
    await expect(page.getByPlaceholder('Password')).toBeVisible()
  })

  test('invalid login shows error message', async ({ page }) => {
    await mockAuthAPIs(page, { loginSuccess: false })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Account' }).click()

    await page.getByPlaceholder('Phone or Email').fill('wrong@example.com')
    await page.getByPlaceholder('Password').fill('wrongpassword')
    await page.getByRole('button', { name: /^LOGIN$/i }).click()

    await expect(page.getByText(/Invalid credentials|Incorrect phone or password/i)).toBeVisible()
  })

  test('successful login redirects to account page', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Account' }).click()

    await page.getByPlaceholder('Phone or Email').fill('test@madebyzohra.in')
    await page.getByPlaceholder('Password').fill('password123')
    await page.getByRole('button', { name: /^LOGIN$/i }).click()

    await expect(page).toHaveURL('/account', { timeout: 10000 })
  })

  test('switch to signup shows all form fields', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Account' }).click()
    await page.getByRole('button', { name: /CREATE ACCOUNT/i }).click()

    await expect(page.getByPlaceholder('First name')).toBeVisible()
    await expect(page.getByPlaceholder('Last name')).toBeVisible()
    await expect(page.getByPlaceholder(/Phone Number/i)).toBeVisible()
    await expect(page.getByPlaceholder(/Password.*min/i)).toBeVisible()
    await expect(page.getByPlaceholder(/Confirm password/i)).toBeVisible()
  })

  test('signup shows error for mismatched passwords', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Account' }).click()
    await page.getByRole('button', { name: /CREATE ACCOUNT/i }).click()

    await page.getByPlaceholder('First name').fill('Test')
    await page.getByPlaceholder('Last name').fill('User')
    await page.getByPlaceholder(/Phone Number/i).fill('9876543210')
    await page.getByPlaceholder(/Password.*min/i).fill('password123')
    await page.getByPlaceholder(/Confirm password/i).fill('differentpassword')
    await page.getByRole('button', { name: /^CREATE ACCOUNT$/i }).click()

    await expect(page.getByText(/Passwords do not match/i)).toBeVisible()
  })

  test('back to login link works from signup', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Account' }).click()
    await page.getByRole('button', { name: /CREATE ACCOUNT/i }).click()

    await expect(page.getByPlaceholder('First name')).toBeVisible()

    await page.getByRole('button', { name: /Login/i }).click()
    await expect(page.getByPlaceholder('Phone or Email')).toBeVisible()
  })

  test('close button dismisses drawer', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Account' }).click()
    await expect(page.getByText('ACCOUNT', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: /Close/i }).click()
    await expect(page.getByText('ACCOUNT', { exact: true })).not.toBeVisible()
  })

  test('logged-in user clicking account goes to /account', async ({ page }) => {
    // Mock session to return customer
    await page.route('/api/auth/session', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ customer: MOCK_CUSTOMER }),
      })
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Login first to set customer state
    await page.getByRole('button', { name: 'Account' }).click()
    await page.getByPlaceholder('Phone or Email').fill('test@madebyzohra.in')
    await page.getByPlaceholder('Password').fill('password123')
    await page.getByRole('button', { name: /^LOGIN$/i }).click()
    await expect(page).toHaveURL('/account', { timeout: 10000 })
  })
})
