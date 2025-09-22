#!/usr/bin/env node

// Debug script to isolate the Resend validation error
require('dotenv').config({ path: '.env.local' });

console.log('=== Resend Validation Error Debug ===');
console.log('');

const testEmail = process.argv[2];

if (!testEmail) {
  console.log('Usage: node debug-resend-error.js <your-email@example.com>');
  process.exit(1);
}

async function debugResendError() {
  try {
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    console.log('🔍 Testing various email payload structures to isolate the validation error...');
    console.log('');
    
    // Test 1: Minimal valid payload
    console.log('Test 1: Minimal valid payload');
    try {
      const result1 = await resend.emails.send({
        from: process.env.EMAIL_FROM,
        to: testEmail,
        subject: 'Test 1: Minimal',
        html: '<p>Test</p>'
      });
      console.log('✅ Test 1 passed:', result1.data?.id);
    } catch (error) {
      console.log('❌ Test 1 failed:', error.message);
      console.log('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    }
    console.log('');
    
    // Test 2: With tags (empty array)
    console.log('Test 2: With empty tags array');
    try {
      const result2 = await resend.emails.send({
        from: process.env.EMAIL_FROM,
        to: testEmail,
        subject: 'Test 2: Empty Tags',
        html: '<p>Test</p>',
        tags: []
      });
      console.log('✅ Test 2 passed:', result2.data?.id);
    } catch (error) {
      console.log('❌ Test 2 failed:', error.message);
      console.log('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    }
    console.log('');
    
    // Test 3: With valid tags
    console.log('Test 3: With valid tags');
    try {
      const result3 = await resend.emails.send({
        from: process.env.EMAIL_FROM,
        to: testEmail,
        subject: 'Test 3: Valid Tags',
        html: '<p>Test</p>',
        tags: ['test', 'client-approval']
      });
      console.log('✅ Test 3 passed:', result3.data?.id);
    } catch (error) {
      console.log('❌ Test 3 failed:', error.message);
      console.log('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    }
    console.log('');
    
    // Test 4: Large HTML content (simulating client approval email)
    console.log('Test 4: Large HTML content');
    const largeHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Email</title>
    <style>
        body { font-family: Arial, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Test Client Approval Email</h1>
        <p>Dear Client,</p>
        <p>This is a test of the client approval email system.</p>
        <div>
            <img src="https://images.unsplash.com/photo-1586023492125-27b2c045efd7" alt="Test Image" style="max-width: 100%;" />
        </div>
        <p>Please review and approve.</p>
    </div>
</body>
</html>`;
    
    try {
      const result4 = await resend.emails.send({
        from: process.env.EMAIL_FROM,
        to: testEmail,
        subject: '✨ Good News! Your Master Bedroom Is Ready - Test Project',
        html: largeHtml,
        tags: ['client-approval', 'delivery', 'test-project']
      });
      console.log('✅ Test 4 passed:', result4.data?.id);
    } catch (error) {
      console.log('❌ Test 4 failed:', error.message);
      console.log('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      
      // This is likely where we'll see the validation error
      if (error.message.includes('validation_error') || error.message.includes('Invalid literal value')) {
        console.log('');
        console.log('🎯 Found the validation error! Details:');
        console.log('Full error object:', error);
        
        // Try to extract more specific error info
        if (error.cause) {
          console.log('Error cause:', error.cause);
        }
        if (error.response) {
          console.log('Response data:', error.response);
        }
      }
    }
    console.log('');
    
    // Test 5: Subject with special characters
    console.log('Test 5: Subject with special characters');
    try {
      const result5 = await resend.emails.send({
        from: process.env.EMAIL_FROM,
        to: testEmail,
        subject: '✨🏠 Good News! Your "Master Bedroom" Is Ready - Luxury Apartment (Phase 1) 🎉',
        html: '<p>Test with special characters in subject</p>'
      });
      console.log('✅ Test 5 passed:', result5.data?.id);
    } catch (error) {
      console.log('❌ Test 5 failed:', error.message);
      console.log('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    }
    console.log('');
    
    // Test 6: Empty values that might cause issues
    console.log('Test 6: Testing for empty/null values');
    const testCases = [
      { name: 'Empty subject', payload: { from: process.env.EMAIL_FROM, to: testEmail, subject: '', html: '<p>Test</p>' }},
      { name: 'Null subject', payload: { from: process.env.EMAIL_FROM, to: testEmail, subject: null, html: '<p>Test</p>' }},
      { name: 'Undefined subject', payload: { from: process.env.EMAIL_FROM, to: testEmail, subject: undefined, html: '<p>Test</p>' }},
      { name: 'Empty html', payload: { from: process.env.EMAIL_FROM, to: testEmail, subject: 'Test', html: '' }},
      { name: 'Null html', payload: { from: process.env.EMAIL_FROM, to: testEmail, subject: 'Test', html: null }},
    ];
    
    for (const testCase of testCases) {
      try {
        console.log(`  Testing: ${testCase.name}`);
        const result = await resend.emails.send(testCase.payload);
        console.log(`  ✅ ${testCase.name} passed:`, result.data?.id);
      } catch (error) {
        console.log(`  ❌ ${testCase.name} failed:`, error.message);
        if (error.message.includes('Invalid literal value')) {
          console.log(`  🎯 ${testCase.name} caused the "Invalid literal value" error!`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Debug test failed:', error);
  }
}

debugResendError().then(() => {
  console.log('');
  console.log('=== Debug Complete ===');
  console.log('');
  console.log('Based on the test results above, we should be able to identify');
  console.log('which specific field or combination of fields is causing the');
  console.log('"Invalid literal value" validation error in Resend.');
}).catch(console.error);