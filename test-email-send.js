#!/usr/bin/env node

// Test script to actually send an email via Resend
require('dotenv').config({ path: '.env.local' });

console.log('=== Resend Email Send Test ===');
console.log('');

// Get test email from command line args or prompt user
const testEmail = process.argv[2];

if (!testEmail) {
  console.log('Usage: node test-email-send.js <your-email@example.com>');
  console.log('');
  console.log('This script will send a test email to the provided address.');
  console.log('Make sure to use your own email address to test!');
  process.exit(1);
}

console.log('Test email will be sent to:', testEmail);
console.log('');

async function sendTestEmail() {
  try {
    const { Resend } = require('resend');
    
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not set');
    }
    
    if (!process.env.EMAIL_FROM) {
      throw new Error('EMAIL_FROM is not set');
    }
    
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    const emailData = {
      from: process.env.EMAIL_FROM,
      to: testEmail,
      subject: 'Test Email from Meisner Interiors System',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #d4af37; text-align: center;">Test Email</h1>
          <p>Hello!</p>
          <p>This is a test email from the Meisner Interiors workflow system to verify that email sending is working correctly.</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3>Configuration Details:</h3>
            <ul>
              <li><strong>From:</strong> ${process.env.EMAIL_FROM}</li>
              <li><strong>To:</strong> ${testEmail}</li>
              <li><strong>Sent at:</strong> ${new Date().toLocaleString()}</li>
            </ul>
          </div>
          <p>If you received this email, your Resend configuration is working properly! 🎉</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #666; text-align: center;">
            This is a test email from Meisner Interiors workflow system.
          </p>
        </div>
      `
    };
    
    console.log('Sending test email...');
    console.log('Email data:', {
      from: emailData.from,
      to: emailData.to,
      subject: emailData.subject,
      htmlLength: emailData.html.length
    });
    console.log('');
    
    const result = await resend.emails.send(emailData);
    
    console.log('✅ Email sent successfully!');
    console.log('Message ID:', result.data?.id);
    console.log('');
    console.log('Please check your email inbox (and spam folder) for the test email.');
    
  } catch (error) {
    console.error('❌ Failed to send test email:', error);
    
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message
      });
      
      // Check for common Resend errors
      if (error.message.includes('validation')) {
        console.log('');
        console.log('💡 This looks like a validation error. Common causes:');
        console.log('  - Invalid FROM address (must use verified domain)');
        console.log('  - Invalid TO address format');
        console.log('  - Missing required fields');
      }
      
      if (error.message.includes('Invalid literal value')) {
        console.log('');
        console.log('💡 "Invalid literal value" error suggests:');
        console.log('  - Empty or null fields being sent to Resend');
        console.log('  - Incorrect data types in the email payload');
      }
    }
  }
}

sendTestEmail().then(() => {
  console.log('=== Test Complete ===');
}).catch(console.error);