 attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/account-Account-—-order-hi-f07f6-nd-order-shows-item-details-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/account-Account-—-order-hi-f07f6-nd-order-shows-item-details-chromium/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/account-Account-—-order-hi-f07f6-nd-order-shows-item-details-chromium/error-context.md
    Retry #1 ───────────────────────────────────────────────────────────────────────────────────────
    Error: expect(locator).toBeVisible() failed
    Locator: getByText(/Hyderabad/)
    Expected: visible
    Error: strict mode violation: getByText(/Hyderabad/) resolved to 3 elements:
        1) <div>…</div> aka getByText('Shipped to: 123 Test St,')
        2) <p>Born in the heart of Hyderabad, Made by Zohra cel…</p> aka getByText('Born in the heart of')
        3) <div class="text-center">…</div> aka getByText('© 2026 MADE BY ZOHRA —')
    Call log:
      - Expect "toBeVisible" with timeout 5000ms
      - waiting for getByText(/Hyderabad/)
      73 |
      74 |     await expect(page.getByText('Test Silk Saree')).toBeVisible()
    > 75 |     await expect(page.getByText(/Hyderabad/)).toBeVisible()
         |                                               ^
      76 |   })
      77 |
      78 |   test('shows profile info alongside orders', async ({ page }) => {
        at /home/runner/work/poshakh/poshakh/frontend/tests/e2e/account.spec.ts:75:47
    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/account-Account-—-order-hi-f07f6-nd-order-shows-item-details-chromium-retry1/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/account-Account-—-order-hi-f07f6-nd-order-shows-item-details-chromium-retry1/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/account-Account-—-order-hi-f07f6-nd-order-shows-item-details-chromium-retry1/error-context.md
    attachment #4: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/account-Account-—-order-hi-f07f6-nd-order-shows-item-details-chromium-retry1/trace.zip
    Usage:
        npx playwright show-trace test-results/account-Account-—-order-hi-f07f6-nd-order-shows-item-details-chromium-retry1/trace.zip
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Retry #2 ───────────────────────────────────────────────────────────────────────────────────────
    Error: expect(locator).toBeVisible() failed
    Locator: getByText(/Hyderabad/)
    Expected: visible
    Error: strict mode violation: getByText(/Hyderabad/) resolved to 3 elements:
        1) <div>…</div> aka getByText('Shipped to: 123 Test St,')
        2) <p>Born in the heart of Hyderabad, Made by Zohra cel…</p> aka getByText('Born in the heart of')
        3) <div class="text-center">…</div> aka getByText('© 2026 MADE BY ZOHRA —')
    Call log:
      - Expect "toBeVisible" with timeout 5000ms
      - waiting for getByText(/Hyderabad/)
      73 |
      74 |     await expect(page.getByText('Test Silk Saree')).toBeVisible()
    > 75 |     await expect(page.getByText(/Hyderabad/)).toBeVisible()
         |                                               ^
      76 |   })
      77 |
      78 |   test('shows profile info alongside orders', async ({ page }) => {
        at /home/runner/work/poshakh/poshakh/frontend/tests/e2e/account.spec.ts:75:47
    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/account-Account-—-order-hi-f07f6-nd-order-shows-item-details-chromium-retry2/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/account-Account-—-order-hi-f07f6-nd-order-shows-item-details-chromium-retry2/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/account-Account-—-order-hi-f07f6-nd-order-shows-item-details-chromium-retry2/error-context.md
  2) [chromium] › tests/e2e/auth.spec.ts:10:7 › Auth › account button opens auth drawer ────────────
    Error: expect(locator).toBeVisible() failed
    Locator: getByText('ACCOUNT')
    Expected: visible
    Error: strict mode violation: getByText('ACCOUNT') resolved to 4 elements:
        1) <span>ACCOUNT</span> aka getByText('ACCOUNT', { exact: true })
        2) <h3>DON'T HAVE AN ACCOUNT?</h3> aka getByRole('heading', { name: 'DON\'T HAVE AN ACCOUNT?' })
        3) <p>Create an account to unlock a world of benefits:</p> aka getByText('Create an account to unlock a')
        4) <button>CREATE ACCOUNT</button> aka getByRole('button', { name: 'CREATE ACCOUNT' })
    Call log:
      - Expect "toBeVisible" with timeout 5000ms
      - waiting for getByText('ACCOUNT')
      12 |     await page.waitForLoadState('networkidle')
      13 |     await page.getByRole('button', { name: 'Account' }).click()
    > 14 |     await expect(page.getByText('ACCOUNT')).toBeVisible()
         |                                             ^
      15 |     await expect(page.getByPlaceholder('Phone or Email')).toBeVisible()
      16 |     await expect(page.getByPlaceholder('Password')).toBeVisible()
      17 |   })
        at /home/runner/work/poshakh/poshakh/frontend/tests/e2e/auth.spec.ts:14:45
    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/auth-Auth-account-button-opens-auth-drawer-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/auth-Auth-account-button-opens-auth-drawer-chromium/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/auth-Auth-account-button-opens-auth-drawer-chromium/error-context.md
    Retry #1 ───────────────────────────────────────────────────────────────────────────────────────
    Error: expect(locator).toBeVisible() failed
    Locator: getByText('ACCOUNT')
    Expected: visible
    Error: strict mode violation: getByText('ACCOUNT') resolved to 4 elements:
        1) <span>ACCOUNT</span> aka getByText('ACCOUNT', { exact: true })
        2) <h3>DON'T HAVE AN ACCOUNT?</h3> aka getByRole('heading', { name: 'DON\'T HAVE AN ACCOUNT?' })
        3) <p>Create an account to unlock a world of benefits:</p> aka getByText('Create an account to unlock a')
        4) <button>CREATE ACCOUNT</button> aka getByRole('button', { name: 'CREATE ACCOUNT' })
    Call log:
      - Expect "toBeVisible" with timeout 5000ms
      - waiting for getByText('ACCOUNT')
      12 |     await page.waitForLoadState('networkidle')
      13 |     await page.getByRole('button', { name: 'Account' }).click()
    > 14 |     await expect(page.getByText('ACCOUNT')).toBeVisible()
         |                                             ^
      15 |     await expect(page.getByPlaceholder('Phone or Email')).toBeVisible()
      16 |     await expect(page.getByPlaceholder('Password')).toBeVisible()
      17 |   })
        at /home/runner/work/poshakh/poshakh/frontend/tests/e2e/auth.spec.ts:14:45
    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/auth-Auth-account-button-opens-auth-drawer-chromium-retry1/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/auth-Auth-account-button-opens-auth-drawer-chromium-retry1/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/auth-Auth-account-button-opens-auth-drawer-chromium-retry1/error-context.md
    attachment #4: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/auth-Auth-account-button-opens-auth-drawer-chromium-retry1/trace.zip
    Usage:
        npx playwright show-trace test-results/auth-Auth-account-button-opens-auth-drawer-chromium-retry1/trace.zip
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Retry #2 ───────────────────────────────────────────────────────────────────────────────────────
    Error: expect(locator).toBeVisible() failed
    Locator: getByText('ACCOUNT')
    Expected: visible
    Error: strict mode violation: getByText('ACCOUNT') resolved to 4 elements:
        1) <span>ACCOUNT</span> aka getByText('ACCOUNT', { exact: true })
        2) <h3>DON'T HAVE AN ACCOUNT?</h3> aka getByRole('heading', { name: 'DON\'T HAVE AN ACCOUNT?' })
        3) <p>Create an account to unlock a world of benefits:</p> aka getByText('Create an account to unlock a')
        4) <button>CREATE ACCOUNT</button> aka getByRole('button', { name: 'CREATE ACCOUNT' })
    Call log:
      - Expect "toBeVisible" with timeout 5000ms
      - waiting for getByText('ACCOUNT')
      12 |     await page.waitForLoadState('networkidle')
      13 |     await page.getByRole('button', { name: 'Account' }).click()
    > 14 |     await expect(page.getByText('ACCOUNT')).toBeVisible()
         |                                             ^
      15 |     await expect(page.getByPlaceholder('Phone or Email')).toBeVisible()
      16 |     await expect(page.getByPlaceholder('Password')).toBeVisible()
      17 |   })
        at /home/runner/work/poshakh/poshakh/frontend/tests/e2e/auth.spec.ts:14:45
    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/auth-Auth-account-button-opens-auth-drawer-chromium-retry2/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/auth-Auth-account-button-opens-auth-drawer-chromium-retry2/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/auth-Auth-account-button-opens-auth-drawer-chromium-retry2/error-context.md
  3) [chromium] › tests/e2e/auth.spec.ts:85:7 › Auth › close button dismisses drawer ───────────────
    Error: expect(locator).toBeVisible() failed
    Locator: getByText('ACCOUNT')
    Expected: visible
    Error: strict mode violation: getByText('ACCOUNT') resolved to 4 elements:
        1) <span>ACCOUNT</span> aka getByText('ACCOUNT', { exact: true })
        2) <h3>DON'T HAVE AN ACCOUNT?</h3> aka getByRole('heading', { name: 'DON\'T HAVE AN ACCOUNT?' })
        3) <p>Create an account to unlock a world of benefits:</p> aka getByText('Create an account to unlock a')
        4) <button>CREATE ACCOUNT</button> aka getByRole('button', { name: 'CREATE ACCOUNT' })
    Call log:
      - Expect "toBeVisible" with timeout 5000ms
      - waiting for getByText('ACCOUNT')
      87 |     await page.waitForLoadState('networkidle')
      88 |     await page.getByRole('button', { name: 'Account' }).click()
    > 89 |     await expect(page.getByText('ACCOUNT')).toBeVisible()
         |                                             ^
      90 |
      91 |     await page.getByRole('button', { name: /Close/i }).click()
      92 |     await expect(page.getByText('ACCOUNT')).not.toBeVisible()
        at /home/runner/work/poshakh/poshakh/frontend/tests/e2e/auth.spec.ts:89:45
    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/auth-Auth-close-button-dismisses-drawer-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/auth-Auth-close-button-dismisses-drawer-chromium/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/auth-Auth-close-button-dismisses-drawer-chromium/error-context.md
    Retry #1 ───────────────────────────────────────────────────────────────────────────────────────
    Error: expect(locator).toBeVisible() failed
    Locator: getByText('ACCOUNT')
    Expected: visible
    Error: strict mode violation: getByText('ACCOUNT') resolved to 4 elements:
        1) <span>ACCOUNT</span> aka getByText('ACCOUNT', { exact: true })
        2) <h3>DON'T HAVE AN ACCOUNT?</h3> aka getByRole('heading', { name: 'DON\'T HAVE AN ACCOUNT?' })
        3) <p>Create an account to unlock a world of benefits:</p> aka getByText('Create an account to unlock a')
        4) <button>CREATE ACCOUNT</button> aka getByRole('button', { name: 'CREATE ACCOUNT' })
    Call log:
      - Expect "toBeVisible" with timeout 5000ms
      - waiting for getByText('ACCOUNT')
      87 |     await page.waitForLoadState('networkidle')
      88 |     await page.getByRole('button', { name: 'Account' }).click()
    > 89 |     await expect(page.getByText('ACCOUNT')).toBeVisible()
         |                                             ^
      90 |
      91 |     await page.getByRole('button', { name: /Close/i }).click()
      92 |     await expect(page.getByText('ACCOUNT')).not.toBeVisible()
        at /home/runner/work/poshakh/poshakh/frontend/tests/e2e/auth.spec.ts:89:45
    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/auth-Auth-close-button-dismisses-drawer-chromium-retry1/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/auth-Auth-close-button-dismisses-drawer-chromium-retry1/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/auth-Auth-close-button-dismisses-drawer-chromium-retry1/error-context.md
    attachment #4: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/auth-Auth-close-button-dismisses-drawer-chromium-retry1/trace.zip
    Usage:
        npx playwright show-trace test-results/auth-Auth-close-button-dismisses-drawer-chromium-retry1/trace.zip
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Retry #2 ───────────────────────────────────────────────────────────────────────────────────────
    Error: expect(locator).toBeVisible() failed
    Locator: getByText('ACCOUNT')
    Expected: visible
    Error: strict mode violation: getByText('ACCOUNT') resolved to 4 elements:
        1) <span>ACCOUNT</span> aka getByText('ACCOUNT', { exact: true })
        2) <h3>DON'T HAVE AN ACCOUNT?</h3> aka getByRole('heading', { name: 'DON\'T HAVE AN ACCOUNT?' })
        3) <p>Create an account to unlock a world of benefits:</p> aka getByText('Create an account to unlock a')
        4) <button>CREATE ACCOUNT</button> aka getByRole('button', { name: 'CREATE ACCOUNT' })
    Call log:
      - Expect "toBeVisible" with timeout 5000ms
      - waiting for getByText('ACCOUNT')
      87 |     await page.waitForLoadState('networkidle')
      88 |     await page.getByRole('button', { name: 'Account' }).click()
    > 89 |     await expect(page.getByText('ACCOUNT')).toBeVisible()
         |                                             ^
      90 |
      91 |     await page.getByRole('button', { name: /Close/i }).click()
      92 |     await expect(page.getByText('ACCOUNT')).not.toBeVisible()
        at /home/runner/work/poshakh/poshakh/frontend/tests/e2e/auth.spec.ts:89:45
    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/auth-Auth-close-button-dismisses-drawer-chromium-retry2/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/auth-Auth-close-button-dismisses-drawer-chromium-retry2/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/auth-Auth-close-button-dismisses-drawer-chromium-retry2/error-context.md
  4) [chromium] › tests/e2e/browse.spec.ts:50:7 › Browse › robots.txt is accessible ────────────────
    Error: expect(received).toBe(expected) // Object.is equality
    Expected: 200
    Received: 500
      50 |   test('robots.txt is accessible', async ({ page }) => {
      51 |     const response = await page.goto('/robots.txt')
    > 52 |     expect(response?.status()).toBe(200)
         |                                ^
      53 |     const body = await response?.text()
      54 |     expect(body).toContain('Sitemap:')
      55 |     expect(body).toContain('/checkout')
        at /home/runner/work/poshakh/poshakh/frontend/tests/e2e/browse.spec.ts:52:32
    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/browse-Browse-robots-txt-is-accessible-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/browse-Browse-robots-txt-is-accessible-chromium/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/browse-Browse-robots-txt-is-accessible-chromium/error-context.md
    Retry #1 ───────────────────────────────────────────────────────────────────────────────────────
    Error: expect(received).toBe(expected) // Object.is equality
    Expected: 200
    Received: 500
      50 |   test('robots.txt is accessible', async ({ page }) => {
      51 |     const response = await page.goto('/robots.txt')
    > 52 |     expect(response?.status()).toBe(200)
         |                                ^
      53 |     const body = await response?.text()
      54 |     expect(body).toContain('Sitemap:')
      55 |     expect(body).toContain('/checkout')
        at /home/runner/work/poshakh/poshakh/frontend/tests/e2e/browse.spec.ts:52:32
    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/browse-Browse-robots-txt-is-accessible-chromium-retry1/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/browse-Browse-robots-txt-is-accessible-chromium-retry1/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/browse-Browse-robots-txt-is-accessible-chromium-retry1/error-context.md
    attachment #4: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/browse-Browse-robots-txt-is-accessible-chromium-retry1/trace.zip
    Usage:
        npx playwright show-trace test-results/browse-Browse-robots-txt-is-accessible-chromium-retry1/trace.zip
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Retry #2 ───────────────────────────────────────────────────────────────────────────────────────
    Error: expect(received).toBe(expected) // Object.is equality
    Expected: 200
    Received: 500
      50 |   test('robots.txt is accessible', async ({ page }) => {
      51 |     const response = await page.goto('/robots.txt')
    > 52 |     expect(response?.status()).toBe(200)
         |                                ^
      53 |     const body = await response?.text()
      54 |     expect(body).toContain('Sitemap:')
      55 |     expect(body).toContain('/checkout')
        at /home/runner/work/poshakh/poshakh/frontend/tests/e2e/browse.spec.ts:52:32
    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/browse-Browse-robots-txt-is-accessible-chromium-retry2/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/browse-Browse-robots-txt-is-accessible-chromium-retry2/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/browse-Browse-robots-txt-is-accessible-chromium-retry2/error-context.md
  5) [chromium] › tests/e2e/cart.spec.ts:16:7 › Cart › add product to cart shows badge ─────────────
    TimeoutError: locator.click: Timeout 15000ms exceeded.
    Call log:
      - waiting for getByRole('button', { name: /Add to Cart/i })
      16 |   test('add product to cart shows badge', async ({ page }) => {
      17 |     await page.goto(`/products/${MOCK_PRODUCT.slug}`)
    > 18 |     await page.getByRole('button', { name: /Add to Cart/i }).click()
         |                                                              ^
      19 |     const badge = page.locator('button[aria-label="Cart"] span')
      20 |     await expect(badge).toBeVisible()
      21 |     await expect(badge).toHaveText('1')
        at /home/runner/work/poshakh/poshakh/frontend/tests/e2e/cart.spec.ts:18:62
    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/cart-Cart-add-product-to-cart-shows-badge-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/cart-Cart-add-product-to-cart-shows-badge-chromium/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/cart-Cart-add-product-to-cart-shows-badge-chromium/error-context.md
    Retry #1 ───────────────────────────────────────────────────────────────────────────────────────
    TimeoutError: locator.click: Timeout 15000ms exceeded.
    Call log:
      - waiting for getByRole('button', { name: /Add to Cart/i })
      16 |   test('add product to cart shows badge', async ({ page }) => {
      17 |     await page.goto(`/products/${MOCK_PRODUCT.slug}`)
    > 18 |     await page.getByRole('button', { name: /Add to Cart/i }).click()
         |                                                              ^
      19 |     const badge = page.locator('button[aria-label="Cart"] span')
      20 |     await expect(badge).toBeVisible()
      21 |     await expect(badge).toHaveText('1')
        at /home/runner/work/poshakh/poshakh/frontend/tests/e2e/cart.spec.ts:18:62
    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/cart-Cart-add-product-to-cart-shows-badge-chromium-retry1/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/cart-Cart-add-product-to-cart-shows-badge-chromium-retry1/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/cart-Cart-add-product-to-cart-shows-badge-chromium-retry1/error-context.md
    attachment #4: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/cart-Cart-add-product-to-cart-shows-badge-chromium-retry1/trace.zip
    Usage:
        npx playwright show-trace test-results/cart-Cart-add-product-to-cart-shows-badge-chromium-retry1/trace.zip
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Retry #2 ───────────────────────────────────────────────────────────────────────────────────────
    TimeoutError: locator.click: Timeout 15000ms exceeded.
    Call log:
      - waiting for getByRole('button', { name: /Add to Cart/i })
      16 |   test('add product to cart shows badge', async ({ page }) => {
      17 |     await page.goto(`/products/${MOCK_PRODUCT.slug}`)
    > 18 |     await page.getByRole('button', { name: /Add to Cart/i }).click()
         |                                                              ^
      19 |     const badge = page.locator('button[aria-label="Cart"] span')
      20 |     await expect(badge).toBeVisible()
      21 |     await expect(badge).toHaveText('1')
        at /home/runner/work/poshakh/poshakh/frontend/tests/e2e/cart.spec.ts:18:62
    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/cart-Cart-add-product-to-cart-shows-badge-chromium-retry2/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/cart-Cart-add-product-to-cart-shows-badge-chromium-retry2/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/cart-Cart-add-product-to-cart-shows-badge-chromium-retry2/error-context.md
  6) [chromium] › tests/e2e/cart.spec.ts:24:7 › Cart › cart drawer opens with item after add to cart 
    TimeoutError: locator.click: Timeout 15000ms exceeded.
    Call log:
      - waiting for getByRole('button', { name: /Add to Cart/i })
      24 |   test('cart drawer opens with item after add to cart', async ({ page }) => {
      25 |     await page.goto(`/products/${MOCK_PRODUCT.slug}`)
    > 26 |     await page.getByRole('button', { name: /Add to Cart/i }).click()
         |                                                              ^
      27 |     // Drawer opens automatically after add to cart
      28 |     await expect(page.getByText(/My Bag/i)).toBeVisible()
      29 |     await expect(page.getByText(MOCK_PRODUCT.name)).toBeVisible()
        at /home/runner/work/poshakh/poshakh/frontend/tests/e2e/cart.spec.ts:26:62
    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/cart-Cart-cart-drawer-opens-with-item-after-add-to-cart-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/cart-Cart-cart-drawer-opens-with-item-after-add-to-cart-chromium/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/cart-Cart-cart-drawer-opens-with-item-after-add-to-cart-chromium/error-context.md
    Retry #1 ───────────────────────────────────────────────────────────────────────────────────────
    TimeoutError: locator.click: Timeout 15000ms exceeded.
    Call log:
      - waiting for getByRole('button', { name: /Add to Cart/i })
      24 |   test('cart drawer opens with item after add to cart', async ({ page }) => {
      25 |     await page.goto(`/products/${MOCK_PRODUCT.slug}`)
    > 26 |     await page.getByRole('button', { name: /Add to Cart/i }).click()
         |                                                              ^
      27 |     // Drawer opens automatically after add to cart
      28 |     await expect(page.getByText(/My Bag/i)).toBeVisible()
      29 |     await expect(page.getByText(MOCK_PRODUCT.name)).toBeVisible()
        at /home/runner/work/poshakh/poshakh/frontend/tests/e2e/cart.spec.ts:26:62
    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/cart-Cart-cart-drawer-opens-with-item-after-add-to-cart-chromium-retry1/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/cart-Cart-cart-drawer-opens-with-item-after-add-to-cart-chromium-retry1/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/cart-Cart-cart-drawer-opens-with-item-after-add-to-cart-chromium-retry1/error-context.md
    attachment #4: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/cart-Cart-cart-drawer-opens-with-item-after-add-to-cart-chromium-retry1/trace.zip
    Usage:
        npx playwright show-trace test-results/cart-Cart-cart-drawer-opens-with-item-after-add-to-cart-chromium-retry1/trace.zip
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Retry #2 ───────────────────────────────────────────────────────────────────────────────────────
    TimeoutError: locator.click: Timeout 15000ms exceeded.
    Call log:
      - waiting for getByRole('button', { name: /Add to Cart/i })
      24 |   test('cart drawer opens with item after add to cart', async ({ page }) => {
      25 |     await page.goto(`/products/${MOCK_PRODUCT.slug}`)
    > 26 |     await page.getByRole('button', { name: /Add to Cart/i }).click()
         |                                                              ^
      27 |     // Drawer opens automatically after add to cart
      28 |     await expect(page.getByText(/My Bag/i)).toBeVisible()
      29 |     await expect(page.getByText(MOCK_PRODUCT.name)).toBeVisible()
        at /home/runner/work/poshakh/poshakh/frontend/tests/e2e/cart.spec.ts:26:62
    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/cart-Cart-cart-drawer-opens-with-item-after-add-to-cart-chromium-retry2/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/cart-Cart-cart-drawer-opens-with-item-after-add-to-cart-chromium-retry2/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/cart-Cart-cart-drawer-opens-with-item-after-add-to-cart-chromium-retry2/error-context.md
  7) [chromium] › tests/e2e/checkout.spec.ts:29:7 › Checkout › step 1: fills shipping info and proceeds 
    TimeoutError: locator.fill: Timeout 15000ms exceeded.
    Call log:
      - waiting for getByLabel('First name')
      38 |
      39 |     // Fill address
    > 40 |     await page.getByLabel('First name').fill(TEST_ADDRESS.firstName)
         |                                         ^
      41 |     await page.getByLabel('Last name').fill(TEST_ADDRESS.lastName)
      42 |     await page.getByLabel('Address').fill(TEST_ADDRESS.address)
      43 |     await page.getByLabel('City').fill(TEST_ADDRESS.city)
        at /home/runner/work/poshakh/poshakh/frontend/tests/e2e/checkout.spec.ts:40:41
    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/checkout-Checkout-step-1-fills-shipping-info-and-proceeds-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/checkout-Checkout-step-1-fills-shipping-info-and-proceeds-chromium/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/checkout-Checkout-step-1-fills-shipping-info-and-proceeds-chromium/error-context.md
    Retry #1 ───────────────────────────────────────────────────────────────────────────────────────
    TimeoutError: locator.fill: Timeout 15000ms exceeded.
    Call log:
      - waiting for getByLabel('First name')
      38 |
      39 |     // Fill address
    > 40 |     await page.getByLabel('First name').fill(TEST_ADDRESS.firstName)
         |                                         ^
      41 |     await page.getByLabel('Last name').fill(TEST_ADDRESS.lastName)
      42 |     await page.getByLabel('Address').fill(TEST_ADDRESS.address)
      43 |     await page.getByLabel('City').fill(TEST_ADDRESS.city)
        at /home/runner/work/poshakh/poshakh/frontend/tests/e2e/checkout.spec.ts:40:41
    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/checkout-Checkout-step-1-fills-shipping-info-and-proceeds-chromium-retry1/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/checkout-Checkout-step-1-fills-shipping-info-and-proceeds-chromium-retry1/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/checkout-Checkout-step-1-fills-shipping-info-and-proceeds-chromium-retry1/error-context.md
    attachment #4: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/checkout-Checkout-step-1-fills-shipping-info-and-proceeds-chromium-retry1/trace.zip
    Usage:
        npx playwright show-trace test-results/checkout-Checkout-step-1-fills-shipping-info-and-proceeds-chromium-retry1/trace.zip
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Retry #2 ───────────────────────────────────────────────────────────────────────────────────────
    TimeoutError: locator.fill: Timeout 15000ms exceeded.
    Call log:
      - waiting for getByLabel('First name')
      38 |
      39 |     // Fill address
    > 40 |     await page.getByLabel('First name').fill(TEST_ADDRESS.firstName)
         |                                         ^
      41 |     await page.getByLabel('Last name').fill(TEST_ADDRESS.lastName)
      42 |     await page.getByLabel('Address').fill(TEST_ADDRESS.address)
      43 |     await page.getByLabel('City').fill(TEST_ADDRESS.city)
        at /home/runner/work/poshakh/poshakh/frontend/tests/e2e/checkout.spec.ts:40:41
    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/checkout-Checkout-step-1-fills-shipping-info-and-proceeds-chromium-retry2/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/checkout-Checkout-step-1-fills-shipping-info-and-proceeds-chromium-retry2/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/checkout-Checkout-step-1-fills-shipping-info-and-proceeds-chromium-retry2/error-context.md
  8) [chromium] › tests/e2e/checkout.spec.ts:57:7 › Checkout › step 2: selects shipping and proceeds to payment 
    TimeoutError: locator.fill: Timeout 15000ms exceeded.
    Call log:
      - waiting for getByLabel('First name')
      63 |
      64 |     await page.getByPlaceholder('Email address').fill(TEST_ADDRESS.email)
    > 65 |     await page.getByLabel('First name').fill(TEST_ADDRESS.firstName)
         |                                         ^
      66 |     await page.getByLabel('Last name').fill(TEST_ADDRESS.lastName)
      67 |     await page.getByLabel('Address').fill(TEST_ADDRESS.address)
      68 |     await page.getByLabel('City').fill(TEST_ADDRESS.city)
        at /home/runner/work/poshakh/poshakh/frontend/tests/e2e/checkout.spec.ts:65:41
    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/checkout-Checkout-step-2-s-df48f-ing-and-proceeds-to-payment-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/checkout-Checkout-step-2-s-df48f-ing-and-proceeds-to-payment-chromium/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/checkout-Checkout-step-2-s-df48f-ing-and-proceeds-to-payment-chromium/error-context.md
    Retry #1 ───────────────────────────────────────────────────────────────────────────────────────
    TimeoutError: locator.fill: Timeout 15000ms exceeded.
    Call log:
      - waiting for getByLabel('First name')
      63 |
      64 |     await page.getByPlaceholder('Email address').fill(TEST_ADDRESS.email)
    > 65 |     await page.getByLabel('First name').fill(TEST_ADDRESS.firstName)
         |                                         ^
      66 |     await page.getByLabel('Last name').fill(TEST_ADDRESS.lastName)
      67 |     await page.getByLabel('Address').fill(TEST_ADDRESS.address)
      68 |     await page.getByLabel('City').fill(TEST_ADDRESS.city)
        at /home/runner/work/poshakh/poshakh/frontend/tests/e2e/checkout.spec.ts:65:41
    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/checkout-Checkout-step-2-s-df48f-ing-and-proceeds-to-payment-chromium-retry1/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/checkout-Checkout-step-2-s-df48f-ing-and-proceeds-to-payment-chromium-retry1/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/checkout-Checkout-step-2-s-df48f-ing-and-proceeds-to-payment-chromium-retry1/error-context.md
    attachment #4: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/checkout-Checkout-step-2-s-df48f-ing-and-proceeds-to-payment-chromium-retry1/trace.zip
    Usage:
        npx playwright show-trace test-results/checkout-Checkout-step-2-s-df48f-ing-and-proceeds-to-payment-chromium-retry1/trace.zip
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Retry #2 ───────────────────────────────────────────────────────────────────────────────────────
    TimeoutError: locator.fill: Timeout 15000ms exceeded.
    Call log:
      - waiting for getByLabel('First name')
      63 |
      64 |     await page.getByPlaceholder('Email address').fill(TEST_ADDRESS.email)
    > 65 |     await page.getByLabel('First name').fill(TEST_ADDRESS.firstName)
         |                                         ^
      66 |     await page.getByLabel('Last name').fill(TEST_ADDRESS.lastName)
      67 |     await page.getByLabel('Address').fill(TEST_ADDRESS.address)
      68 |     await page.getByLabel('City').fill(TEST_ADDRESS.city)
        at /home/runner/work/poshakh/poshakh/frontend/tests/e2e/checkout.spec.ts:65:41
    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/checkout-Checkout-step-2-s-df48f-ing-and-proceeds-to-payment-chromium-retry2/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/checkout-Checkout-step-2-s-df48f-ing-and-proceeds-to-payment-chromium-retry2/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/checkout-Checkout-step-2-s-df48f-ing-and-proceeds-to-payment-chromium-retry2/error-context.md
  9) [chromium] › tests/e2e/checkout.spec.ts:83:7 › Checkout › step 3: dev simulate completes order 
    TimeoutError: locator.fill: Timeout 15000ms exceeded.
    Call log:
      - waiting for getByLabel('First name')
       99 |     // Step 1
      100 |     await page.getByPlaceholder('Email address').fill(TEST_ADDRESS.email)
    > 101 |     await page.getByLabel('First name').fill(TEST_ADDRESS.firstName)
          |                                         ^
      102 |     await page.getByLabel('Last name').fill(TEST_ADDRESS.lastName)
      103 |     await page.getByLabel('Address').fill(TEST_ADDRESS.address)
      104 |     await page.getByLabel('City').fill(TEST_ADDRESS.city)
        at /home/runner/work/poshakh/poshakh/frontend/tests/e2e/checkout.spec.ts:101:41
    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/checkout-Checkout-step-3-dev-simulate-completes-order-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/checkout-Checkout-step-3-dev-simulate-completes-order-chromium/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/checkout-Checkout-step-3-dev-simulate-completes-order-chromium/error-context.md
    Retry #1 ───────────────────────────────────────────────────────────────────────────────────────
    TimeoutError: locator.fill: Timeout 15000ms exceeded.
    Call log:
      - waiting for getByLabel('First name')
       99 |     // Step 1
      100 |     await page.getByPlaceholder('Email address').fill(TEST_ADDRESS.email)
    > 101 |     await page.getByLabel('First name').fill(TEST_ADDRESS.firstName)
          |                                         ^
      102 |     await page.getByLabel('Last name').fill(TEST_ADDRESS.lastName)
      103 |     await page.getByLabel('Address').fill(TEST_ADDRESS.address)
      104 |     await page.getByLabel('City').fill(TEST_ADDRESS.city)
        at /home/runner/work/poshakh/poshakh/frontend/tests/e2e/checkout.spec.ts:101:41
    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/checkout-Checkout-step-3-dev-simulate-completes-order-chromium-retry1/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/checkout-Checkout-step-3-dev-simulate-completes-order-chromium-retry1/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/checkout-Checkout-step-3-dev-simulate-completes-order-chromium-retry1/error-context.md
    attachment #4: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/checkout-Checkout-step-3-dev-simulate-completes-order-chromium-retry1/trace.zip
    Usage:
        npx playwright show-trace test-results/checkout-Checkout-step-3-dev-simulate-completes-order-chromium-retry1/trace.zip
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Retry #2 ───────────────────────────────────────────────────────────────────────────────────────
    TimeoutError: locator.fill: Timeout 15000ms exceeded.
    Call log:
      - waiting for getByLabel('First name')
       99 |     // Step 1
      100 |     await page.getByPlaceholder('Email address').fill(TEST_ADDRESS.email)
    > 101 |     await page.getByLabel('First name').fill(TEST_ADDRESS.firstName)
          |                                         ^
      102 |     await page.getByLabel('Last name').fill(TEST_ADDRESS.lastName)
      103 |     await page.getByLabel('Address').fill(TEST_ADDRESS.address)
      104 |     await page.getByLabel('City').fill(TEST_ADDRESS.city)
        at /home/runner/work/poshakh/poshakh/frontend/tests/e2e/checkout.spec.ts:101:41
    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/checkout-Checkout-step-3-dev-simulate-completes-order-chromium-retry2/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/checkout-Checkout-step-3-dev-simulate-completes-order-chromium-retry2/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/checkout-Checkout-step-3-dev-simulate-completes-order-chromium-retry2/error-context.md
  10) [chromium] › tests/e2e/checkout.spec.ts:127:7 › Checkout › order summary shows cart item ─────
    Error: expect(locator).toBeVisible() failed
    Locator: getByText('₹5,000')
    Expected: visible
    Error: strict mode violation: getByText('₹5,000') resolved to 3 elements:
        1) <p>₹5,000</p> aka getByRole('paragraph').filter({ hasText: '₹' })
        2) <span>₹5,000</span> aka getByText('₹').nth(1)
        3) <span>₹5,000</span> aka getByText('₹').nth(2)
    Call log:
      - Expect "toBeVisible" with timeout 5000ms
      - waiting for getByText('₹5,000')
      129 |     await page.goto('/checkout')
      130 |     await expect(page.getByText('Test Silk Saree')).toBeVisible()
    > 131 |     await expect(page.getByText('₹5,000')).toBeVisible()
          |                                            ^
      132 |   })
      133 |
      134 |   test('change link on step 2 goes back to step 1', async ({ page }) => {
        at /home/runner/work/poshakh/poshakh/frontend/tests/e2e/checkout.spec.ts:131:44
    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/checkout-Checkout-order-summary-shows-cart-item-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/checkout-Checkout-order-summary-shows-cart-item-chromium/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/checkout-Checkout-order-summary-shows-cart-item-chromium/error-context.md
    Retry #1 ───────────────────────────────────────────────────────────────────────────────────────
    Error: expect(locator).toBeVisible() failed
    Locator: getByText('₹5,000')
    Expected: visible
    Error: strict mode violation: getByText('₹5,000') resolved to 3 elements:
        1) <p>₹5,000</p> aka getByRole('paragraph').filter({ hasText: '₹' })
        2) <span>₹5,000</span> aka getByText('₹').nth(1)
        3) <span>₹5,000</span> aka getByText('₹').nth(2)
    Call log:
      - Expect "toBeVisible" with timeout 5000ms
      - waiting for getByText('₹5,000')
      129 |     await page.goto('/checkout')
      130 |     await expect(page.getByText('Test Silk Saree')).toBeVisible()
    > 131 |     await expect(page.getByText('₹5,000')).toBeVisible()
          |                                            ^
      132 |   })
      133 |
      134 |   test('change link on step 2 goes back to step 1', async ({ page }) => {
        at /home/runner/work/poshakh/poshakh/frontend/tests/e2e/checkout.spec.ts:131:44
    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/checkout-Checkout-order-summary-shows-cart-item-chromium-retry1/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/checkout-Checkout-order-summary-shows-cart-item-chromium-retry1/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/checkout-Checkout-order-summary-shows-cart-item-chromium-retry1/error-context.md
    attachment #4: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/checkout-Checkout-order-summary-shows-cart-item-chromium-retry1/trace.zip
    Usage:
        npx playwright show-trace test-results/checkout-Checkout-order-summary-shows-cart-item-chromium-retry1/trace.zip
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Retry #2 ───────────────────────────────────────────────────────────────────────────────────────
    Error: expect(locator).toBeVisible() failed
    Locator: getByText('₹5,000')
    Expected: visible
    Error: strict mode violation: getByText('₹5,000') resolved to 3 elements:
        1) <p>₹5,000</p> aka getByRole('paragraph').filter({ hasText: '₹' })
        2) <span>₹5,000</span> aka getByText('₹').nth(1)
        3) <span>₹5,000</span> aka getByText('₹').nth(2)
    Call log:
      - Expect "toBeVisible" with timeout 5000ms
      - waiting for getByText('₹5,000')
      129 |     await page.goto('/checkout')
      130 |     await expect(page.getByText('Test Silk Saree')).toBeVisible()
    > 131 |     await expect(page.getByText('₹5,000')).toBeVisible()
          |                                            ^
      132 |   })
      133 |
      134 |   test('change link on step 2 goes back to step 1', async ({ page }) => {
        at /home/runner/work/poshakh/poshakh/frontend/tests/e2e/checkout.spec.ts:131:44
    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/checkout-Checkout-order-summary-shows-cart-item-chromium-retry2/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/checkout-Checkout-order-summary-shows-cart-item-chromium-retry2/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/checkout-Checkout-order-summary-shows-cart-item-chromium-retry2/error-context.md
  11) [chromium] › tests/e2e/checkout.spec.ts:134:7 › Checkout › change link on step 2 goes back to step 1 
    TimeoutError: locator.fill: Timeout 15000ms exceeded.
    Call log:
      - waiting for getByLabel('First name')
      138 |
      139 |     await page.getByPlaceholder('Email address').fill(TEST_ADDRESS.email)
    > 140 |     await page.getByLabel('First name').fill(TEST_ADDRESS.firstName)
          |                                         ^
      141 |     await page.getByLabel('Last name').fill(TEST_ADDRESS.lastName)
      142 |     await page.getByLabel('Address').fill(TEST_ADDRESS.address)
      143 |     await page.getByLabel('City').fill(TEST_ADDRESS.city)
        at /home/runner/work/poshakh/poshakh/frontend/tests/e2e/checkout.spec.ts:140:41
    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/checkout-Checkout-change-link-on-step-2-goes-back-to-step-1-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/checkout-Checkout-change-link-on-step-2-goes-back-to-step-1-chromium/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/checkout-Checkout-change-link-on-step-2-goes-back-to-step-1-chromium/error-context.md
    Retry #1 ───────────────────────────────────────────────────────────────────────────────────────
    TimeoutError: locator.fill: Timeout 15000ms exceeded.
    Call log:
      - waiting for getByLabel('First name')
      138 |
      139 |     await page.getByPlaceholder('Email address').fill(TEST_ADDRESS.email)
    > 140 |     await page.getByLabel('First name').fill(TEST_ADDRESS.firstName)
          |                                         ^
      141 |     await page.getByLabel('Last name').fill(TEST_ADDRESS.lastName)
      142 |     await page.getByLabel('Address').fill(TEST_ADDRESS.address)
      143 |     await page.getByLabel('City').fill(TEST_ADDRESS.city)
        at /home/runner/work/poshakh/poshakh/frontend/tests/e2e/checkout.spec.ts:140:41
    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/checkout-Checkout-change-link-on-step-2-goes-back-to-step-1-chromium-retry1/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/checkout-Checkout-change-link-on-step-2-goes-back-to-step-1-chromium-retry1/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/checkout-Checkout-change-link-on-step-2-goes-back-to-step-1-chromium-retry1/error-context.md
    attachment #4: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/checkout-Checkout-change-link-on-step-2-goes-back-to-step-1-chromium-retry1/trace.zip
    Usage:
        npx playwright show-trace test-results/checkout-Checkout-change-link-on-step-2-goes-back-to-step-1-chromium-retry1/trace.zip
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Retry #2 ───────────────────────────────────────────────────────────────────────────────────────
    TimeoutError: locator.fill: Timeout 15000ms exceeded.
    Call log:
      - waiting for getByLabel('First name')
      138 |
      139 |     await page.getByPlaceholder('Email address').fill(TEST_ADDRESS.email)
    > 140 |     await page.getByLabel('First name').fill(TEST_ADDRESS.firstName)
          |                                         ^
      141 |     await page.getByLabel('Last name').fill(TEST_ADDRESS.lastName)
      142 |     await page.getByLabel('Address').fill(TEST_ADDRESS.address)
      143 |     await page.getByLabel('City').fill(TEST_ADDRESS.city)
        at /home/runner/work/poshakh/poshakh/frontend/tests/e2e/checkout.spec.ts:140:41
    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/checkout-Checkout-change-link-on-step-2-goes-back-to-step-1-chromium-retry2/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/checkout-Checkout-change-link-on-step-2-goes-back-to-step-1-chromium-retry2/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/checkout-Checkout-change-link-on-step-2-goes-back-to-step-1-chromium-retry2/error-context.md
  12) [chromium] › tests/e2e/product-detail.spec.ts:10:7 › Product Detail › product detail page renders title and price 
    Error: expect(locator).toContainText(expected) failed
    Locator: getByRole('heading', { level: 1 })
    Expected substring: "Test Silk Saree"
    Received string:    "404"
    Timeout: 5000ms
    Call log:
      - Expect "toContainText" with timeout 5000ms
      - waiting for getByRole('heading', { level: 1 })
        7 × locator resolved to <h1 class="next-error-h1">404</h1>
          - unexpected value "404"
      10 |   test('product detail page renders title and price', async ({ page }) => {
      11 |     await page.goto(`/products/${MOCK_PRODUCT.slug}`)
    > 12 |     await expect(page.getByRole('heading', { level: 1 })).toContainText(MOCK_PRODUCT.name)
         |                                                           ^
      13 |     await expect(page.getByText(MOCK_PRODUCT.formattedPrice)).toBeVisible()
      14 |   })
      15 |
        at /home/runner/work/poshakh/poshakh/frontend/tests/e2e/product-detail.spec.ts:12:59
    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/product-detail-Product-Det-781cb-age-renders-title-and-price-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/product-detail-Product-Det-781cb-age-renders-title-and-price-chromium/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/product-detail-Product-Det-781cb-age-renders-title-and-price-chromium/error-context.md
    Retry #1 ───────────────────────────────────────────────────────────────────────────────────────
    Error: expect(locator).toContainText(expected) failed
    Locator: getByRole('heading', { level: 1 })
    Expected substring: "Test Silk Saree"
    Received string:    "404"
    Timeout: 5000ms
    Call log:
      - Expect "toContainText" with timeout 5000ms
      - waiting for getByRole('heading', { level: 1 })
        7 × locator resolved to <h1 class="next-error-h1">404</h1>
          - unexpected value "404"
      10 |   test('product detail page renders title and price', async ({ page }) => {
      11 |     await page.goto(`/products/${MOCK_PRODUCT.slug}`)
    > 12 |     await expect(page.getByRole('heading', { level: 1 })).toContainText(MOCK_PRODUCT.name)
         |                                                           ^
      13 |     await expect(page.getByText(MOCK_PRODUCT.formattedPrice)).toBeVisible()
      14 |   })
      15 |
        at /home/runner/work/poshakh/poshakh/frontend/tests/e2e/product-detail.spec.ts:12:59
    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/product-detail-Product-Det-781cb-age-renders-title-and-price-chromium-retry1/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/product-detail-Product-Det-781cb-age-renders-title-and-price-chromium-retry1/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/product-detail-Product-Det-781cb-age-renders-title-and-price-chromium-retry1/error-context.md
    attachment #4: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/product-detail-Product-Det-781cb-age-renders-title-and-price-chromium-retry1/trace.zip
    Usage:
        npx playwright show-trace test-results/product-detail-Product-Det-781cb-age-renders-title-and-price-chromium-retry1/trace.zip
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Retry #2 ───────────────────────────────────────────────────────────────────────────────────────
    Error: expect(locator).toContainText(expected) failed
    Locator: getByRole('heading', { level: 1 })
    Expected substring: "Test Silk Saree"
    Received string:    "404"
    Timeout: 5000ms
    Call log:
      - Expect "toContainText" with timeout 5000ms
      - waiting for getByRole('heading', { level: 1 })
        7 × locator resolved to <h1 class="next-error-h1">404</h1>
          - unexpected value "404"
      10 |   test('product detail page renders title and price', async ({ page }) => {
      11 |     await page.goto(`/products/${MOCK_PRODUCT.slug}`)
    > 12 |     await expect(page.getByRole('heading', { level: 1 })).toContainText(MOCK_PRODUCT.name)
         |                                                           ^
      13 |     await expect(page.getByText(MOCK_PRODUCT.formattedPrice)).toBeVisible()
      14 |   })
      15 |
        at /home/runner/work/poshakh/poshakh/frontend/tests/e2e/product-detail.spec.ts:12:59
    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/product-detail-Product-Det-781cb-age-renders-title-and-price-chromium-retry2/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/product-detail-Product-Det-781cb-age-renders-title-and-price-chromium-retry2/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/product-detail-Product-Det-781cb-age-renders-title-and-price-chromium-retry2/error-context.md
  13) [chromium] › tests/e2e/product-detail.spec.ts:22:7 › Product Detail › Product JSON-LD schema is in page 
    Error: expect(received).toBeTruthy()
    Received: undefined
      25 |     const schemaTexts = await Promise.all(schemas.map(s => s.innerText()))
      26 |     const productSchema = schemaTexts.find(t => t.includes('"Product"'))
    > 27 |     expect(productSchema).toBeTruthy()
         |                           ^
      28 |     const parsed = JSON.parse(productSchema!)
      29 |     expect(parsed['@type']).toBe('Product')
      30 |     expect(parsed.offers.url).toContain(MOCK_PRODUCT.slug)
        at /home/runner/work/poshakh/poshakh/frontend/tests/e2e/product-detail.spec.ts:27:27
    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/product-detail-Product-Det-18333-t-JSON-LD-schema-is-in-page-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/product-detail-Product-Det-18333-t-JSON-LD-schema-is-in-page-chromium/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/product-detail-Product-Det-18333-t-JSON-LD-schema-is-in-page-chromium/error-context.md
    Retry #1 ───────────────────────────────────────────────────────────────────────────────────────
    Error: expect(received).toBeTruthy()
    Received: undefined
      25 |     const schemaTexts = await Promise.all(schemas.map(s => s.innerText()))
      26 |     const productSchema = schemaTexts.find(t => t.includes('"Product"'))
    > 27 |     expect(productSchema).toBeTruthy()
         |                           ^
      28 |     const parsed = JSON.parse(productSchema!)
      29 |     expect(parsed['@type']).toBe('Product')
      30 |     expect(parsed.offers.url).toContain(MOCK_PRODUCT.slug)
        at /home/runner/work/poshakh/poshakh/frontend/tests/e2e/product-detail.spec.ts:27:27
    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/product-detail-Product-Det-18333-t-JSON-LD-schema-is-in-page-chromium-retry1/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────
    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/product-detail-Product-Det-18333-t-JSON-LD-schema-is-in-page-chromium-retry1/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Error Context: test-results/product-detail-Product-Det-18333-t-JSON-LD-schema-is-in-page-chromium-retry1/error-context.md
    attachment #4: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/product-detail-Product-Det-18333-t-JSON-LD-schema-is-in-page-chromium-retry1/trace.zip
    Usage:
        npx playwright show-trace test-results/product-detail-Product-Det-18333-t-JSON-LD-schema-is-in-page-chromium-retry1/trace.zip
    ────────────────────────────────────────────────────────────────────────────────────────────────
    Retry #2 ───────────────────────────────────────────────────────────────────────────────────────
    Error: expect(received).toBeTruthy()
    Received: undefined
      25 |     const schemaTexts = await Promise.all(schemas.map(s => s.innerText()))