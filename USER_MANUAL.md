# STN MICRO CREDIT — User Manual & Operations Guide

Welcome to the operational manual for the **STN MICRO CREDIT** Lending & Agent Collection Management System. This guide provides comprehensive, step-by-step instructions for both **Administrators** and **Agents** to use all features of the application.

---

## Table of Contents
1. [General Concepts & Navigation](#1-general-concepts--navigation)
2. [Authentication & Account Settings](#2-authentication--account-settings)
3. [Administrator Guide](#3-administrator-guide)
   - [Dashboard Overview](#dashboard-overview)
   - [Issuing a New Loan (Give Loan Wizard)](#issuing-a-new-loan-give-loan-wizard)
   - [Borrower & Loan File Auditing (Check Loans)](#borrower--loan-file-auditing-check-loans)
   - [Staff & Cash Reconciliation (Users & Cash Tools)](#staff--cash-reconciliation-users--cash-tools)
4. [Field Collection Agent Guide](#4-field-collection-agent-guide)
   - [Daily Collection Route](#daily-collection-route)
   - [Recording Collections](#recording-collections)
   - [Cash Handover & Remittances](#cash-handover--remittances)
5. [Operational Best Practices](#5-operational-best-practices)

---

## 1. General Concepts & Navigation

STN MICRO CREDIT operates on a **double-entry ledger accounting model** combined with real-time interest accruals. 
* **Principal and Interest Balances:** Kept completely separate. Payments are applied specifically to either principal or interest outstanding.
* **Sticky Bottom Navigation:** Adaptable menu that shifts according to your logged-in role. On mobile, it acts as a quick-tab router.
* **Responsive Layouts:** The app automatically reformats for mobile viewports, converting desktop lists to compact swipeable cards.

---

## 2. Authentication & Account Settings

* **Secure Login:** Log in using your registered mobile number and password.
* **Forgot Password:** If you forget your password, click the *Forgot Password* link. The administrator will be notified or you can reset it by validating personal details.
* **Changing Password:** Click the settings icon in the top header to change your current password at any time.

---

## 3. Administrator Guide

As an **Administrator**, you have full control over loan creation, staff assignments, interest parameters, audit logs, and double-entry general ledgers.

### Dashboard Overview
Upon logging in, you will see key operational KPIs:
* **Cash-in-Hand:** Total un-remitted cash currently held by all collection agents in the field.
* **Active Loans:** Total number of active customer accounts.
* **Total Principal Outstanding:** Outstanding loan principal balance across the portfolio.
* **Interest Revenue:** Accumulated accrued interest revenue.

---

### Issuing a New Loan (Give Loan Wizard)
The **Give Loan** section features a two-step wizard optimized for both desktop and mobile layouts:

#### **Step 1: Borrower & Schedule Details**
1. **Borrower Personal Info:** Enter Full Name, Phone, and NIC Number (supported Sri Lankan formats e.g. `199012345678` or `123456789V`). Email and Gender are optional.
2. **Borrower Profile:** Income details, purpose of loan, number of dependents, and spouse details.
3. **Maturity & Interest Terms:**
   * **Principal Amount:** Cash amount to disburse in LKR.
   * **Interest Rate (%):** Rate charged per period (e.g. `5.00%`).
   * **Interest Type (Periodicity):** Select **Daily**, **Weekly**, or **Monthly**.
   * **Collection Mode:** Choose **Open-Ended** (running balance) or **Fixed Term** (maturity date computed based on number of periods).
4. **NIC Photo Attachment:** Capture or upload a photo of the borrower's NIC card.
5. **Include Guarantor Checkbox:** Check this if the loan requires a guarantor to progress to Step 2. Otherwise, click *Disburse Cash Loan* to issue immediately.

#### **Step 2: Guarantor Details** (Only if checked)
1. **Personal Information:** Enter Guarantor's Full Name, Phone, and NIC. Email and Date of Birth details are omitted for privacy.
2. **Legal Details:** Select gender/ethnicity, and state if they have pending court cases or are protected under the debt-recovery act.
3. **Financial Profile:** Enter Guarantor monthly income and expenses breakdowns.
4. **Disbursal:** Click *Disburse Cash Loan* to write the record and execute ledger entries.

> [!IMPORTANT]
> The wizard enforces strict field-level inline validation. If any field is incorrect, the form will highlight the field in red, print an error message underneath it, and automatically scroll the page to center on and focus that input field.

---

### Borrower & Loan File Auditing (Check Loans)
Clicking on any borrower from the loan lists takes you to their **Loan Ledger File**. This file is organized into four interactive tabs:

#### **1. Passbook & Payments Tab**
* **Live Calculations:** Interest is accrued in real-time up to the second whenever this page is opened.
* **Passbook Statement (Activity Log):** Chronological log of disbursements, accrued interest entries, penalties, and payments. Click this card to open a full-page, chronological, print-ready passbook report.
* **Inline "Record a Payment" Panel:** Enter cash payments for this loan on the spot. Choose payment type (Interest or Principal), enter amount, write notes, upload a photo, and submit.
* **History lists:** Displays lists of all collections received (with print button for receipt thermal printing) and interest accrual logs.

#### **2. Borrower Profile Tab**
* Shows the borrower's address, stated loan purpose, monthly income, spouse NIC, and dependents.

#### **3. Guarantor Info Tab**
* Displays the active guarantor's personal, financial, and legal details.
* Contains *Edit Guarantor* and *Remove Guarantor* options.

#### **4. Manage Loan Tab** (Admin Only)
* **Edit Terms:** Change the interest rate (%) or reassign the loan to another collection agent.
* **Apply Penalty:** Manually post late penalty fees (LKR) with custom reasons.
* **Mark as Defaulted:** Blocks agents from collecting cash from this borrower. Reinstatement is required to resume collection activity.
* **Write Off:** Permanently closes the loan and records the remaining balance as unrecoverable bad debt in the general ledger.

---

### Staff & Cash Reconciliation (Users & Cash Tools)
Under the **Users & Cash** page, administrators manage the business system configuration:
* **Add / Manage Users:** Register new administrators or field agents.
* **Secure User Deletion:** Permanent deletion of user accounts (who have no active transaction history) requires you to confirm by entering your administrator account password.
* **Cash Settlements:** Review handovers from agents, approving or rejecting field cash handovers.
* **Double-Entry General Ledger:** Full balance sheet showing asset accounts (`loan_receivable`, `cash`) and revenue accounts (`interest_revenue`, `penalty_revenue`). Click *Export CSV* to download this data.
* **Force Accrue Check:** Manual trigger button to test interest calculations across the portfolio.

---

## 4. Field Collection Agent Guide

As a **Collection Agent**, your screen is simplified to allow rapid, one-tap mobile collections in the field.

### Daily Collection Route
* Your homepage displays your route dashboard.
* **Collected Today:** Total cash collections you have recorded today.
* **My Customers:** List of all borrowers assigned to your collection route.

### Recording Collections
When visiting a customer:
1. Click **Record Payment** from your menu.
2. Select the customer's name from the dropdown. The system will display their outstanding principal and interest due inline.
3. Select **Pay Interest** or **Pay Principal**.
4. Input the cash amount collected.
5. *(Optional)* Add notes or take a photo of the receipt/cash.
6. Click **Collect Payment**.
7. The system will automatically display a **Collection Receipt** popup. You can print this receipt on a mobile thermal printer to give to the customer.

### Cash Handover & Remittances
At the end of your shift or when your cash limit is reached:
1. Navigate to the **Remit Cash** section.
2. Enter the exact cash amount you are handing over to the office.
3. Upload proof of transfer or write notes.
4. Submit the request.
5. Your dashboard's "Cash-in-Hand" counter will update once the Administrator approves the remittance.

---

## 5. Operational Best Practices

> [!TIP]
> * **Real-time Checks:** Open the borrower's statement file to force calculations before accepting final payments.
> * **Internet Drops:** If collections fail due to signal drops, do not resubmit immediately; review your *Collection History* tab first to ensure the transaction was not already recorded.
> * **Audit Trails:** Never deactivate or modify agents without checking their *Cash in Hand* ledger balance.
