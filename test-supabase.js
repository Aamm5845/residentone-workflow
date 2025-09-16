const { Pool } = require('pg');

// Different connection patterns to try
const patterns = [
  "postgresql://postgres:Meisner6700%21@db.zxoopadjouvuueogwdve.supabase.co:5432/postgres",
  "postgresql://postgres.zxoopadjouvuueogwdve:Meisner6700%21@aws-0-us-west-1.pooler.supabase.com:6543/postgres",
  "postgresql://postgres.zxoopadjouvuueogwdve:Meisner6700%21@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
  "postgresql://postgres.zxoopadjouvuueogwdve:Meisner6700%21@aws-0-eu-west-1.pooler.supabase.com:6543/postgres"
];

async function testConnection(connectionString, index) {
  console.log(`\n🔍 Testing pattern ${index + 1}:`, connectionString.split(':')[2].split('@')[1]);
  
  const pool = new Pool({ connectionString });
  
  try {
    const client = await pool.connect();
    console.log('✅ SUCCESS! Database connected!');
    const result = await client.query('SELECT NOW()');
    console.log('⏰ Current time:', result.rows[0].now);
    client.release();
    return true;
  } catch (err) {
    console.log('❌ Failed:', err.code || err.message);
    return false;
  } finally {
    await pool.end();
  }
}

async function testAllPatterns() {
  console.log('🚀 Testing Supabase connection patterns...\n');
  
  for (let i = 0; i < patterns.length; i++) {
    const success = await testConnection(patterns[i], i);
    if (success) {
      console.log(`\n🎉 FOUND WORKING CONNECTION! Use pattern ${i + 1}`);
      console.log('📋 Add this to your .env file:');
      console.log(`DATABASE_URL="${patterns[i]}"`);
      return;
    }
  }
  
  console.log('\n❌ None of the patterns worked.');
  console.log('📝 Please check your Supabase dashboard for the exact connection details.');
}

testAllPatterns();
