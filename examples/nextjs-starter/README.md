# Next.js 15 Starter Kit for SaCMS

A ready-to-use Next.js 15/16 App Router boilerplate connected to SaCMS via `@sacms/sdk`.

---

## 🚀 Getting Started

1. **Clone or navigate to this folder:**
   ```bash
   cd examples/nextjs-starter
   ```

2. **Configure Environment Variables:**
   Create `.env.local`:
   ```env
   SACMS_BASE_URL="http://localhost:3000"
   SACMS_TENANT="demo"
   SACMS_API_TOKEN="cf_live_your_token_here"
   SACMS_DEFAULT_LOCALE="id"
   ```

3. **Install Dependencies:**
   ```bash
   npm install
   ```

4. **Run Development Server:**
   ```bash
   npm run dev
   ```

5. **Generate TypeScript Types (Optional):**
   ```bash
   npx @sacms/sdk generate --url http://localhost:3000 --tenant demo --token cf_live_your_token_here --out src/types/sacms.d.ts
   ```
