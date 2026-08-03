import db from './config/db.js';

async function test() {
  try {
    const loans = await db('loans').select('id', 'principal_amount', 'current_balance', 'status', 'next_accrual_date', 'last_accrual_date');
    console.log('--- ALL LOANS ---');
    console.log(loans);

    const now = new Date();
    console.log('\nJS Date now:', now.toISOString());

    const nowDb = await db.raw("SELECT datetime('now') as now, CURRENT_TIMESTAMP as current_ts");
    console.log('\nDB now:', nowDb);

    const qualifying = await db('loans')
      .where('status', 'active')
      .andWhere('next_accrual_date', '<=', db.fn.now());
    console.log('\nQualifying with db.fn.now():', qualifying.length);
    for (const q of qualifying) {
      console.log(`Loan ID: ${q.id}, Next accrual: ${q.next_accrual_date}`);
    }

    const qualifyingJs = await db('loans')
      .where('status', 'active')
      .andWhere('next_accrual_date', '<=', now.toISOString());
    console.log('\nQualifying with JS now.toISOString():', qualifyingJs.length);

  } catch (err) {
    console.error(err);
  } finally {
    await db.destroy();
  }
}

test();
