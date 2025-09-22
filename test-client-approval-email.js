#!/usr/bin/env node

// Test script to simulate the actual client approval email flow
require('dotenv').config({ path: '.env.local' });

console.log('=== Client Approval Email Test ===');
console.log('');

// Get test email from command line args
const testEmail = process.argv[2];

if (!testEmail) {
  console.log('Usage: node test-client-approval-email.js <your-email@example.com>');
  console.log('');
  console.log('This script will simulate sending a client approval email.');
  process.exit(1);
}

async function testClientApprovalEmail() {
  try {
    console.log('🏗️ Testing client approval email flow...');
    console.log('');
    
    // Import required modules
    const { Resend } = require('resend');
    const { generateMeisnerDeliveryEmailTemplate } = require('./src/lib/email-templates');
    
    // Verify environment variables
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not set');
    }
    
    if (!process.env.EMAIL_FROM) {
      throw new Error('EMAIL_FROM is not set');
    }
    
    console.log('✅ Environment variables configured');
    console.log('  - RESEND_API_KEY:', process.env.RESEND_API_KEY.substring(0, 6) + '...');
    console.log('  - EMAIL_FROM:', process.env.EMAIL_FROM);
    console.log('');
    
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    // Simulate real client approval data (like what comes from the API)
    const mockTemplateData = {
      clientName: 'Sarah Johnson',
      projectName: 'Luxury Downtown Apartment',
      roomName: 'Master Bedroom',
      designPhase: 'Client Approval',
      projectAddress: '123 Park Avenue, New York, NY',
      approvalUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/approve/test-token-123`,
      assets: [
        {
          id: 'asset-1',
          url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
          includeInEmail: true
        },
        {
          id: 'asset-2', 
          url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
          includeInEmail: true
        }
      ],
      trackingPixelUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/email/track/test-123`
    };
    
    console.log('📧 Generating email template with mock data...');
    console.log('Template data:', {
      clientName: mockTemplateData.clientName,
      projectName: mockTemplateData.projectName,
      roomName: mockTemplateData.roomName,
      assetsCount: mockTemplateData.assets.length,
      approvalUrl: mockTemplateData.approvalUrl
    });
    console.log('');
    
    // Generate the email template (this is where the error might occur)
    console.log('🎨 Calling generateMeisnerDeliveryEmailTemplate...');
    const { subject, html } = generateMeisnerDeliveryEmailTemplate(mockTemplateData);
    
    console.log('✅ Email template generated successfully');
    console.log('  - Subject:', subject);
    console.log('  - HTML length:', html.length);
    console.log('');
    
    // Prepare email data exactly as email-service.ts does
    const emailData = {
      from: process.env.EMAIL_FROM.trim(),
      to: testEmail.trim(),
      subject: subject.trim(),
      html: html
    };
    
    // Add tags like the real service does
    const cleanTags = ['client-approval', 'delivery', mockTemplateData.projectName.toLowerCase().replace(/\\s+/g, '-')]
      .filter(tag => tag && typeof tag === 'string' && tag.trim() !== '')
      .map(tag => tag.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-'))
      .slice(0, 10);
    
    if (cleanTags.length > 0) {
      emailData.tags = cleanTags;
    }
    
    console.log('📤 Preparing to send email with data:');
    console.log('  - From:', emailData.from);
    console.log('  - To:', emailData.to);
    console.log('  - Subject length:', emailData.subject.length);
    console.log('  - HTML length:', emailData.html.length);
    console.log('  - Tags:', cleanTags);
    console.log('');
    
    // Validate all fields like email-service.ts does
    if (!emailData.from || emailData.from.trim() === '') {
      throw new Error('FROM address is required');
    }
    if (!emailData.to || emailData.to.trim() === '') {
      throw new Error('Recipient email address is required');
    }
    if (!emailData.subject || emailData.subject.trim() === '') {
      throw new Error('Email subject is required');
    }
    if (!emailData.html || emailData.html.trim() === '') {
      throw new Error('Email content is required');
    }
    
    console.log('✅ All field validation passed');
    console.log('');
    
    // Log the exact payload that will be sent (for debugging)
    console.log('🔍 Exact email payload:');
    const payloadToLog = {
      from: emailData.from,
      to: emailData.to,
      subject: emailData.subject.substring(0, 100) + (emailData.subject.length > 100 ? '...' : ''),
      htmlPreview: emailData.html.substring(0, 200) + '...',
      tags: emailData.tags
    };
    console.log(JSON.stringify(payloadToLog, null, 2));
    console.log('');
    
    // Send the email
    console.log('🚀 Sending email via Resend...');
    const result = await resend.emails.send(emailData);
    
    console.log('✅ Client approval email sent successfully!');
    console.log('  - Message ID:', result.data?.id);
    console.log('');
    console.log('Please check your email inbox for the client approval email.');
    
  } catch (error) {
    console.error('❌ Client approval email test failed:', error);
    
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message
      });
      
      // Specific guidance for Resend errors
      if (error.message.includes('validation_error')) {
        console.log('');
        console.log('💡 Resend validation error detected. This usually means:');
        console.log('  - One or more fields contain invalid data');
        console.log('  - Empty strings where content is expected');
        console.log('  - Malformed email addresses');
        console.log('  - Invalid HTML content');
      }
      
      if (error.message.includes('Invalid literal value')) {
        console.log('');
        console.log('💡 "Invalid literal value" typically means:');
        console.log('  - A field is null, undefined, or empty string when Resend expects content');
        console.log('  - Incorrect data type (e.g., number instead of string)');
        console.log('  - Malformed JSON in the request payload');
      }
      
      // Check if it's a template generation error
      if (error.stack && error.stack.includes('email-templates')) {
        console.log('');
        console.log('💡 The error occurred during template generation:');
        console.log('  - Check the email template for syntax errors');
        console.log('  - Verify all template variables are properly defined');
        console.log('  - Look for undefined variables or null values');
      }
    }
    
    console.log('');
    console.log('🔧 Debug suggestions:');
    console.log('  1. Check that projects@meisnerinteriors.com is verified in Resend');
    console.log('  2. Verify the email template generates valid HTML');
    console.log('  3. Ensure all template variables have non-null values');
    console.log('  4. Check for special characters in subject line');
  }
}

testClientApprovalEmail().then(() => {
  console.log('');
  console.log('=== Test Complete ===');
}).catch(console.error);