# SMS Troubleshooting Guide

## Problem: Test SMS button not working, no logs in Twilio

### Quick Diagnosis Steps

#### 1. Check Local Environment (Development)

Run the debug script:
```bash
node debug-sms.js
```

This will verify:
- ✅ Environment variables are set
- ✅ Twilio credentials are valid
- ✅ Phone number is active

#### 2. Check Production Environment (Vercel)

**Option A: Use the debug endpoint**

1. Visit: `https://your-domain.com/api/debug/sms-check`
2. Look for the response:
   ```json
   {
     "twilioConfigured": true,
     "twilioDetails": {
       "hasAccountSid": true,
       "hasAuthToken": true,
       "hasPhoneNumber": true,
       "phoneNumber": "+1234567890"
     }
   }
   ```

**Option B: Check Vercel Dashboard**

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Verify these exist and are set for **Production**:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER`

3. **IMPORTANT**: After adding/updating env vars, you MUST redeploy:
   - Go to Deployments tab
   - Click the three dots on the latest deployment
   - Click "Redeploy"

#### 3. Check Browser Console

1. Open browser DevTools (F12)
2. Go to Console tab
3. Click "Send Test SMS" button
4. Look for errors:
   - Network errors (fetch failed)
   - 401 Unauthorized
   - 403 Forbidden
   - 500 Internal Server Error

#### 4. Check Server Logs in Vercel

1. Go to Vercel Dashboard → Your Project → Deployments
2. Click on the latest deployment
3. Go to "Runtime Logs" tab
4. Click "Send Test SMS" button
5. Watch for logs starting with:
   - `[Test SMS]`
   - `[Twilio]`

### Common Issues & Solutions

#### Issue 1: Environment Variables Not Set in Vercel

**Symptoms:**
- No logs appear in Twilio
- Server logs show: "Twilio credentials not configured"

**Solution:**
1. Go to Vercel → Settings → Environment Variables
2. Add all three Twilio variables
3. **MUST** redeploy after adding env vars

#### Issue 2: Wrong Twilio Phone Number Format

**Symptoms:**
- Error: "The 'From' number is not a valid phone number"

**Solution:**
- Phone number must include country code: `+1234567890`
- Not: `1234567890` or `(123) 456-7890`

#### Issue 3: User's Phone Number Not Saved

**Symptoms:**
- Error: "Phone number not set"

**Solution:**
1. Go to Team Members page
2. Click on a user
3. Enter phone number
4. Enable SMS notifications
5. Click "Save"

#### Issue 4: Phone Number Format in Database

**Symptoms:**
- SMS sends but fails with invalid number error

**Solution:**
The phone number should be stored as digits only (no formatting):
- ✅ Good: `5551234567`
- ❌ Bad: `(555) 123-4567`

The code handles formatting automatically.

#### Issue 5: Twilio Account Issues

**Symptoms:**
- Error: "Unable to create record: Account not active"
- Error: "Authenticate"

**Solutions:**
1. Check your Twilio account is active
2. Verify you have SMS credits/balance
3. For trial accounts:
   - Verify the receiving phone number in Twilio
   - Trial accounts can only send to verified numbers

#### Issue 6: API Route Not Found

**Symptoms:**
- 404 Not Found error
- Browser shows: "Failed to send test SMS"

**Solution:**
1. Check the file exists: `src/app/api/users/[userId]/phone/test-sms/route.ts`
2. Rebuild and redeploy

### Step-by-Step Testing Process

#### Test 1: Local Development

```bash
# 1. Check environment variables
cat .env.local | grep TWILIO

# 2. Run debug script
node debug-sms.js

# 3. Start dev server
npm run dev

# 4. Test in browser
# - Go to Team Members
# - Click a user
# - Add phone number
# - Enable SMS
# - Save
# - Click "Send Test SMS"
```

#### Test 2: Production (Vercel)

```bash
# 1. Check Vercel env vars
vercel env ls

# 2. Pull env vars locally to compare
vercel env pull .env.vercel

# 3. Compare with your .env.local
diff .env.local .env.vercel

# 4. If different, update in Vercel dashboard and redeploy
```

### Debugging Commands

```bash
# Check if phone endpoint is accessible
curl https://your-domain.com/api/users/USER_ID/phone/test-sms -X POST \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie"

# Check debug endpoint
curl https://your-domain.com/api/debug/sms-check

# Check Vercel logs (requires Vercel CLI)
vercel logs
```

### What to Check in Twilio Dashboard

1. Go to: https://console.twilio.com/
2. Monitor → Logs → Messaging
3. Look for:
   - Recent messages
   - Failed delivery attempts
   - Error messages

If you see **nothing** in Twilio logs, it means:
- The SMS was never sent (API not called)
- Environment variables are not set
- Twilio client failed to initialize

### Next Steps Based on Symptoms

| Symptom | Check |
|---------|-------|
| No logs in Twilio | Env vars not set in Vercel |
| "Twilio not configured" error | Missing env vars or wrong format |
| "Phone number not set" error | User profile not saved |
| "Failed to send SMS" in UI | Check browser console + server logs |
| Button does nothing | Check browser console for JS errors |
| 401/403 error | Check user permissions |

### Quick Fix Checklist

- [ ] Run `node debug-sms.js` locally
- [ ] Verify Twilio env vars in Vercel dashboard
- [ ] Redeploy after setting env vars
- [ ] Check user has phone number saved
- [ ] Check user has SMS notifications enabled
- [ ] Check browser console for errors
- [ ] Check Vercel runtime logs
- [ ] Check Twilio console for logs

### Still Not Working?

Share these details:
1. Browser console error (if any)
2. Server logs from Vercel
3. Output of `node debug-sms.js`
4. Screenshot of Vercel environment variables (hide values)
5. Screenshot of user's phone settings in app
