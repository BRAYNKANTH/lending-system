import { test, expect } from '@playwright/test';

// Covers the "Extend Loan Term" restructuring action end to end (mocked
// API, same approach as delete-loan.spec.js) — walks through all three
// native dialogs (periods, reason, confirm) exactly as an admin would,
// and asserts the actual API call carries the right payload.
test.describe('Extend Loan Term', () => {
  const today = new Date().toISOString().slice(0, 10);
  const fixedTermLoan = {
    id: 'loan-1', borrower_name: 'Behind Schedule Borrower', borrower_phone: '0771111111', borrower_email: null, borrower_gender: null,
    status: 'active', interest_type: 'daily', interest_rate: 2, principal_amount: 31000, principal_outstanding: 20000,
    interest_balance: 2000, agent_name: 'Test Agent', assigned_agent_id: 'agent-1', created_at: today,
    last_payment_date: null, total_collected: 11000, paid_today: false, is_flat_installment: true,
    daily_installment_amount: 1100, principal_per_day: 1000, interest_per_day: 100,
    collection_mode: 'fixed_term', duration_periods: 31, maturity_date: today,
    reference_number: 'TST-200', nic_number: '199012345678',
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
        agentPerformance: [], overdueLoans: [], pendingApprovals: [], recentAudit: [], interestByType: [], recentAccruals: [],
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
    await page.route('**/api/loans', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([fixedTermLoan]) }));
    await page.route('**/api/loans/loan-1', (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ loan: fixedTermLoan, payments: [], accruals: [], ledger: [], guarantors: [], guarantor: null, dailyCollections: [] }),
      });
    });
  }

  test('walking through the extend-term dialogs sends the right payload to the API', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await mockCommonRoutes(page);

    let extendRequestBody = null;
    await page.route('**/api/loans/loan-1/extend-term', (route) => {
      extendRequestBody = route.request().postDataJSON();
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ message: 'Loan term extended.', loan: { ...fixedTermLoan, duration_periods: 62 } }),
      });
    });

    // Answers each native dialog in the order the handler fires them:
    // 1) "how many periods" prompt, 2) "reason" prompt, 3) confirm.
    let dialogStep = 0;
    page.on('dialog', async (dialog) => {
      dialogStep += 1;
      if (dialogStep === 1) await dialog.accept('31');
      else if (dialogStep === 2) await dialog.accept('Borrower requested more time after a family emergency');
      else await dialog.accept();
    });

    await page.goto('/');
    await page.locator('input[type="tel"]').first().fill('0771234567');
    await page.locator('input[type="password"]').first().fill('password123');
    await page.getByRole('button', { name: /login/i }).click();
    await page.getByRole('button', { name: /check loans/i }).first().click();
    await expect(page.getByText('Loan Directory')).toBeVisible({ timeout: 10000 });
    await page.getByText('Behind Schedule Borrower').first().click();
    await page.getByRole('button', { name: /manage loan/i }).click();

    await page.getByRole('button', { name: /^extend term$/i }).click();

    await expect.poll(() => extendRequestBody).not.toBeNull();
    expect(extendRequestBody).toEqual({
      additionalPeriods: 31,
      reason: 'Borrower requested more time after a family emergency',
    });
    expect(pageErrors, `Unhandled page errors: ${pageErrors.join(', ')}`).toEqual([]);
  });
});
