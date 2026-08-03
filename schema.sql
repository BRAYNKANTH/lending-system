-- Drop existing tables if they exist (for easy re-runs)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS ledger_entries CASCADE;
DROP TABLE IF EXISTS interest_accruals CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS loans CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS interest_type CASCADE;
DROP TYPE IF EXISTS loan_status CASCADE;
DROP TYPE IF EXISTS entry_type CASCADE;
DROP TYPE IF EXISTS account_type CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Define Enums
CREATE TYPE user_role AS ENUM ('admin', 'agent', 'borrower');
CREATE TYPE interest_type AS ENUM ('daily', 'weekly', 'monthly');
CREATE TYPE loan_status AS ENUM ('pending', 'active', 'fully_paid', 'defaulted');
CREATE TYPE entry_type AS ENUM ('debit', 'credit');
CREATE TYPE account_type AS ENUM ('cash_agent', 'loan_receivable', 'interest_revenue');

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Loans table
CREATE TABLE loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    borrower_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    lender_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assigned_agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
    principal_amount NUMERIC(15, 2) NOT NULL CHECK (principal_amount > 0),
    interest_rate NUMERIC(5, 2) NOT NULL CHECK (interest_rate >= 0),
    interest_type interest_type NOT NULL,
    current_balance NUMERIC(15, 2) NOT NULL CHECK (current_balance >= 0),
    status loan_status NOT NULL DEFAULT 'active',
    last_accrual_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    next_accrual_date TIMESTAMP WITH TIME ZONE NOT NULL,
    nic_number VARCHAR(50),
    nic_photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Transactions (Payments)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE RESTRICT,
    agent_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    borrower_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    payment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    proof_image_url TEXT,
    payment_method VARCHAR(50) DEFAULT 'cash',
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Interest Accruals Log
CREATE TABLE interest_accruals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE RESTRICT,
    amount_accrued NUMERIC(15, 2) NOT NULL CHECK (amount_accrued >= 0),
    calculation_log TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ledger Entries (Double-Entry Ledger)
CREATE TABLE ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID REFERENCES loans(id) ON DELETE SET NULL,
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    account account_type NOT NULL,
    type entry_type NOT NULL,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action_type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
