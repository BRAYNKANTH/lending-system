import { test, expect } from '@playwright/test';

// Covers the Delete Loan feature end to end via mocked API responses (no
// real credentials/database needed — same approach as
// loan-directory-smoke.spec.js, after that file caught a real production
// crash that npm run build and every unit test missed).
test.describe('Delete Loan', () => {
  const today = new Date().toISOString().slice(0, 10);
  const loan = {
    id: 'loan-1', borrower_name: 'Mistaken Entry', borrower_phone: '0771111111', borrower_email: null, borrower_gender: null,
    status: 'active', interest_type: 'daily', interest_rate: 2, principal_amount: 50000, principal_outstanding: 50000,
    interest_balance: 0, agent_name: 'Test Agent', assigned_agent_id: 'agent-1', created_at: today,
    last_payment_date: null, total_collected: 0, paid_today: false, is_flat_installment: false,
    reference_number: 'TST-999', nic_number: '199012345678', collection_mode: 'open_ended',
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
    await page.route('**/api/loans', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([loan]) }));
    await page.route('**/api/loans/loan-1', (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ loan, payments: [], accruals: [], ledger: [], guarantors: [], guarantor: null, dailyCollections: [] }),
      });
    });
  }

  async function loginAndOpenLoan(page) {
    await page.goto('/');
    await page.locator('input[type="tel"]').first().fill('0771234567');
    await page.locator('input[type="password"]').first().fill('password123');
    await page.getByRole('button', { name: /login/i }).click();
    await page.getByRole('button', { name: /check loans/i }).first().click();
    await expect(page.getByText('Loan Directory')).toBeVisible({ timeout: 10000 });
    await page.getByText('Mistaken Entry').first().click();
    await page.getByRole('button', { name: /manage loan/i }).click();
  }

  test('Danger Zone appears for a loan with no activity, and the delete flow succeeds', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await mockCommonRoutes(page);

    let deleteRequestBody = null;
    await page.route('**/api/loans/loan-1', (route) => {
      if (route.request().method() === 'DELETE') {
        deleteRequestBody = route.request().postDataJSON();
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Loan permanently deleted.' }) });
      }
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ loan, payments: [], accruals: [], ledger: [], guarantors: [], guarantor: null, dailyCollections: [] }),
      });
    });

    await loginAndOpenLoan(page);

    await expect(page.getByText('Danger Zone')).toBeVisible();
    await page.getByRole('button', { name: /delete this loan/i }).click();

    await expect(page.getByText(/permanently removes the loan/i)).toBeVisible();
    await page.getByPlaceholder(/created by mistake/i).fill('Test loan, never should have been created');
    await page.locator('input[type="password"]').last().fill('adminpassword123');
    await page.getByRole('button', { name: /delete permanently/i }).click();

    await expect(page.getByText('Loan Directory')).toBeVisible({ timeout: 10000 });
    expect(deleteRequestBody).toEqual({ reason: 'Test loan, never should have been created', password: 'adminpassword123' });
    expect(pageErrors, `Unhandled page errors: ${pageErrors.join(', ')}`).toEqual([]);
  });

  test('Danger Zone is hidden once the loan has a real payment', async ({ page }) => {
    await mockCommonRoutes(page);
    const paidLoan = { ...loan };
    await page.route('**/api/loans/loan-1', (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          loan: paidLoan,
          payments: [{ id: 'tx-1', amount: 100, payment_type: 'interest', payment_date: today, agent_name: 'Test Agent', notes: '' }],
          accruals: [], ledger: [], guarantors: [], guarantor: null, dailyCollections: [],
        }),
      });
    });

    await loginAndOpenLoan(page);

    await expect(page.getByText('Danger Zone')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /delete this loan/i })).toHaveCount(0);
  });

  test('a rejected password keeps the modal open with the error shown', async ({ page }) => {
    await mockCommonRoutes(page);
    await page.route('**/api/loans/loan-1', (route) => {
      if (route.request().method() === 'DELETE') {
        return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Incorrect password.' }) });
      }
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ loan, payments: [], accruals: [], ledger: [], guarantors: [], guarantor: null, dailyCollections: [] }),
      });
    });

    await loginAndOpenLoan(page);
    await page.getByRole('button', { name: /delete this loan/i }).click();
    await page.getByPlaceholder(/created by mistake/i).fill('Test');
    await page.locator('input[type="password"]').last().fill('wrong');
    await page.getByRole('button', { name: /delete permanently/i }).click();

    // Modal stays open (deletion did NOT proceed) and the real server
    // message surfaces — not swallowed by the page-level error banner.
    await expect(page.getByText('Incorrect password.')).toBeVisible();
    await expect(page.getByText(/permanently removes the loan/i)).toBeVisible();
  });
});
