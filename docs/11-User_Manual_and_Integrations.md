# User Manual / Panduan Pengguna SaCMS

Dokumen ini ditujukan untuk **Tenant Admin** dan **Content Editor** yang menggunakan antarmuka (UI) Dashboard SaCMS.

## 1. Memulai (Getting Started)
Sistem memiliki batasan akses (Login Boundaries) yang ketat berdasarkan peran Anda:
* **Super Admin & Workspace Admin/Owner:** Wajib mengakses login melalui Website Utama (misal: `https://[your-domain.com]/login`).
* **Content Editor / Contributor:** Wajib mengakses login melalui Subdomain Workspace masing-masing (misal: `https://[workspace-slug].[your-domain.com]/login`).

Langkah login:
1. Buka URL Dashboard yang sesuai dengan peran Anda di atas.
2. Masukkan kredensial email dan password (atau login via Google/GitHub).
3. Setelah masuk, Admin akan diarahkan ke layar **Workspace / Tenant Selection** di domain utama, sedangkan Editor akan langsung masuk ke **Content Studio** di subdomain.

## 2. Content Builder (Membuat Struktur Tabel)
Untuk mulai menyimpan data, Anda harus membuat struktur (Schema) terlebih dahulu:
1. Buka menu **Content Builder** di sidebar kiri.
2. Klik **Create New Collection Type** (misal: `Articles`). Anda juga dapat menggunakan tombol **AI Schema Generate** untuk menghasilkan *field* secara otomatis hanya dengan memasukkan *prompt* singkat (misal: "Buat skema untuk artikel berita").
3. Tambahkan field-field yang dibutuhkan:
   - *Title* (Text, Required)
   - *Content* (RichText)
   - *Cover Image* (Media)
   - *Published Date* (Date)
   - *Template Surat* (Format Surat - konfigurasikan *placeholder* menggunakan *modal* yang tersedia saat mengatur tipe field ini)
4. Klik **Save**. Sistem akan secara otomatis membuatkan API Endpoint untuk tipe konten tersebut.

## 3. Content Manager (Mengisi Data)
1. Buka menu **Content Manager**.
2. Pilih tipe konten yang tadi dibuat (`Articles`).
3. Klik **Create New Entry**.
4. Isi data sesuai formulir. Anda juga dapat mengunggah gambar langsung dengan memilih field Media.
   - **Tip:** Pada *Rich Text Editor*, Anda dapat menekan tombol **AI Content Generate** untuk meminta bantuan AI menyusunkan paragraf tulisan.
5. Klik **Save as Draft**.
6. Gunakan tombol **Send to Review** atau **Publish** (jika Anda memiliki hak akses) untuk mempublikasikan konten tersebut ke API Publik.

## 4. Media Library
1. Buka menu **Media Library**.
2. Anda bisa *drag and drop* gambar, video, atau dokumen PDF.
3. Semua gambar yang diunggah akan secara otomatis di-compress dan dibuatkan versi *Thumbnail* dan *Medium* oleh sistem.
4. Anda dapat membuat *Folder* untuk merapikan aset.

## 5. Mengundang Anggota Tim (Team Management)
1. Pergi ke **Settings > Team**.
2. Klik **Invite Member**.
3. Masukkan email anggota dan pilih rolenya (Admin, Editor, atau Member).
4. Anggota akan menerima email undangan.
# Content Types Setup Documentation

## 📋 Overview

Dokumentasi ini menjelaskan cara setup dan menggunakan content types di SACMS.

## 🔧 Setup Content Type "Berita"

### Fields yang Ditambahkan

Content type "berita" sudah memiliki field-field berikut:

| Field | Slug | Type | Required | Description |
|--------|-------|-------|-----------|-------------|
| Judul | title | text | ✅ Yes | Judul berita (unique) |
| Ringkasan | description | textarea | ✅ Yes | Ringkasan singkat berita |
| Isi Konten | content | richText | ✅ Yes | Konten lengkap dengan rich text editor |
| Gambar Cover | cover | media | ❌ No | Gambar cover untuk berita |
| Penulis | author | text | ❌ No | Nama penulis berita |
| Kategori | category | select | ✅ Yes | Kategori berita (Berita, Pengumuman, Artikel, Press Release) |
| Tags | tags | text | ❌ No | Tags untuk berita |
| Status | status | select | ✅ Yes | Status berita (Draft, Published, Archived) |

### Cara Menambahkan Fields

Jika ingin menambahkan fields ke content type yang lain:

```bash
# Edit script dan ganti slug dan field definitions
npx tsx scripts/add-berita-fields.ts
```

### Cara Assign Content Type ke Tenant

```bash
npx tsx scripts/assign-berita-to-tenant.ts
```

## 🌐 URL Structure

### Content Types List
```
http://localhost:3000/dashboard/kominfo/content-types
```
Menampilkan semua content types yang di-assign ke tenant

### Entries List
```
http://localhost:3000/dashboard/kominfo/content-types/berita
```
Menampilkan semua entries untuk content type "berita"

### Create New Entry
```
http://localhost:3000/dashboard/kominfo/content-types/berita/new
```
Form untuk membuat entry baru dengan field-field:
- Judul (text input)
- Ringkasan (textarea)
- Isi Konten (rich text editor)
- Gambar Cover (media uploader)
- Penulis (text input)
- Kategori (dropdown select)
- Tags (text input)
- Status (dropdown select)

### Edit Entry
```
http://localhost:3000/dashboard/kominfo/content-types/berita/edit/[entryId]
```
Form untuk mengedit entry yang ada

## 🧪 Testing Steps

### Test 1: Buka Content Types List
1. Buka: `http://localhost:3000/dashboard/kominfo/content-types`
2. Login dengan user yang memiliki akses ke tenant "kominfo"
3. Anda harus melihat content type "Berita" di table

### Test 2: Buka Entries Berita
1. Dari content types list, klik ikon Database di row "Berita"
2. Harusnya redirect ke: `http://localhost:3000/dashboard/kominfo/content-types/berita`
3. Anda harus melihat:
   - Statistics cards (Total Entries, Published, Drafts)
   - Search box
   - Filter buttons (All, Published, Drafts)
   - Table dengan entries (jika ada)

### Test 3: Buat Entry Baru
1. Klik tombol "New Entry"
2. Harusnya redirect ke: `http://localhost:3000/dashboard/kominfo/content-types/berita/new`
3. Anda harus melihat form dengan field-field:
   - **Judul**: Text input (required)
   - **Ringkasan**: Textarea (required)
   - **Isi Konten**: Rich text editor (required)
   - **Gambar Cover**: Media uploader (optional)
   - **Penulis**: Text input (optional)
   - **Kategori**: Dropdown dengan pilihan (required)
   - **Tags**: Text input (optional)
   - **Status**: Dropdown dengan pilihan (required)

### Test 4: Simpan Entry
1. Isi semua field yang required
2. Klik tombol "Save Draft"
3. Entry harus tersimpan dan redirect kembali ke list
4. Klik tombol "Publish"
5. Entry harus tersimpan dengan status "Published"

### Test 5: Edit Entry
1. Dari entries list, klik ikon Edit (pencil) di row entry
2. Harusnya redirect ke: `http://localhost:3000/dashboard/kominfo/content-types/berita/edit/[id]`
3. Form harus terisi dengan data entry yang ada
4. Ubah beberapa field dan klik "Save Changes"
5. Data harus terupdate

## 🎨 Field Types yang Didukung

Berikut adalah field types yang didukung di SACMS:

| Type | Component | Description | Example |
|-------|-----------|-------------|----------|
| text | TextField | Input teks satu baris | Judul, Penulis |
| textarea | TextField | Input teks multi-baris | Ringkasan |
| richText | RichTextField | Rich text editor dengan formatting | Isi Konten |
| date | DateField | Date picker | Tanggal Publish |
| datetime | DateField | Date & time picker | Tanggal & Waktu |
| boolean | BooleanField | Checkbox/toggle switch | Published, Featured |
| select | SelectField | Dropdown dengan opsi | Kategori, Status |
| media | MediaField | File uploader untuk gambar/media | Cover Image |
| number | TextField | Input angka | Price, Quantity |
| email | TextField | Input email | Email Address |

## 📝 Field Definitions Format

Untuk menambahkan field baru, gunakan format ini:

```typescript
{
  name: 'Nama Field',        // Label yang ditampilkan di form
  slug: 'field_slug',       // Identifier unik (snake_case)
  type: 'text',             // Type field (lihat table di atas)
  required: true,           // Apakah field wajib diisi
  unique: false,             // Apakah nilai harus unik
  options: JSON.stringify([...])  // Opsi untuk type 'select'
  order: 1,                 // Urutan tampilan di form
}
```

## 🔌 API Endpoints

### Get Single Content Type
```
GET /api/tenant/[tenant]/content-types/[contentSlug]
```
Returns content type dengan field definitions

### Get Entries
```
GET /api/tenant/[tenant]/content/[contentSlug]
```
Returns semua entries untuk content type tertentu

### Create Entry
```
POST /api/tenant/[tenant]/content/[contentSlug]
Body: {
  data: { ...fieldValues },
  publish: boolean
}
```

### Update Entry
```
PUT /api/tenant/[tenant]/content/[contentSlug]/[entryId]
Body: {
  data: { ...fieldValues },
  publish: boolean
}
```

### Delete Entry
```
DELETE /api/tenant/[tenant]/content/[contentSlug]/[entryId]
```

## 🎯 Next Steps

1. **Buat Content Type Lain**: Gunakan script serupa untuk content types lain (pengumuman, agenda, dll)
2. **Custom Field Renderers**: Tambahkan field types kustom jika dibutuhkan
3. **Validasi Lanjutan**: Tambahkan validasi field yang lebih kompleks
4. **Media Library**: Implementasi media library untuk upload gambar
5. **Preview Entry**: Tambahkan preview entry sebelum publish

## 📚 Related Documentation

- [Midtrans Integration](./MIDTRANS_INTEGRATION.md)
- [Cron Jobs](../scripts/cron-jobs.md)
- Prisma Schema: `prisma/schema.prisma`
# Midtrans Payment Integration - Complete Guide

Complete guide for Midtrans payment integration in SACMS, including testing and production deployment.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Phase 1-5 Summary](#phase-1-5-summary)
4. [Phase 6: Testing](#phase-6-testing)
5. [Phase 6: Production Deployment](#phase-6-production-deployment)
6. [Troubleshooting](#troubleshooting)
7. [API Reference](#api-reference)

---

## Overview

SACMS integrates with Midtrans for payment processing, supporting multiple payment methods including:
- GoPay
- ShopeePay
- Bank Transfer (Virtual Accounts)
- QRIS
- Credit Cards
- E-Wallets

**Current Status**: ✅ Complete (Phases 1-5)

---

## Architecture

### System Components

```
┌─────────────────┐
│   Frontend     │
│  (Next.js)     │
└────────┬────────┘
         │
         ├─ Checkout Page ─────────────┐
         │                           │
         ├─ Payment Result Page       │
         │                           │
         └─ Subscription Dashboard    │
                                     │
┌────────────────────────────────────┴─────────────────────────────┐
│                     Backend API (Next.js API Routes)         │
├──────────────────────────────────────────────────────────────────┤
│  • /api/checkout              - Create payment session       │
│  • /api/payment/[id]/status   - Check payment status       │
│  • /api/midtrans/webhooks     - Handle notifications      │
│  • /api/tenant/[t]/subscription/* - Manage subscriptions    │
│  • /api/admin/billing/*       - Admin operations         │
└────────────────────────────────────┬───────────────────────────┘
                                     │
                                     ├─ Midtrans Client
                                     │
┌────────────────────────────────────┴─────────────────────────────┐
│                     Database (PostgreSQL)                     │
│  • User, Tenant, Subscription, Invoice                      │
│  • PaymentTransaction                                     │
└───────────────────────────────────────────────────────────────┘
```

### Payment Flow

```
1. User clicks "Upgrade"
   ↓
2. Frontend → POST /api/checkout
   ↓
3. Backend → Midtrans Snap API
   ↓
4. Midtrans returns snap token
   ↓
5. Frontend opens Midtrans Snap popup
   ↓
6. User completes payment
   ↓
7. Midtrans → Webhook (POST /api/midtrans/webhooks)
   ↓
8. Backend creates invoice & updates subscription
   ↓
9. Frontend redirects to payment result page
   ↓
10. Poll /api/payment/[id]/status until final status
```

---

## Phase 1-5 Summary

### ✅ Phase 1: Setup & Configuration
- Added `PaymentTransaction` model to Prisma schema
- Ran database migration
- Configured Midtrans environment variables
- Installed `midtrans-client` package

### ✅ Phase 2: Core Midtrans Integration
- Created Midtrans service library (`src/lib/midtrans.ts`)
- Implemented checkout API (`/api/checkout`)
- Implemented webhook handler (`/api/midtrans/webhooks`)
- Implemented payment status API (`/api/payment/[orderId]/status`)

### ✅ Phase 3: Frontend Integration
- Created checkout page with Midtrans Snap.js
- Created payment result page with auto-polling
- Updated subscription dashboard
- Added invoices API endpoint

### ✅ Phase 4: Subscription Management
- Plan upgrade/downgrade API (`/api/tenant/[t]/subscription/plan`)
- Cancel subscription API (`/api/tenant/[t]/subscription/cancel`)
- Proration calculation function
- Proration API endpoint

### ✅ Phase 5: Admin & Automation
- Billing stats API (`/api/admin/billing/stats`)
- Invoice generation API (`/api/admin/billing/generate-invoices`)
- Cron job setup with Vercel configuration
- Comprehensive documentation

---

## Phase 6: Testing

### Prerequisites

Before testing, ensure you have:

1. **Midtrans Sandbox Account**
   - Register at https://dashboard.midtrans.com/
   - Enable sandbox mode
   - Get your sandbox credentials

2. **Environment Variables Configured**
   ```env
   MIDTRANS_SERVER_KEY="SB-Mid-server-YOUR_KEY"
   MIDTRANS_CLIENT_KEY="SB-Mid-client-YOUR_KEY"
   MIDTRANS_MODE="sandbox"
   ```

3. **Database Migrations Applied**
   ```bash
   npx prisma migrate deploy
   ```

4. **Development Server Running**
   ```bash
   npm run dev
   ```

### Test Scenarios

#### 1. **Successful Payment Flow**

**Steps:**
1. Navigate to `/dashboard/[tenant]/subscriptions`
2. Click "Upgrade to Pro Plan"
3. Review plan details
4. Click "Upgrade to Pro"
5. Midtrans Snap popup opens
6. Select payment method (e.g., "GoPay")
7. Complete payment
8. Verify redirect to success page
9. Check subscription updated
10. Check invoice created

**Expected Results:**
- ✅ Payment popup opens successfully
- ✅ Payment completes without errors
- ✅ User redirected to success page
- ✅ Subscription status: "active"
- ✅ Subscription plan: "pro"
- ✅ Invoice created with status: "paid"
- ✅ Payment transaction recorded

**Verification Queries:**
```sql
-- Check subscription
SELECT * FROM subscription WHERE tenant_id = 'YOUR_TENANT_ID' ORDER BY created_at DESC LIMIT 1;

-- Check invoice
SELECT * FROM invoice WHERE subscription_id = 'YOUR_SUBSCRIPTION_ID';

-- Check payment transaction
SELECT * FROM payment_transaction WHERE order_id = 'YOUR_ORDER_ID';
```

#### 2. **Failed Payment Flow**

**Steps:**
1. Start checkout process
2. Select payment method
3. Cancel payment in Midtrans popup
4. Verify redirect to failure page
5. Check no subscription changes

**Expected Results:**
- ✅ Redirect to failure page
- ✅ Error message displayed
- ✅ Subscription unchanged
- ✅ No invoice created
- ✅ Payment transaction status: "failed"

#### 3. **Pending Payment Flow**

**Steps:**
1. Start checkout process
2. Select Bank Transfer (VA)
3. Get VA number
4. Close popup without paying
5. Check payment status page

**Expected Results:**
- ✅ Payment status: "pending"
- ✅ Auto-refresh every 3 seconds
- ✅ VA number displayed
- ✅ Instructions for manual payment shown

#### 4. **Proration Calculation**

**Scenario:** Mid-period upgrade from Starter to Pro

**Setup:**
```bash
# Create a Starter subscription (if not exists)
curl -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "starter",
    "tenantId": "YOUR_TENANT_ID"
  }'
```

**Test:**
```bash
# Calculate proration
curl -X POST http://localhost:3000/api/tenant/YOUR_TENANT/subscription/prorate \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION" \
  -d '{
    "newPlan": "pro"
  }'
```

**Expected Response:**
```json
{
  "currentPlan": "starter",
  "newPlan": "pro",
  "canUpgrade": true,
  "fullPrice": 29000,
  "proratedPrice": 14500,
  "daysRemaining": 15,
  "totalDays": 30,
  "percentageUsed": 50,
  "credit": 4500,
  "amountDue": 10000,
  "message": "You'll only pay Rp 10.000 (credit applied: Rp 4.500)"
}
```

#### 5. **Subscription Downgrade**

**Test:**
```bash
curl -X PATCH http://localhost:3000/api/tenant/YOUR_TENANT/subscription/plan \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION" \
  -d '{
    "planId": "free"
  }'
```

**Expected Results:**
- ✅ Downgrade successful
- ✅ Effective immediately
- ✅ No payment required
- ✅ Tenant plan updated to "free"

#### 6. **Subscription Cancel (At Period End)**

**Test:**
```bash
curl -X POST http://localhost:3000/api/tenant/YOUR_TENANT/subscription/cancel \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION" \
  -d '{
    "cancelAtPeriodEnd": true
  }'
```

**Expected Results:**
- ✅ `cancelAtPeriodEnd` set to true
- ✅ Subscription remains active until period end
- ✅ Will auto-downgrade to free after period

#### 7. **Subscription Cancel (Immediately)**

**Test:**
```bash
curl -X POST http://localhost:3000/api/tenant/YOUR_TENANT/subscription/cancel \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION" \
  -d '{
    "cancelAtPeriodEnd": false
  }'
```

**Expected Results:**
- ✅ Status set to "canceled"
- ✅ Plan downgraded to "free"
- ✅ Effective immediately
- ✅ Tenant plan updated

#### 8. **Webhook Handling**

**Test using Midtrans Dashboard:**
1. Go to Midtrans Sandbox Dashboard
2. Navigate to "Settings" → "Webhooks"
3. Test webhook notifications
4. Verify webhook logs in your application

**Expected Results:**
- ✅ Webhook signature verified
- ✅ Transaction created/updated
- ✅ Invoice status updated
- ✅ Subscription status updated

#### 9. **Invoice Generation (Cron Job)**

**Test:**
```bash
curl -X POST http://localhost:3000/api/admin/billing/generate-invoices \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Expected Results:**
- ✅ Processes all due subscriptions
- ✅ Creates pending invoices
- ✅ Updates billing periods
- ✅ Skips free plans
- ✅ Returns processing statistics

**Preview Mode:**
```bash
# As super admin, visit:
http://localhost:3000/api/admin/billing/generate-invoices
```

#### 10. **Billing Stats**

**Test:**
```bash
curl http://localhost:3000/api/admin/billing/stats \
  -H "Cookie: next-auth.session-token=YOUR_ADMIN_SESSION"
```

**Expected Response:**
```json
{
  "overview": {
    "totalRevenue": 58000,
    "mrr": 29000,
    "arr": 348000,
    "monthlyRevenue": 29000,
    "arpu": 14500
  },
  "subscriptions": {
    "total": 2,
    "active": 2,
    "newThisMonth": 1,
    "churnRate": 0,
    "byPlan": {
      "free": { "active": 0, "total": 0 },
      "starter": { "active": 1, "total": 1 },
      "pro": { "active": 1, "total": 1 },
      "enterprise": { "active": 0, "total": 0 }
    }
  },
  "payments": {
    "successRate": 100
  }
}
```

### Test Payment Methods

#### **GoPay**
1. Select "GoPay" in Snap popup
2. Login to GoPay (sandbox)
3. Approve payment
4. Verify payment completes

#### **Bank Transfer (BCA VA)**
1. Select "Bank Transfer BCA"
2. Get VA number
3. Transfer from BCA (sandbox account)
4. Verify payment pending → success

#### **QRIS**
1. Select "QRIS"
2. Scan QR code
3. Pay from e-wallet (sandbox)
4. Verify payment completes

#### **Credit Card**
1. Select "Credit Card"
2. Enter test card details
3. Complete 3D Secure
4. Verify payment completes

**Test Card Numbers (Sandbox):**
- Success: `4000 0000 0000 0002` (any expiry, any CVV)
- Failure: `4000 0000 0000 0003`

### Test Checklist

Use this checklist to verify all functionality:

- [ ] **Checkout Flow**
  - [ ] Upgrade from Free to Starter
  - [ ] Upgrade from Starter to Pro
  - [ ] Upgrade from Pro to Enterprise
  - [ ] Downgrade any plan
  - [ ] Cancel at period end
  - [ ] Cancel immediately

- [ ] **Payment Methods**
  - [ ] GoPay payment
  - [ ] ShopeePay payment
  - [ ] Bank Transfer (BCA)
  - [ ] Bank Transfer (Mandiri)
  - [ ] QRIS payment
  - [ ] Credit Card payment
  - [ ] Payment cancellation
  - [ ] Pending payment status

- [ ] **Proration**
  - [ ] Early upgrade calculation
  - [ ] Mid-period upgrade calculation
  - [ ] Late upgrade calculation
  - [ ] No credit scenario
  - [ ] Full credit scenario

- [ ] **Webhooks**
  - [ ] Payment success notification
  - [ ] Payment failure notification
  - [ ] Payment pending notification
  - [ ] Signature verification
  - [ ] Duplicate notification handling

- [ ] **Invoices**
  - [ ] Invoice creation
  - [ ] Invoice status updates
  - [ ] Invoice history display
  - [ ] Invoice details

- [ ] **Admin**
  - [ ] Billing stats calculation
  - [ ] Revenue metrics
  - [ ] Subscription metrics
  - [ ] Payment success rate
  - [ ] Churn rate calculation

- [ ] **Cron Jobs**
  - [ ] Manual invoice generation
  - [ ] Preview invoices
  - [ ] Process due subscriptions
  - [ ] Skip free plans
  - [ ] Skip cancelled plans

---

## Phase 6: Production Deployment

### Pre-Deployment Checklist

- [ ] All test scenarios pass
- [ ] Payment methods tested in sandbox
- [ ] Webhook handling verified
- [ ] Cron jobs tested
- [ ] Error handling reviewed
- [ ] Logging configured
- [ ] Monitoring setup

### 1. **Get Production Midtrans Credentials**

1. Login to Midtrans Dashboard
2. Switch from Sandbox to Production
3. Go to "Settings" → "Configuration"
4. Copy your production keys:
   - **Server Key** (starts with `Mid-server-`)
   - **Client Key** (starts with `Mid-client-`)

### 2. **Update Environment Variables**

Update your production environment:

```env
# Midtrans Production Configuration
MIDTRANS_SERVER_KEY="Mid-server-YOUR_PRODUCTION_KEY"
MIDTRANS_CLIENT_KEY="Mid-client-YOUR_PRODUCTION_KEY"
MIDTRANS_MODE="production"
MIDTRANS_PAYMENT_URL="https://app.midtrans.com/snap/snap.js"

# Public Configuration
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY="Mid-client-YOUR_PRODUCTION_KEY"
NEXT_PUBLIC_MIDTRANS_SNAP_URL="https://app.midtrans.com/snap/snap.js"

# Cron Secret
CRON_SECRET="generate-a-secure-random-string"
```

**Generate Secure CRON_SECRET:**
```bash
openssl rand -base64 32
```

### 3. **Configure Webhook URL**

1. Go to Midtrans Dashboard → "Settings" → "Webhooks"
2. Add webhook URL:
   ```
   https://your-domain.com/api/midtrans/webhooks
   ```
3. Select notification types:
   - [x] Transaction status
   - [x] Payment
   - [x] Fraud
4. Save configuration

### 4. **Deploy to Production**

#### **Vercel Deployment:**

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

**Environment Variables in Vercel:**
1. Go to Vercel Dashboard
2. Navigate to your project
3. Settings → Environment Variables
4. Add all production variables
5. Redeploy

#### **Docker Deployment:**

1. Build Docker image:
```bash
docker build -t sacms .
```

2. Run container:
```bash
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL="..." \
  -e MIDTRANS_SERVER_KEY="..." \
  -e MIDTRANS_CLIENT_KEY="..." \
  -e MIDTRANS_MODE="production" \
  sacms
```

#### **Traditional VPS:**

```bash
# Install dependencies
npm install

# Build application
npm run build

# Start production server
npm start

# Or use PM2
pm2 start npm --name "sacms" -- start
```

### 5. **Database Migrations**

```bash
# Run migrations
npx prisma migrate deploy

# Or generate SQL
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
```

### 6. **Configure Cron Jobs**

#### **Vercel (Recommended):**
- `vercel.json` is already configured
- Cron jobs will be set up automatically on deployment

#### **Linux Cron:**
```bash
# Edit crontab
crontab -e

# Add daily job
0 0 * * * curl -X POST https://your-domain.com/api/admin/billing/generate-invoices -H "Authorization: Bearer YOUR_CRON_SECRET"
```

#### **GitHub Actions:**
- Push `.github/workflows/billing-cron.yml`
- Add `CRON_SECRET` to GitHub secrets

### 7. **Verify Production Setup**

#### **Test Payment Flow:**
1. Navigate to your production site
2. Complete a test payment (small amount)
3. Verify payment processing
4. Check webhook logs

#### **Test Webhook:**
1. Go to Midtrans Dashboard
2. Test webhook notification
3. Verify webhook received
4. Check application logs

#### **Test Cron Job:**
1. Manually trigger cron job:
```bash
curl -X POST https://your-domain.com/api/admin/billing/generate-invoices \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```
2. Verify response
3. Check generated invoices

#### **Check Midtrans Dashboard:**
1. Go to Midtrans Dashboard
2. Verify transactions appear
3. Check webhook delivery status
4. Review error logs

### 8. **Set Up Monitoring**

#### **Error Tracking (Sentry):**
```bash
npm install @sentry/nextjs
npx @sentry/wizard -i nextjs
```

#### **Logging:**
- Configure application logging
- Set up log aggregation
- Monitor error rates

#### **Alerts:**
- Configure email alerts for failed payments
- Set up Slack/Discord webhooks
- Monitor cron job failures

### 9. **Security Hardening**

#### **Environment Variables:**
- [ ] Never commit `.env` files
- [ ] Use different secrets per environment
- [ ] Rotate secrets periodically
- [ ] Use secret management services

#### **API Security:**
- [ ] Rate limiting enabled
- [ ] CORS configured properly
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (Prisma handles this)

#### **Webhook Security:**
- [ ] Signature verification enabled
- [ ] HTTPS enforced
- [ ] IP whitelisting (optional)

### 10. **Performance Optimization**

#### **Database Indexing:**
```sql
-- Add indexes for frequently queried fields
CREATE INDEX idx_subscription_status ON subscription(status);
CREATE INDEX idx_invoice_status ON invoice(status);
CREATE INDEX idx_payment_order_id ON payment_transaction(order_id);
```

#### **Caching:**
- Cache plan prices
- Cache subscription status
- Cache billing stats (with TTL)

#### **CDN:**
- Serve static assets via CDN
- Enable gzip compression

---

## Troubleshooting

### Common Issues

#### **Payment Not Processing**

**Symptoms:**
- Midtrans popup doesn't open
- Payment fails immediately
- Webhook not received

**Solutions:**
1. Check Midtrans credentials
2. Verify `MIDTRANS_MODE` is correct
3. Check browser console for errors
4. Verify webhook URL is accessible
5. Check Midtrans dashboard for errors

#### **Webhook Not Received**

**Symptoms:**
- Payment succeeds but subscription not updated
- Invoice not created

**Solutions:**
1. Verify webhook URL is correct
2. Check Midtrans dashboard webhook logs
3. Ensure webhook is reachable from internet
4. Verify signature verification code
5. Check server logs for webhook errors

#### **Proration Incorrect**

**Symptoms:**
- Wrong amount calculated
- Credit not applied

**Solutions:**
1. Verify `PLAN_PRICES` configuration
2. Check `currentPeriodStart` and `currentPeriodEnd`
3. Review calculation logic
4. Test with different scenarios

#### **Cron Job Failing**

**Symptoms:**
- Invoices not generated
- Subscription periods not updated

**Solutions:**
1. Verify `CRON_SECRET` is set
2. Check cron job logs
3. Test endpoint manually
4. Verify database connection
5. Check server resources

#### **Subscription Not Updated**

**Symptoms:**
- Payment successful but subscription unchanged
- Wrong plan selected

**Solutions:**
1. Check webhook handler code
2. Verify database updates
3. Check transaction status
4. Review error logs
5. Test webhook manually

### Debug Mode

Enable debug logging:

```typescript
// In API routes
console.log('[DEBUG]', { timestamp: new Date(), ... })

// In webhook handler
console.log('[WEBHOOK]', { received: true, data })
```

### Log Files

Check these logs:

**Vercel:**
```bash
vercel logs --follow
```

**Docker:**
```bash
docker logs sacms
```

**PM2:**
```bash
pm2 logs sacms
```

**System:**
```bash
tail -f /var/log/syslog
tail -f /var/log/nginx/access.log
```

---

## API Reference

### Public Endpoints

#### Create Checkout
```
POST /api/checkout
```

**Request:**
```json
{
  "planId": "pro",
  "tenantId": "tenant-slug"
}
```

**Response:**
```json
{
  "token": "snap_token_...",
  "orderId": "ORDER-123",
  "redirectUrl": "https://..."
}
```

#### Get Payment Status
```
GET /api/payment/[orderId]/status
```

**Response:**
```json
{
  "orderId": "ORDER-123",
  "status": "success",
  "amount": 29000,
  "paymentType": "gopay",
  "transactionId": "TRANS-123"
}
```

### Tenant Endpoints

#### Get Invoices
```
GET /api/tenant/[tenant]/invoices
```

**Response:**
```json
{
  "invoices": [
    {
      "id": "inv-123",
      "amount": 29000,
      "status": "paid",
      "paidAt": "2026-03-12T..."
    }
  ]
}
```

#### Update Plan
```
PATCH /api/tenant/[tenant]/subscription/plan
```

**Request:**
```json
{
  "planId": "pro"
}
```

#### Cancel Subscription
```
POST /api/tenant/[tenant]/subscription/cancel
```

**Request:**
```json
{
  "cancelAtPeriodEnd": true
}
```

#### Calculate Proration
```
POST /api/tenant/[tenant]/subscription/prorate
```

**Request:**
```json
{
  "newPlan": "pro"
}
```

### Admin Endpoints

#### Get Billing Stats
```
GET /api/admin/billing/stats
```

**Response:**
```json
{
  "overview": {
    "totalRevenue": 58000,
    "mrr": 29000,
    "arr": 348000
  },
  "subscriptions": {
    "total": 2,
    "active": 2
  }
}
```

#### Generate Invoices (Cron)
```
POST /api/admin/billing/generate-invoices
```

**Headers:**
```
Authorization: Bearer CRON_SECRET
```

---

## Support

For issues or questions:
1. Check this documentation
2. Review Midtrans documentation: https://docs.midtrans.com/
3. Check server logs
4. Contact development team

---

**Last Updated**: 2026-03-13
**Version**: 1.0
**Status**: Production Ready ✅
