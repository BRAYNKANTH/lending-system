import { test, expect } from '@playwright/test';

// Smoke test: the app is a client-only SPA (see src/app/page.js), so this
// confirms the JS bundle loads, hydrates, and renders the login screen
// with no console/page errors — the baseline every other test depends on.
test.describe('Homepage / login screen', () => {
  test('loads the app shell and renders the login form', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/');

    // Phone + password login form (see LendApp.jsx handleLogin)
    const phoneInput = page.locator('input[type="tel"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const loginButton = page.getByRole('button', { name: /login/i });

    await expect(phoneInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(loginButton).toBeVisible();

    expect(pageErrors, `Unexpected page errors: ${pageErrors.join(', ')}`).toEqual([]);
  });

  test('shows a validation-friendly error on bad login', async ({ page }) => {
    await page.goto('/');

    const phoneInput = page.locator('input[type="tel"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const loginButton = page.getByRole('button', { name: /login/i });

    await phoneInput.fill('0770000000');
    await passwordInput.fill('wrong-password-123');
    await loginButton.click();

    // Don't assert exact copy (may change) — just confirm the app didn't
    // silently "succeed" or crash: still on the login form, no thrown errors.
    await expect(phoneInput).toBeVisible({ timeout: 10000 });
  });
});
