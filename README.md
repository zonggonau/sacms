# 🚀 SACMS: Multi-Tenant Startup & Content Management System

SACMS is a high-performance, production-ready multi-tenant headless CMS designed for startup ecosystems. It provides a robust foundation for managing isolated tenant workspaces, dynamic content modeling, and integrated subscription billing.

## ✨ Core Features

### 🏢 Multi-Tenant Architecture
- **Isolated Workspaces**: Each tenant has their own secure dashboard and data isolation.
- **Tenant Management**: Super Admin controls tenant lifecycle, roles, and assignments.
- **White-labeling**: Custom branding, colors, and dashboard personalization for each tenant.

### 🏗️ Dynamic Content Modeling (Headless CMS)
- **Content Types**: Define custom collections (e.g., Blog, Products) with flexible fields.
- **Single Types**: Perfect for static pages like "About Us" or "Landing Page".
- **Global Schemas**: Super Admin can create "Startup Schemas" that are automatically available across all tenants.
- **Component System**: Reusable nested field structures (Components) for complex data layouts.
- **Rich Field Types**: Text, Rich Text, Media, Relations, Select, Boolean, Date, and more.

### 💳 Subscription & Billing (Midtrans Integrated)
- **Flexible Plans**: Main workspace plans (Starter, Pro, Business) managed globally.
- **Add-on System**: Individual feature upgrades like "Daily Backup" or "Additional Storage".
- **Midtrans Integration**: Seamless payment flow with Snap (QRIS, E-wallet, Virtual Accounts).
- **Billing History**: Automated invoice generation and payment tracking for every tenant.

### 🔐 Enterprise-Grade Security & Monitoring
- **RBAC**: Role-Based Access Control (Owner, Admin, Editor, Viewer).
- **NextAuth.js**: Secure authentication flows.
- **Sentry**: Full-stack error tracking and performance monitoring.
- **Audit Logs**: Track critical actions across the platform.

## 🛠️ Technology Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Database**: PostgreSQL
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/)
- **Payment**: [Midtrans](https://midtrans.com/)
- **Auth**: [NextAuth.js](https://next-auth.js.org/)
- **Monitoring**: [Sentry](https://sentry.io/)

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v20+)
- [Bun](https://bun.sh/) (Recommended)
- PostgreSQL database

### 2. Environment Setup
Copy `.env.example` to `.env` and fill in the required variables:
```bash
# Database
DATABASE_URL="postgresql://..."

# NextAuth
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"

# Midtrans (Sandbox/Production)
MIDTRANS_SERVER_KEY="SB-Mid-server-..."
MIDTRANS_CLIENT_KEY="SB-Mid-client-..."
MIDTRANS_MODE="sandbox"
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY="SB-Mid-client-..."

# Sentry
NEXT_PUBLIC_SENTRY_DSN="..."
```

### 3. Installation & Database
```bash
bun install
bun prisma generate
bun prisma migrate dev
```

### 4. Initial Seeding
Run the following scripts to set up the base ecosystem:
```bash
# Setup base content types
bun run scripts/setup-startup-management-models.ts

# Seed initial pricing and plans
bun run scripts/reseed-pricing.ts

# Assign permissions
bun run scripts/seed-permissions.ts
```

### 5. Run Development
```bash
bun run dev
```

## 📂 Project Structure

- `src/app/admin`: Super Admin global management dashboard.
- `src/app/dashboard/[tenant]`: Isolated tenant workspace dashboard.
- `src/components/cms`: Core CMS engine components (Field renderers, Schema builders).
- `src/lib/payment`: Payment provider abstraction (Midtrans implementation).
- `scripts/`: Utility scripts for maintenance, seeding, and debugging.

## 🤝 Contributing

This project is optimized for AI-assisted development. Use the built-in scripts and structured patterns to extend functionality.

---

Built with ❤️ for the startup community. Powered by SACMS.
