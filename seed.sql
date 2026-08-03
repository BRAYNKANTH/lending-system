-- Clear existing data (optional, table truncation handled by cascade in schema.sql)

-- Insert Users (Password: password123, hashed using standard bcrypt $2b$10$...)
-- Hashes: '$2b$10$EixZaYVK1YiYi2x9JeIEZ.6u99Xg5.U6S9g/V39L4qYgB0B5fK4z6'
INSERT INTO users (id, name, email, phone, password_hash, role, is_active) VALUES
('a1111111-1111-1111-1111-111111111111', 'Lender Admin', 'admin@lend.com', '+94771234567', '$2b$10$EixZaYVK1YiYi2x9JeIEZ.6u99Xg5.U6S9g/V39L4qYgB0B5fK4z6', 'admin', true),
('a2222222-2222-2222-2222-222222222222', 'Agent Amal', 'agent@lend.com', '+94777654321', '$2b$10$EixZaYVK1YiYi2x9JeIEZ.6u99Xg5.U6S9g/V39L4qYgB0B5fK4z6', 'agent', true),
('a3333333-3333-3333-3333-333333333333', 'Borrower Bandara', 'borrower@lend.com', '+94778888888', '$2b$10$EixZaYVK1YiYi2x9JeIEZ.6u99Xg5.U6S9g/V39L4qYgB0B5fK4z6', 'borrower', true),
('a4444444-4444-4444-4444-444444444444', 'Borrower Chandana', 'borrower2@lend.com', '+94779999999', '$2b$10$EixZaYVK1YiYi2x9JeIEZ.6u99Xg5.U6S9g/V39L4qYgB0B5fK4z6', 'borrower', true);

-- Insert Sample Active Loans
-- 1. Daily Interest Loan for Borrower Bandara
INSERT INTO loans (id, borrower_id, lender_id, assigned_agent_id, principal_amount, interest_rate, interest_type, current_balance, status, last_accrual_date, next_accrual_date) VALUES
('b1111111-1111-1111-1111-111111111111', 'a3333333-3333-3333-3333-333333333333', 'a1111111-1111-1111-1111-111111111111', 'a2222222-2222-2222-2222-222222222222', 100000.00, 2.00, 'daily', 102000.00, 'active', NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 day');

-- Setup Initial Ledger Entry for Loan 1 Principal (Debit Receivable, Credit Cash/Capital)
INSERT INTO ledger_entries (loan_id, account, type, amount, created_at) VALUES
('b1111111-1111-1111-1111-111111111111', 'loan_receivable', 'debit', 100000.00, NOW() - INTERVAL '3 days');

-- Setup Initial Interest Accrual for Loan 1
INSERT INTO interest_accruals (loan_id, amount_accrued, calculation_log, created_at) VALUES
('b1111111-1111-1111-1111-111111111111', 2000.00, 'Principal: 100000.00 | Rate: 2% | Type: daily', NOW() - INTERVAL '1 day');

INSERT INTO ledger_entries (loan_id, account, type, amount, created_at) VALUES
('b1111111-1111-1111-1111-111111111111', 'loan_receivable', 'debit', 2000.00, NOW() - INTERVAL '1 day'),
('b1111111-1111-1111-1111-111111111111', 'interest_revenue', 'credit', 2000.00, NOW() - INTERVAL '1 day');


-- 2. Weekly Interest Loan for Borrower Chandana (Accrues 5% weekly)
INSERT INTO loans (id, borrower_id, lender_id, assigned_agent_id, principal_amount, interest_rate, interest_type, current_balance, status, last_accrual_date, next_accrual_date) VALUES
('b2222222-2222-2222-2222-222222222222', 'a4444444-4444-4444-4444-444444444444', 'a1111111-1111-1111-1111-111111111111', 'a2222222-2222-2222-2222-222222222222', 250000.00, 5.00, 'weekly', 262500.00, 'active', NOW() - INTERVAL '7 days', NOW() + INTERVAL '7 days');

-- Ledger entries for Loan 2 Principal
INSERT INTO ledger_entries (loan_id, account, type, amount, created_at) VALUES
('b2222222-2222-2222-2222-222222222222', 'loan_receivable', 'debit', 250000.00, NOW() - INTERVAL '10 days');

-- Ledger entries for Loan 2 Interest Accrual
INSERT INTO interest_accruals (loan_id, amount_accrued, calculation_log, created_at) VALUES
('b2222222-2222-2222-2222-222222222222', 12500.00, 'Principal: 250000.00 | Rate: 5% | Type: weekly', NOW() - INTERVAL '7 days');

INSERT INTO ledger_entries (loan_id, account, type, amount, created_at) VALUES
('b2222222-2222-2222-2222-222222222222', 'loan_receivable', 'debit', 12500.00, NOW() - INTERVAL '7 days'),
('b2222222-2222-2222-2222-222222222222', 'interest_revenue', 'credit', 12500.00, NOW() - INTERVAL '7 days');


-- Insert Sample Transaction (Collection)
-- Agent Amal collects 15000.00 from Borrower Bandara
INSERT INTO transactions (id, loan_id, agent_id, borrower_id, amount, payment_date, notes, idempotency_key) VALUES
('c1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'a2222222-2222-2222-2222-222222222222', 'a3333333-3333-3333-3333-333333333333', 15000.00, NOW() - INTERVAL '12 hours', 'Partial repayment in cash', 'idemp_sample_123');

-- Update the Loan 1 current balance to reflect the payment (102000.00 - 15000.00 = 87000.00)
UPDATE loans SET current_balance = 87000.00 WHERE id = 'b1111111-1111-1111-1111-111111111111';

-- Ledger entries for transaction 1 (Debit cash_agent, Credit loan_receivable)
INSERT INTO ledger_entries (loan_id, transaction_id, account, type, amount, created_at) VALUES
('b1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'cash_agent', 'debit', 15000.00, NOW() - INTERVAL '12 hours'),
('b1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'loan_receivable', 'credit', 15000.00, NOW() - INTERVAL '12 hours');

-- Add standard audit logs
INSERT INTO audit_logs (actor_id, action_type, description, created_at) VALUES
('a1111111-1111-1111-1111-111111111111', 'CREATE_LOAN', 'Lender Admin created a Daily loan of 100,000 LKR for Borrower Bandara.', NOW() - INTERVAL '3 days'),
('a1111111-1111-1111-1111-111111111111', 'CREATE_LOAN', 'Lender Admin created a Weekly loan of 250,000 LKR for Borrower Chandana.', NOW() - INTERVAL '10 days'),
('a2222222-2222-2222-2222-222222222222', 'RECORD_PAYMENT', 'Agent Amal collected 15,000 LKR for Borrower Bandara.', NOW() - INTERVAL '12 hours');
