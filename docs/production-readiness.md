# SaCMS — Production Readiness Audit

> Generated: 2026-06-21
> Updated: 2026-06-21 07:23 WIB

## ✅ Sudah Dikerjakan

| # | Item | Status | Detail |
|---|---|---|---|
| ✅ | SMTP Config | Done | Gmail (bangparjoshop@gmail.com) |
| ✅ | Content Types Draft → Live | Done | 15 content types published |
| ✅ | Seed script `isPublished: true` | Fixed | content types auto-publish |
| ✅ | `NEXTAUTH_SECRET` — random 32-byte | Done | `openssl rand` |
| ✅ | `CRON_SECRET` — random 32-byte | Done | beda dari NEXTAUTH |
| ✅ | `NODE_ENV="production"` | Done | verifikasi via healthcheck |
| ✅ | Healthcheck endpoint `/api/health` | Added | cek DB + memory + uptime |
| ✅ | `.env.example` | Created | includes enterprise section |
| ✅ | systemd unit `sacms.service` | Active & enabled | auto-restart |
| ✅ | Landing page data mapping | Fixed | extract `entry.data` |
| ✅ | SMTP/Sentry placeholders in .env | Added | butuh config by user |
| ✅ | Enterprise License Model | Added | `EnterpriseLicense` + `LicenseCache` |
| ✅ | RSA Keypair (2048-bit) | Generated | `keys/license-{private,public}.pem` |
| ✅ | License Generation API | Added | `POST /api/admin/license/generate` |
| ✅ | License List API | Added | `GET /api/admin/license/list` |
| ✅ | License Validation API | Added | `POST /api/enterprise/validate` |
| ✅ | License Client Module | Added | `src/lib/license.ts` — sign, verify, cache |
| ✅ | Enterprise Mode — Plan Bypass | Added | `plan-enforcement.ts` |
| ✅ | Admin UI — License Management | Added | `/admin/enterprise/licenses` |
| ✅ | `.env.example` license entries | Added | LICENSE_KEY, LICENSE_SERVER_URL |
| ✅ | `keys/` → `.gitignore` | Added | jangan commit private key |
> Branch: `master` | Version: `1.2.0`

---

## 1. Build & Compilation

| Item | Status | Detail |
|---|---|---|
| Next.js build | ✅ OK | 156 routes, 71 detik |
| ESLint | ✅ OK | 0 errors |
| TypeScript | ❌ **136 errors** | Lihat breakdown di bawah |
| TypeScript `strict: true` | ✅ | Tapi `noImplicitAny: false` |

### 🔴 TypeScript Errors Breakdown (136 total)

| File | Errors | Masalah |
|---|---|---|
| `src/components/dashboard/admin-sidebar.tsx` | 13 | `'entry' is possibly 'null'`, type mismatch |
| `src/components/dashboard/sidebar.tsx` | 11 | `'entry' is possibly 'null'`, type mismatch |
| `src/lib/webhooks.ts` | 9 | `JsonValue` → `BinaryLike`, `BodyInit` |
| `src/app/api/billing/payment/[orderId]/status/route.ts` | 6 | Type mismatch |
| `src/components/ui/resizable.tsx` | 5 | Missing props |
| `src/components/ui/chart.tsx` | 5 | Type mismatch |
| `src/actions/components.ts` | 3 | `tenantId` not found |
| `src/lib/graphql-schema.ts` | 3 | Type mismatch |
| Others (25+ files) | 1-3 each | Mostly `null` checks, JsonValue, missing props |

Pola dominan:
- `'entry' is possibly 'null'` — strict null check catching missing guards (~40 errors)
- `JsonValue` / `InputJsonValue` type incompatibility (~20 errors)
- Generic type mismatch / missing properties (~76 errors)

**Severity:** Build skip typecheck, jadi runtime bakal error kalo kode yg bermasalahdieksekusi.

---

## 2. Environment & Security

### 🔴 NEXTAUTH_SECRET

```
NEXTAUTH_SECRET="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.KMUFsIDTnFmyG3nMiGM6H9FNFUROf3wh7SmqJp-QV30"
```

⚠️ **Ini demo JWT token** — decode-nya:
```json
{ "sub": "1234567890", "name": "John Doe", "admin": true, "iat": 1516239022 }
```

Siapa pun bisa decode, dan kalo secret-nya bocor, session user bisa dipalsukan.

**Fix:** `openssl rand -base64 32`

### 🔴 NODE_ENV

```
NODE_ENV="development"
```

Next.js jalan di mode dev — performa lebih lambat, error detail ke user, caching minimal.

**Fix:** `NODE_ENV="production"`

### 🔴 API Keys di .env (belum dirotasi)

- `GEMINI_API_KEY` — visible
- `DEEPSEEK_API_KEY` — visible  
- `MIDTRANS_SERVER_KEY` — visible (sandbox)
- `CRON_SECRET` — same as NEXTAUTH_SECRET (JWT token)
- `NEXT_PUBLIC_SYSTEM_API_KEY` — visible

### ⚠️ SMTP / Email

Mail library ada (`src/lib/mail.ts`) tapi **SMTP_HOST & SMTP_PORT tidak dikonfigurasi di .env**.
Fitur:
- Verifikasi email (`sendVerificationEmail`)
- Forgot password / reset password
→ **Semua fitur email bakal gagal runtime.**

### ⚠️ Sentry (Error Tracking)

```
Sentry.init({ enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN })
```
DSN tidak di-set — monitoring error mati.

### ⚠️ OAuth Providers

Auth support Google & GitHub provider, tapi tidak ada `GOOGLE_CLIENT_ID` / `GITHUB_CLIENT_ID` di .env.

---

## 3. Payment & Billing

| Item | Status | Detail |
|---|---|---|
| Midtrans integration | ✅ Ada | Core + webhook |
| Midtrans mode | ⚠️ **Sandbox** | Belum production |
| Midtrans webhook handler | ✅ Ada | `/api/billing/midtrans/webhooks` |
| Invoice generation | ✅ Ada | `/api/admin/billing/generate-invoices` |
| Plans & pricing | ✅ Ada | Workspace + Account plans |
| Checkout flow | ✅ Ada | `/dashboard/billing/checkout` |

---

## 4. Infrastructure

| Item | Status | Detail |
|---|---|---|
| Docker | ✅ Ada | `Dockerfile` + `docker-compose.yml` |
| Caddy (reverse proxy) | ✅ Ada | `Caddyfile` |
| SSL/TLS | ✅ | Auto via Caddy |
| systemd unit | ❌ **Tidak ada** | Server mati → no auto-restart |
| Process manager | ❌ **Tidak ada** | No pm2, no systemd |
| Auto-restart | ❌ **Tidak ada** | Manual start |
| Firewall | ❌ **Tidak terpasang** | `ufw` not found |
| Database backup | ✅ Route ada | `/api/cron/backup` — butuh cron trigger |
| Backup cron job | ❌ **Belum dijadwalkan** | Route exist, no crontab entry |

---

## 5. Monitoring & Observability

| Item | Status | Detail |
|---|---|---|
| Sentry | ⚠️ Setup tapi disabled | No DSN configured |
| Audit logs | ✅ Ada | `/api/admin/audit-logs` |
| Request monitoring | ✅ Ada | `/api/admin/monitoring/requests` |
| System metrics | ✅ Ada | `/api/admin/monitoring/metrics` |
| Alerting | ❌ **Tidak ada** | No notification on crash/error |
| Healthcheck endpoint | ❌ **Tidak ada** | No `/api/health` |
| Uptime monitoring | ❌ **Tidak ada** | External (uptimerobot, etc.) |

---

## 6. Testing

| Item | Status | Detail |
|---|---|---|
| Unit tests | ❌ | `__tests__/lib/webhooks.test.ts` exists only |
| Integration tests | ❌ | None found |
| E2E tests | ❌ | Playwright config exists tapi ga ada test |
| Test coverage | ❌ | Not configured |

---

## 7. Code Quality & Edge Cases

| Item | Detail |
|---|---|
| Error boundaries | ✅ `error.tsx` + `global-error.tsx.bak` |
| Loading states | ⚠️ Perlu dicek per route |
| Not-found pages | ⚠️ Perlu dicek |
| API error handling | ⚠️ Banyak route tanpa try-catch |
| Rate limiting | ❌ Tidak ada |
| Input validation | ⚠️ Parsial (via Zod?) |
| CORS | ⚠️ Perlu dicek |

---

## 📋 Master Action List

### 🔴 PRIORITAS TINGGI (Crash / Security)

| # | Task | File / Area | Status |
|---|---|---|---|
| 1 | Fix TypeScript errors (136 errors) | Seluruh project | ❌ |
| 2 | Generate proper `NEXTAUTH_SECRET` | `.env` | ✅ |
| 3 | Set `NODE_ENV="production"` | `.env` | ✅ |
| 4 | Rotate exposed API keys | All keys in .env | ⏳ (masih API key lama) |
| 5 | Add SMTP config for email | `.env` | ⏳ (placeholder, isi SMTP_HOST etc.) |

### 🟡 PRIORITAS SEDANG (Go-Live)

| # | Task | File / Area | Status |
|---|---|---|---|
| 6 | Create systemd unit | `/etc/systemd/system/sacms.service` | ✅ |
| 7 | Setup ufw firewall | Server | ❌ |
| 8 | Configure Sentry DSN | `.env` | ⏳ |
| 9 | Switch Midtrans to production | `.env` | ⏳ (butuh production keys) |
| 10 | Create healthcheck endpoint | `src/app/api/health/route.ts` | ✅ |
| 11 | Schedule backup cron job | Crontab | ❌ |
| 12 | Add `.env.example` | Root | ✅ |
| 13 | Setup firewall + fail2ban | Server | ❌ |

### 🟢 PRIORITAS RENDAH (Nice to Have)

| # | Task | Area |
|---|---|---|
| 13 | Add loading states | Pages |
| 14 | Add not-found pages | Routes |
| 15 | Add rate limiting | API |
| 16 | Write tests | Testing |
| 17 | Docker compose production tune | Docker |
| 18 | Add OAuth providers (Google/GitHub) | `.env` |

---

*Dokumen ini auto-generated. Update saat ada perubahan.*


## ✅ Phase 2 — UI + Docker Enterprise

| Item | Status | File |
|---|---|---|
| License Status API | ✅ | `GET /api/enterprise/status` |
| License Activation API | ✅ | `POST /api/enterprise/activate` |
| Customer License Page | ✅ | `/dashboard/[tenant]/settings/license` |
| Admin License Page | ✅ | `/admin/enterprise/licenses` |
| Docker Enterprise Compose | ✅ | `docker-compose.enterprise.yml` |
| `.env.enterprise.example` | ✅ | For customer deployment |
| Installation Guide | ✅ | `docs/enterprise/README.md` |
| License renewal flow | ✅ | Via contact + env update |
