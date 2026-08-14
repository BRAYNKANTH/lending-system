import { test, expect } from '@playwright/test';

test.describe('E2E Audit: Page Transitions, Buttons, and Errors', () => {
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture unhandled page errors/exceptions
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });
  });

  test.afterEach(() => {
    // Assert no console errors or page errors occurred during the test execution
    expect(pageErrors, `Unhandled page errors detected: ${pageErrors.join(', ')}`).toEqual([]);
    expect(consoleErrors, `Console errors detected: ${consoleErrors.join(', ')}`).toEqual([]);
  });

  test('Lender Admin: full navigation audit across all views', async ({ page }) => {
    // 1. Log in as Lender Admin
    await page.goto('/');

    const phoneInput = page.locator('input[type="tel"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const loginButton = page.getByRole('button', { name: /login/i });

    // Use admin user phone and password
    await phoneInput.fill('0774048194');
    await passwordInput.fill('password123');
    await loginButton.click();

    // 2. Wait for the Portal view or Dashboard to load
    // The admin lands on the Portal screen if they have both finance_access and ticket_access
    await expect(page.locator('body')).toContainText(/STN MICRO CREDIT/i, { timeout: 15000 });

    // If it lands on the portal choice, we can choose the Lend App / Financial Portal or Tickets Dashboard
    const finPortalButton = page.getByRole('button', { name: /financial portal/i });
    if (await finPortalButton.isVisible()) {
      await finPortalButton.click();
    }

    // Now we should be on the Admin Dashboard
    await expect(page.locator('body')).toContainText(/Lender Admin/i, { timeout: 15000 });

    // Define all views/buttons to audit
    const adminViews = [
      { name: 'Give Loan', indicator: 'Select Borrower' },
      { name: 'Borrower Intakes', indicator: 'Borrower Intake Forms' },
      { name: 'Record Payment', indicator: 'Record Payment' },
      { name: 'Check Loans', indicator: 'Loans List' },
      { name: 'Agent Route', indicator: 'Agent Status & Route' },
      { name: 'Users & Cash Tools', indicator: 'System Users' },
      { name: 'Interest Center', indicator: 'Interest Accruals' },
      { name: 'Payment History', indicator: 'Payment History' },
      { name: 'Audit Log', indicator: 'Audit Log' },
      { name: 'Home', indicator: 'Lender Admin' } // Go back Home/Dashboard
    ];

    for (const view of adminViews) {
      console.log(`Auditing transition to view: ${view.name}`);
      
      // Locate the sidebar navigation button for the view
      const button = page.locator('.nav-link-btn').filter({ hasText: view.name }).first();
      await expect(button).toBeVisible();
      await button.click();
      
      // Wait for the indicator text to be visible on the page
      await expect(page.locator('body')).toContainText(view.indicator, { timeout: 10000 });
      
      // Short delay to ensure client-side rendering settles
      await page.waitForTimeout(500);
    }
  });

  test('Agent: full navigation audit across all views', async ({ page }) => {
    // 1. Log in as Agent
    await page.goto('/');

    const phoneInput = page.locator('input[type="tel"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const loginButton = page.getByRole('button', { name: /login/i });

    // Use agent user phone and password
    await phoneInput.fill('0765822758');
    await passwordInput.fill('password123');
    await loginButton.click();

    // 2. Wait for Agent Dashboard to load
    await expect(page.locator('body')).toContainText(/Kanisra/i, { timeout: 15000 });

    // Define agent sub-views/buttons to audit
    const agentViews = [
      { name: 'Next Day Tasklist', indicator: 'Next-Day Tasklist' },
      { name: 'Record Payment', indicator: 'Record Payment' },
      { name: 'Collection History', indicator: 'Collection History' },
      { name: 'Remit Cash', indicator: 'Remit Cash' },
      { name: 'Collect Payments', indicator: 'Today\'s Collection List' } // Go back to Collect
    ];

    for (const view of agentViews) {
      console.log(`Auditing transition to view: ${view.name}`);
      
      // Locate the sub-nav button
      const button = page.locator('.nav-link-btn').filter({ hasText: view.name }).first();
      await expect(button).toBeVisible();
      await button.click();
      
      // Wait for the indicator text to be visible on the page
      await expect(page.locator('body')).toContainText(view.indicator, { timeout: 10000 });
      
      // Short delay to ensure client-side rendering settles
      await page.waitForTimeout(500);
    }
  });
});
