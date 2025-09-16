const { Pool } = require('pg');

// Test with URL-encoded password
// Try different possible hostname patterns
const patterns = [
  "postgresql://postgres:Meisner6700%21@db.zxoopadjouvuueogwdve.supabase.co:5432/postgres",
  "postgresql://postgres.zxoopadjouvuueogwdve:Meisner6700%21@aws-0-us-west-1.pooler.supabase.com:6543/postgres",
  "postgresql://postgres.zxoopadjouvuueogwdve:Meisner6700%21@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
];

const connectionString = patterns[0]; // We'll test each one

const pool = new Pool({
  connectionString: connectionString,
});

async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('✅ Database connected successfully!');
    const result = await client.query('SELECT NOW()');
    console.log('⏰ Current time:', result.rows[0].now);
    client.release();
  } catch (err) {
    console.log('❌ Connection failed:', err.message);
    console.log('Full error:', err);
  } finally {
    await pool.end();
  }
}

testConnection();
