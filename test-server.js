const http = require('http');

console.log('🧪 Testing if Next.js dev server is responding...');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/',
  method: 'GET',
  timeout: 5000
};

const req = http.request(options, (res) => {
  console.log(`✅ Server responded: ${res.statusCode}`);
  console.log(`📋 Headers:`, res.headers);
  
  if (res.statusCode === 200) {
    console.log('🎉 Next.js dev server is running on http://localhost:3000');
  } else {
    console.log(`⚠️ Unexpected status code: ${res.statusCode}`);
  }
});

req.on('error', (err) => {
  console.error('❌ Server connection failed:', err.message);
  console.log('💡 Make sure to run: npm run dev');
});

req.on('timeout', () => {
  console.error('⏰ Server connection timed out');
  console.log('💡 Make sure Next.js dev server is running on port 3000');
  req.destroy();
});

req.end();