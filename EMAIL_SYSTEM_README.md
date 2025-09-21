# 🎨 Meisner Interiors Email System

A comprehensive client approval email system with beautiful templates, tracking, and analytics.

## ✨ Features

### 1. Beautiful Email Template
- **Meisner Interiors branded design** with professional typography
- **Mobile responsive** layout that works on all devices
- **Elegant color scheme** with gold accents (#d4af37) and luxury feel
- **Professional imagery presentation** with hover effects
- **Clear call-to-action buttons** for approval/revision requests

### 2. Email Tracking & Analytics
- **Open tracking** using invisible pixel tracking
- **Link click tracking** with detailed analytics
- **Real-time analytics dashboard** showing:
  - Total emails sent
  - Open rates and times
  - Click-through rates
  - Detailed engagement metrics

### 3. Preview & Testing
- **Live email preview** in the client approval interface
- **Test email functionality** to send test emails before going live
- **Real-time template generation** with actual client data

### 4. Personalization
- **Dynamic client information** (name, project, room details)
- **Project-specific content** (address, phase, room type)
- **Personalized messaging** based on project context

## 🚀 How to Use

### From the Client Approval Interface:

1. **Preview Email**: Click the "Preview Email" button to see exactly how the email will appear to your client
2. **Send Test Email**: Use "Send Test Email" to send a test version to yourself or team members
3. **Send to Client**: Once satisfied, use "Send to Client" to send the actual approval request
4. **View Analytics**: After sending, view real-time engagement analytics in the sidebar

### Direct API Usage:

#### Email Preview
```bash
GET /api/email/preview/[versionId]?format=html
```

#### Send Test Email
```bash
POST /api/email/test/[versionId]
Content-Type: application/json

{
  "testEmail": "your.email@example.com"
}
```

#### Email Analytics
```bash
GET /api/email/analytics/[versionId]
```

## 📧 Email Template Features

### Header Section
- Meisner Interiors logo and branding
- "Good News! Your Design Is Ready" messaging
- Professional dark gradient background

### Project Information Card
- Client name and project details
- Room type and design phase
- Project location (if available)
- Clean, organized layout

### Renderings Gallery
- Grid layout for multiple renderings
- High-quality image presentation
- Hover effects and captions
- Responsive design for all screen sizes

### Call-to-Action Section
- Primary "Approve Design" button (gold gradient)
- Secondary "Request Changes" button (outlined)
- Clear instructions for the client

### Next Steps Timeline
- Visual timeline showing the process
- Clear expectations for what happens after approval
- Professional icons and styling

### Footer
- Contact information
- Professional disclaimers
- Tracking pixel integration

## 🔧 Technical Implementation

### Database Schema
The system uses the existing `EmailLog` table with these key fields:
- `versionId`: Links to ClientApprovalVersion
- `to`: Recipient email address
- `subject`: Email subject line
- `html`: Complete HTML content
- `sentAt`: Send timestamp
- `openedAt`: First open timestamp
- `metadata`: JSON field for tracking data (clicks, etc.)

### Email Service Integration
- **Mailgun** for production email delivery
- **SMTP fallback** for development/testing
- **Vercel-compatible** deployment

### Tracking Implementation
- **Pixel tracking**: 1x1 transparent GIF for open tracking
- **Link tracking**: Click-through tracking with redirects
- **Analytics aggregation**: Real-time calculation of engagement metrics

## 🎯 Email Template Customization

The template system is highly customizable:

```typescript
const emailData = {
  clientName: 'Sarah Johnson',
  projectName: 'Luxury Downtown Apartment', 
  roomName: 'Master Bedroom',
  designPhase: 'Client Approval',
  projectAddress: '123 Park Avenue, New York, NY',
  approvalUrl: 'https://yoursite.com/approve/token',
  assets: [/* array of rendering images */],
  trackingPixelUrl: 'https://yoursite.com/track/id'
}

const { subject, html } = generateMeisnerDeliveryEmailTemplate(emailData)
```

## 📊 Analytics Dashboard

The analytics provide comprehensive insights:

- **Email Delivery Status**: Sent, delivered, bounced
- **Engagement Metrics**: Open rates, click rates, time spent
- **Client Behavior**: First open time, multiple opens, link clicks
- **Performance Trends**: Historical data and patterns

## 🛡️ Security & Privacy

- **Secure token generation** for client approval links
- **Expiring links** (14-day default expiration)
- **Privacy-compliant tracking** with minimal data collection
- **GDPR considerations** with appropriate disclosures

## 🌐 Vercel Deployment Ready

The system is fully compatible with Vercel:
- **Serverless API routes** for all email functions
- **Environment variable configuration** for email services
- **Edge-optimized** tracking endpoints
- **CDN-friendly** static assets

## 📱 Mobile Optimization

The email template includes:
- **Responsive grid layouts** that adapt to screen size
- **Touch-friendly buttons** with appropriate sizing
- **Readable typography** on mobile devices
- **Optimized image loading** for various connection speeds

## 🎨 Demo Page

Visit `/email-demo` to see a live preview of the email template with sample data.

## 🔄 Integration with Existing Workflow

The email system seamlessly integrates with the existing client approval workflow:

1. **Rendering Upload**: Upload 3D renderings to the system
2. **Aaron's Approval**: Internal approval process
3. **Asset Selection**: Choose which renderings to include in email
4. **Email Preview**: Review the email before sending
5. **Send to Client**: Deliver the beautiful email to the client
6. **Track Engagement**: Monitor opens, clicks, and responses
7. **Client Decision**: Client approves or requests revisions
8. **Analytics Review**: Analyze engagement and improve future emails

This creates a professional, trackable, and beautiful client communication experience that reflects the high-end nature of Meisner Interiors' work.