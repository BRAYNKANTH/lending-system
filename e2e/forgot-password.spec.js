import { test, expect } from '@playwright/test';

// Covers navigation through the OTP-based forgot-password flow (see
// src/components/LendApp.jsx handleSendOtp / handleResetPasswordWithOtp).
//
// Deliberately does NOT click "Send Verification Code": TEXTLK_API_TOKEN is
// configured in this environment, so that button sends a real SMS via
// Text.lk to whatever phone number is entered. Automating that would fire
// a real, billed SMS on every test run — this test stays UI-navigation-only
// until there's a dedicated test phone number/account to target safely.
test.describe('Forgot password (navigation only, no OTP sent)', () => {
  test('opens the forgot-password screen and returns to login', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /forgot password/i }).click();

    const forgotPhoneInput = page.locator('input[type="tel"]').first();
    const sendCodeButton = page.getByRole('button', { name: /send verification code/i });
    await expect(forgotPhoneInput).toBeVisible();
    await expect(sendCodeButton).toBeVisible();

    await page.getByRole('button', { name: /back to login/i }).click();

    await expect(page.getByRole('button', { name: /^login$/i })).toBeVisible();
  });
});
