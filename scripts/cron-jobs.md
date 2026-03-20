# Cron Jobs Setup for SACMS Billing System

This document explains how to set up automated billing cron jobs for SACMS.

## Overview

SACMS uses cron jobs to automate:
- Monthly invoice generation for active subscriptions
- Payment reminders for pending invoices
- Subscription status updates

## Cron Job Endpoints

### 1. Generate Monthly Invoices
- **Endpoint**: `POST /api/admin/billing/generate-invoices`
- **Purpose**: Generate invoices for subscriptions whose billing period has ended
- **Schedule**: Daily at 00:00 UTC (midnight)
- **Authentication**: Requires `CRON_SECRET` in Authorization header

### 2. Preview Invoices (Optional)
- **Endpoint**: `GET /api/admin/billing/generate-invoices`
- **Purpose**: Preview which subscriptions will be billed
- **Schedule**: As needed (for testing)
- **Authentication**: Requires admin session

## Setup Instructions

### Option 1: Using Vercel Cron Jobs (Recommended for Vercel Deployments)

1. Create or update `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/admin/billing/generate-invoices",
      "schedule": "0 0 * * *"
    }
  ]
}
```

2. The cron job will automatically be configured when you deploy to Vercel.

### Option 2: Using Linux/Unix Cron

1. Open crontab:
   ```bash
   crontab -e
   ```

2. Add the following line:
   ```bash
   0 0 * * * curl -X POST https://your-domain.com/api/admin/billing/generate-invoices -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```

3. Save and exit

### Option 3: Using GitHub Actions

Create `.github/workflows/billing-cron.yml`:

```yaml
name: Monthly Billing

on:
  schedule:
    - cron: '0 0 * * *'  # Runs at 00:00 UTC daily
  workflow_dispatch:  # Allow manual triggering

jobs:
  generate-invoices:
    runs-on: ubuntu-latest
    steps:
      - name: Generate Invoices
        run: |
          curl -X POST \
            https://your-domain.com/api/admin/billing/generate-invoices \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
        env:
          CRON_SECRET: ${{ secrets.CRON_SECRET }}
```

### Option 4: Using Node.js Cron (For Development)

1. Install dependencies:
   ```bash
   npm install node-cron
   ```

2. Create `src/lib/cron.ts`:

```typescript
import cron from 'node-cron'
import axios from 'axios'

const CRON_SECRET = process.env.CRON_SECRET!
const API_URL = process.env.NEXT_PUBLIC_APP_URL!

export function startCronJobs() {
  // Run daily at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('Running daily invoice generation...')
    
    try {
      const response = await axios.post(
        `${API_URL}/api/admin/billing/generate-invoices`,
        {},
        {
          headers: {
            Authorization: `Bearer ${CRON_SECRET}`
          }
        }
      )
      
      console.log('Cron job completed:', response.data)
    } catch (error) {
      console.error('Cron job failed:', error)
    }
  })
  
  console.log('Cron jobs started')
}
```

3. Add to `app/layout.tsx`:

```typescript
import { startCronJobs } from '@/lib/cron'

// Add this in a useEffect or initialization
if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
  startCronJobs()
}
```

## Environment Variables

Make sure these are set in your environment:

```env
# Cron Job Secret (generate a secure random string)
CRON_SECRET="your-super-secret-cron-key-change-this-in-production"

# App URL
NEXT_PUBLIC_APP_URL="https://your-domain.com"
```

## Testing Cron Jobs

### 1. Manual Test via Curl

```bash
curl -X POST \
  http://localhost:3000/api/admin/billing/generate-invoices \
  -H "Authorization: Bearer your-super-secret-cron-key-change-this-in-production"
```

### 2. Preview Before Running

As a super admin, visit:
```
http://localhost:3000/api/admin/billing/generate-invoices
```

This will show you which subscriptions will be billed without actually generating invoices.

### 3. Test with Vercel Cron

1. Deploy to Vercel
2. Wait for the next scheduled run
3. Check logs in Vercel Dashboard

## Monitoring

### Check Cron Job Status

The generate-invoices endpoint returns:
```json
{
  "success": true,
  "results": {
    "processed": 10,
    "skipped": 5,
    "failed": 0,
    "invoices": [...]
  },
  "message": "Processed 10 subscriptions, skipped 5, failed 0"
}
```

### Set Up Alerts

For production, consider:
- Email notifications on failures
- Slack/Discord webhooks for status updates
- Monitoring services (Sentry, Datadog, etc.)

## Troubleshooting

### Cron Job Not Running

1. **Check CRON_SECRET**:
   ```bash
   echo $CRON_SECRET
   ```

2. **Verify Endpoint is Accessible**:
   ```bash
   curl -I https://your-domain.com/api/admin/billing/generate-invoices
   ```

3. **Check Server Logs**:
   ```bash
   # Vercel
   vercel logs --follow

   # Linux Cron
   grep CRON /var/log/syslog
   ```

### Invoices Not Generated

1. **Check Subscription Status**:
   - Subscription must be `active`
   - `cancelAtPeriodEnd` must be `false`

2. **Check Billing Period**:
   - `currentPeriodEnd` must be set
   - Must be in the past

3. **Check Plan Price**:
   - Free plans (Rp 0) are skipped

### Too Many Failed Invoices

1. **Check Database Connection**
2. **Verify PLAN_PRICES Configuration**
3. **Review Error Logs**

## Best Practices

1. **Use a Secure CRON_SECRET**:
   ```bash
   openssl rand -base64 32
   ```

2. **Run in Off-Peak Hours**:
   - Schedule at midnight in your target timezone
   - Consider timezone differences

3. **Add Error Handling**:
   - Implement retry logic
   - Send notifications on failures

4. **Monitor Performance**:
   - Track execution time
   - Monitor database load

5. **Test Before Production**:
   - Test with development environment
   - Verify with a small batch first

## Additional Cron Jobs (Future)

### Payment Reminders
- **Endpoint**: (To be implemented)
- **Schedule**: 3 days before due date

### Subscription Expiration
- **Endpoint**: (To be implemented)
- **Schedule**: Weekly check for overdue payments

### Revenue Reports
- **Endpoint**: `/api/admin/billing/stats`
- **Schedule**: Daily at 08:00 UTC

## Support

For issues or questions:
1. Check server logs
2. Review this documentation
3. Contact development team

---

**Last Updated**: 2026-03-13
**Version**: 1.0