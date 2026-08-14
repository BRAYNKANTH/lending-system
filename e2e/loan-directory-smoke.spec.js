import { test, expect } from '@playwright/test';

// Regression test for a real production incident: LoansLoader (the Loan
// Directory / "Check Loans" screen) threw a ReferenceError on every single
// render — "Cannot access 'isNeedsFollowUp' before initialization" — because
// a `const` helper was referenced (via followUpCount/the urgency sort)
// several dozen lines before its own declaration. `npm run build` and every
// unit test passed regardless, since this is a temporal-dead-zone bug that
// only fires when the component actually renders in a browser — it doesn't
// need real login credentials to reproduce, just mocked API responses, so
// there's no excuse for this class of bug reaching production undetected
// again.
test.describe('Loan Directory renders without crashing', () => {
  test('admin can open Check Loans and see the directory, not a crash screen', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.route('**/api/auth/login', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: 'fake-test-token',
        user: { id: 'admin-1', name: 'Test Admin', role: 'admin', phone: '0771234567', mustChangePassword: false, finance_access: true, ticket_access: false },
      }),
    }));

    await page.route('**/api/dashboard/admin', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        summary: { totalMoneyLent: 0, totalActiveLoans: 0, totalRepayments: 0, totalOverdue: 0, totalOverdueAmount: 0, totalPrincipalOutstanding: 0, totalInterestDue: 0, totalOutstanding: 0, agentCashInHand: 0, expectedTodayTarget: 0, pendingApprovalsCount: 0 },
        dailyReport: { collectionsToday: 0, interestToday: 0, expectedTodayTarget: 0, date: new Date().toDateString() },
        agentPerformance: [],
        overdueLoans: [],
        pendingApprovals: [],
        recentAudit: [],
        interestByType: [],
        recentAccruals: [],
      }),
    }));

    await page.route('**/api/users/borrowers', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/users/agents', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ id: 'agent-1', name: 'Test Agent', phone: '0777654321' }]),
    }));
    await page.route('**/api/borrower-intakes**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/settings', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ org_name: 'Test Org', logo_url: null, overdue_reminder_threshold_days: 3 }),
    }));

    // Deliberately mixes loan states so urgencyGroupOf/lastPaidInfo/
    // Last5DaysStreak all get exercised: pending, an active daily loan
    // with a last5Days streak and a recent payment, and a fully_paid loan.
    const today = new Date().toISOString().slice(0, 10);
    await page.route('**/api/loans', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'loan-1', borrower_name: 'Pending Borrower', borrower_phone: '0771111111', status: 'pending',
          interest_type: 'daily', interest_rate: 2, principal_amount: 50000, principal_outstanding: 50000,
          interest_balance: 0, agent_name: 'Test Agent', assigned_agent_id: 'agent-1', created_at: today,
          last_payment_date: null, total_collected: 0, paid_today: false, is_flat_installment: false,
        },
        {
          id: 'loan-2', borrower_name: 'Active Borrower', borrower_phone: '0772222222', status: 'active',
          interest_type: 'daily', interest_rate: 2, principal_amount: 100000, principal_outstanding: 100000,
          interest_balance: 500, agent_name: 'Test Agent', assigned_agent_id: 'agent-1', created_at: today,
          last_payment_date: today, total_collected: 2000, paid_today: true, is_flat_installment: false,
          reference_number: 'TST-001', nic_number: '199012345678',
          last5Days: [0, 1, 2, 3, 4].map((i) => ({ date: today, status: i < 4 ? 'paid' : 'before_loan' })),
        },
        {
          id: 'loan-3', borrower_name: 'Paid Off Borrower', borrower_phone: '0773333333', status: 'fully_paid',
          interest_type: 'weekly', interest_rate: 2, principal_amount: 20000, principal_outstanding: 0,
          interest_balance: 0, agent_name: null, assigned_agent_id: null, created_at: today,
          last_payment_date: today, total_collected: 20000, paid_today: false, is_flat_installment: false,
        },
      ]),
    }));

    await page.goto('/');
    await page.locator('input[type="tel"]').first().fill('0771234567');
    await page.locator('input[type="password"]').first().fill('password123');
    await page.getByRole('button', { name: /login/i }).click();

    // Navigate into the Loan Directory — the screen that crashed.
    await page.getByRole('button', { name: /check loans/i }).first().click();

    // The real failure mode: a Next.js error boundary replacing the whole
    // page with "Application error: a client-side exception has occurred".
    await expect(page.getByText(/application error/i)).toHaveCount(0);
    await expect(page.getByText('Loan Directory')).toBeVisible({ timeout: 10000 });

    // All three mocked loans should have rendered — confirms the urgency
    // grouping/sort and streak rendering actually ran, not just that the
    // page didn't crash before reaching them. Both the desktop table and
    // mobile card DOM trees render at once (CSS hides whichever doesn't
    // match the viewport), so each name legitimately matches twice.
    await expect(page.getByText('Pending Borrower').first()).toBeVisible();
    await expect(page.getByText('Active Borrower').first()).toBeVisible();
    await expect(page.getByText('Paid Off Borrower').first()).toBeVisible();

    expect(pageErrors, `Unhandled page errors: ${pageErrors.join(', ')}`).toEqual([]);
  });
});
