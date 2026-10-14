/**
 * Automated Seed Script for Supabase
 *
 * Runs with: npm run seed
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local to bypass RLS,
 * OR run supabase/insert_seed_data.sql in the Supabase SQL Editor.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and a key are required in .env.local');
  process.exit(1);
}

const isServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabase = createClient(url, key);

async function main() {
  console.log('Connecting to Supabase at:', url);
  console.log('Using key type:', isServiceRole ? 'Service Role Key (Full Admin)' : 'Anon Key (Subject to RLS)');

  if (!isServiceRole) {
    console.log('\n================================================================');
    console.log('NOTICE: For direct SQL seeding from your browser, open:');
    console.log('Supabase Project -> SQL Editor -> New Query');
    console.log('Paste the contents of: supabase/insert_seed_data.sql and click RUN.');
    console.log('================================================================\n');
  }

  // Sample customer data
  const customers = [
    { id: 'a0000001-0000-0000-0000-000000000001', first_name: 'Aarav', last_name: 'Sharma', email: 'aarav.sharma@example.com', phone: '+91-98765-00001', tags: ['vip','repeat'], source: 'demo', email_opt_out: false },
    { id: 'a0000001-0000-0000-0000-000000000002', first_name: 'Priya', last_name: 'Patel', email: 'priya.patel@example.com', phone: '+91-98765-00002', tags: ['repeat'], source: 'demo', email_opt_out: false },
    { id: 'a0000001-0000-0000-0000-000000000003', first_name: 'Rohan', last_name: 'Gupta', email: 'rohan.gupta@example.com', phone: '+91-98765-00003', tags: ['new'], source: 'demo', email_opt_out: false },
    { id: 'a0000001-0000-0000-0000-000000000004', first_name: 'Ananya', last_name: 'Singh', email: 'ananya.singh@example.com', phone: '+91-98765-00004', tags: ['repeat','solar'], source: 'demo', email_opt_out: false },
    { id: 'a0000001-0000-0000-0000-000000000005', first_name: 'Vikram', last_name: 'Reddy', email: 'vikram.reddy@example.com', phone: '+91-98765-00005', tags: ['wholesale'], source: 'demo', email_opt_out: false },
    { id: 'a0000001-0000-0000-0000-000000000006', first_name: 'Meera', last_name: 'Nair', email: 'meera.nair@example.com', phone: '+91-98765-00006', tags: ['new'], source: 'demo', email_opt_out: false },
    { id: 'a0000001-0000-0000-0000-000000000007', first_name: 'Arjun', last_name: 'Deshmukh', email: 'arjun.deshmukh@example.com', phone: '+91-98765-00007', tags: ['repeat'], source: 'demo', email_opt_out: false },
    { id: 'a0000001-0000-0000-0000-000000000008', first_name: 'Kavya', last_name: 'Iyer', email: 'kavya.iyer@example.com', phone: '+91-98765-00008', tags: ['vip','repeat'], source: 'demo', email_opt_out: false },
    { id: 'a0000001-0000-0000-0000-000000000009', first_name: 'Siddharth', last_name: 'Joshi', email: 'siddharth.joshi@example.com', phone: '+91-98765-00009', tags: ['new'], source: 'demo', email_opt_out: false },
    { id: 'a0000001-0000-0000-0000-000000000010', first_name: 'Divya', last_name: 'Menon', email: 'divya.menon@example.com', phone: null, tags: ['inactive'], source: 'demo', email_opt_out: false },
    { id: 'a0000001-0000-0000-0000-000000000011', first_name: 'Rahul', last_name: 'Choudhury', email: 'rahul.choudhury@example.com', phone: '+91-98765-00011', tags: ['repeat'], source: 'demo', email_opt_out: false },
    { id: 'a0000001-0000-0000-0000-000000000012', first_name: 'Neha', last_name: 'Kapoor', email: 'neha.kapoor@example.com', phone: '+91-98765-00012', tags: ['new'], source: 'demo', email_opt_out: false },
    { id: 'a0000001-0000-0000-0000-000000000013', first_name: 'Amit', last_name: 'Verma', email: 'amit.verma@example.com', phone: '+91-98765-00013', tags: ['wholesale','vip'], source: 'demo', email_opt_out: false },
    { id: 'a0000001-0000-0000-0000-000000000014', first_name: 'Sneha', last_name: 'Rao', email: 'sneha.rao@example.com', phone: '+91-98765-00014', tags: ['inactive'], source: 'demo', email_opt_out: true },
    { id: 'a0000001-0000-0000-0000-000000000015', first_name: 'Karthik', last_name: 'Pillai', email: 'karthik.pillai@example.com', phone: '+91-98765-00015', tags: ['new'], source: 'demo', email_opt_out: false },
  ];

  console.log(`Attempting to push ${customers.length} customers...`);
  const { data: custData, error: custErr } = await supabase.from('customers').upsert(customers, { onConflict: 'id' }).select();
  if (custErr) {
    console.error('Customer upsert failed:', custErr.message);
    if (custErr.message.includes('row-level security')) {
      console.log('\nTIP: To push this data without RLS restriction, please execute:');
      console.log('supabase/insert_seed_data.sql');
      console.log('directly inside your Supabase Project SQL Editor.\n');
    }
    return;
  }
  console.log(`Successfully seeded ${custData.length} customers!`);
}

main().catch(console.error);
