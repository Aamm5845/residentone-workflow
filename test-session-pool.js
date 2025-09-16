const { Pool } = require('pg');

// Try session pooling format (this is typically what works)
const sessionPoolingUrl = "postgresql://postgres.zxoopadjouvuueogwdve:Meisner6700!@aws-0-us-west-1.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=1";

console.log('🔍 Testing session pooling connection...');

const pool = new Pool({
  connectionString: sessionPoolingUrl,
});

async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('✅ SUCCESS! Session pooling connected!');
    const result = await client.query('SELECT NOW()');
    console.log('⏰ Current time:', result.rows[0].now);
    client.release();
    
    console.log('\n🎉 WORKING CONNECTION FOUND!');
    console.log('📋 Add this to your .env file:');
    console.log(`DATABASE_URL="${sessionPoolingUrl}"`);
    
  } catch (err) {
    console.log('❌ Session pooling failed:', err.message);
    console.log('Error code:', err.code);
    
    // Try without pgbouncer parameter
    console.log('\n🔍 Trying without pgbouncer parameter...');
    const simpleUrl = "postgresql://postgres.zxoopadjouvuueogwdve:Meisner6700!@aws-0-us-west-1.pooler.supabase.com:5432/postgres";
    
    const pool2 = new Pool({ connectionString: simpleUrl });
    try {
      const client2 = await pool2.connect();
      console.log('✅ SUCCESS! Simple pooling connected!');
      console.log('📋 Use this URL:');
      console.log(`DATABASE_URL="${simpleUrl}"`);
      client2.release();
    } catch (err2) {
      console.log('❌ Simple pooling also failed:', err2.message);
    }
    await pool2.end();
  } finally {
    await pool.end();
  }
}

testConnection();
