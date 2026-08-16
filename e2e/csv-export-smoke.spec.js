import { test, expect } from '@playwright/test';

// Regression test for a real bug: every "Export CSV" button in the app
// (Loan Directory, Cash Handovers, Payment History) called a downloadCsv()
// helper that was never defined anywhere in the codebase. Clicking any of
// them threw a ReferenceError inside the click handler — which a browser
// swallows silently, so the button just did nothing and nothing in
// `npm run build` or the existing test suite caught it. This test clicks
// the actual button and asserts a real file download happens, the way a
// user would notice the bug (or its absence).
test.describe('CSV export buttons actually download a file', () => {
  const today = new Date().toISOString().slice(0, 10);
  const loan = {
    id: 'loan-1', borrower_name: 'Export Test Borrower', borrower_phone: '0771111111',
    status: 'active', interest_type: 'daily', interest_rate: 2, principal_amount: 50000, principal_outstanding: 50000,
    interest_balance: 0, agent_name: 'Test Agent', assigned_agent_id: 'agent-1', created_at: today,
    last_payment_date: null, total_collected: 0, paid_today: false, is_flat_installment: false,
    reference_number: 'TST-100', nic_number: '199012345678',
  };

  async function mockCommonRoutes(page) {
    await page.route('**/api/auth/login', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        token: 'fake-test-token',
        user: { id: 'admin-1', name: 'Test Admin', role: 'admin', phone: '0771234567', mustChangePassword: false, finance_access: true, ticket_access: false },
      }),
    }));
    await page.route('**/api/dashboard/admin', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        summary: { totalMoneyLent: 0, totalActiveLoans: 1, totalRepayments: 0, totalOverdue: 0, totalOverdueAmount: 0, totalPrincipalOutstanding: 0, totalInterestDue: 0, totalOutstanding: 0, agentCashInHand: 0, expectedTodayTarget: 0, pendingApprovalsCount: 0 },
        dailyReport: { collectionsToday: 0, interestToday: 0, expectedTodayTarget: 0, date: new Date().toDateString() },
        agentPerformance: [{ agent_name: 'Test Agent', total_collected: 5000, collections_count: 3 }],
        overdueLoans: [], pendingApprovals: [], recentAudit: [], interestByType: [], recentAccruals: [],
      }),
    }));
    await page.route('**/api/users/borrowers', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/users/agents', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'agent-1', name: 'Test Agent', phone: '0777654321' }]),
    }));
    await page.route('**/api/borrower-intakes**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/settings', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ org_name: 'Test Org', logo_url: null, overdue_reminder_threshold_days: 3 }),
    }));
    await page.route('**/api/loans', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([loan]) }));
    await page.route('**/api/payments/history**', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        data: [{
          id: 'tx-1', payment_date: today, borrower_name: 'Export Test Borrower', agent_name: 'Test Agent',
          payment_type: 'interest', amount: 500, payment_method: 'cash', idempotency_key: 'idem-1', notes: '',
        }],
        total: 1, page: 1, limit: 100, totalPages: 1,
      }),
    }));
  }

  async function login(page) {
    await page.goto('/');
    await page.locator('input[type="tel"]').first().fill('0771234567');
    await page.locator('input[type="password"]').first().fill('password123');
    await page.getByRole('button', { name: /login/i }).click();
  }

  test('Loan Directory Export CSV triggers a real download', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await mockCommonRoutes(page);
    await login(page);

    await page.getByRole('button', { name: /check loans/i }).first().click();
    await expect(page.getByText('Loan Directory')).toBeVisible({ timeout: 10000 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /export csv/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^loans-.*\.csv$/);
    expect(pageErrors, `Unhandled page errors: ${pageErrors.join(', ')}`).toEqual([]);
  });

  test('Payment History Export CSV triggers a real download', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await mockCommonRoutes(page);
    await login(page);

    // Payment History only has a mobile More-sheet / desktop top-nav entry
    // point, not its own bottom-nav icon — reach it via the desktop link.
    await page.getByRole('button', { name: /^payment history$/i }).click();
    await expect(page.getByText('Payment History Log')).toBeVisible({ timeout: 10000 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /export csv/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^payment-history-.*\.csv$/);
    expect(pageErrors, `Unhandled page errors: ${pageErrors.join(', ')}`).toEqual([]);
  });

  test('Agent Route Progress Export CSV triggers a real download', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await mockCommonRoutes(page);
    await login(page);

    await page.getByRole('button', { name: /^agent route$/i }).click();
    await expect(page.getByText('Agent Collections Today')).toBeVisible({ timeout: 10000 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /export csv/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^agent-performance-.*\.csv$/);
    expect(pageErrors, `Unhandled page errors: ${pageErrors.join(', ')}`).toEqual([]);
  });
});
