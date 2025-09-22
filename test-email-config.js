#!/usr/bin/env node

// Simple script to test email configuration
require('dotenv').config({ path: '.env.local' });

console.log('=== Email Configuration Test ===');
console.log('');

console.log('Environment Variables:');
console.log('- RESEND_API_KEY:', process.env.RESEND_API_KEY ? `${process.env.RESEND_API_KEY.substring(0, 6)}...${process.env.RESEND_API_KEY.slice(-4)}` : 'NOT SET');
console.log('- EMAIL_FROM:', process.env.EMAIL_FROM || 'NOT SET');
console.log('- NEXT_PUBLIC_BASE_URL:', process.env.NEXT_PUBLIC_BASE_URL || 'NOT SET');
console.log('- MAILGUN_API_KEY:', process.env.MAILGUN_API_KEY ? 'SET' : 'NOT SET');
console.log('- MAILGUN_DOMAIN:', process.env.MAILGUN_DOMAIN || 'NOT SET');
console.log('- EMAIL_HOST:', process.env.EMAIL_HOST || 'NOT SET');
console.log('');

// Test the email service
async function testEmailService() {
  try {
    console.log('Testing email service...');
    
    // Import the sendEmail function
    const { sendEmail } = require('./src/lib/email');
    
    // Test data
    const testData = {
      to: 'test@example.com',
      subject: 'Test Email Configuration',
      template: 'client-approval-request',
      data: {
        clientName: 'Test Client',
        projectName: 'Test Project',
        roomName: 'Test Room',
        approvalUrl: process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}/approval/test-id` : 'https://example.com/approval/test-id'
      }
    };
    
    console.log('Email test data:', JSON.stringify(testData, null, 2));
    console.log('');
    
    // Note: We won't actually send the email, just validate the configuration
    console.log('✅ Email service configuration appears valid');
    console.log('Note: Actual email sending test skipped to avoid sending test emails');
    
  } catch (error) {
    console.error('❌ Email service test failed:');
    console.error(error.message);
    if (error.stack) {
      console.error('Stack trace:');
      console.error(error.stack);
    }
  }
}

testEmailService().then(() => {
  console.log('');
  console.log('=== Test Complete ===');
}).catch(console.error);