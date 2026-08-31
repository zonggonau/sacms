# 🚀 Panduan Deploy SaCMS & MCP Server di Contabo VPS

Panduan ini menjelaskan cara menjalankan **SaCMS Appliance** lengkap dengan **Dedicated MCP Server Gateway**, PostgreSQL 17, Redis, dan Caddy (Auto SSL) di VPS Contabo (Ubuntu/Debian).

---

## 📋 Keunggulan Hosting di Contabo VPS dibanding Vercel

| Fitur | Vercel Serverless | Contabo VPS Dedicated |
| :--- | :--- | :--- |
| **Batas Waktu Eksekusi** | ⚠️ 15–300 detik per request | 🚀 **Tanpa Batas** (Cocok untuk Batch AI Seeding) |
| **Stdio Bridge Local CLI** | ❌ Tidak didukung | ✅ **Didukung** (`npx sacms-mcp`) |
| **Koneksi Database** | Pooler connection (Supabase/Neon) | ✅ **Direct Dedicated PostgreSQL 17** |
| **Streaming SSE MCP** | Serverless streaming chunked | ⚡ **Unbuffered Native SSE Streaming** |

---

## 🛠️ Langkah-Langkah Instalasi di Contabo VPS

### 1. Persiapan VPS
```bash
# Update sistem
sudo apt update && sudo apt upgrade -y

# Install Docker & Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### 2. Clone & Setup Environment
```bash
# Clone repository
git clone https://github.com/your-username/sacms.git /opt/sacms
cd /opt/sacms/docker/mcp-contabo

# Buat file .env
cat <<EOF > .env
DOMAIN=cms.domainanda.com
POSTGRES_PASSWORD=$(openssl rand -hex 16)
NEXTAUTH_SECRET=$(openssl rand -hex 32)
EOF
```

### 3. Jalankan Docker Compose
```bash
docker compose up -d --build
```

Caddy akan otomatis me-request sertifikat SSL Let's Encrypt secara gratis untuk domain Anda.

---

## 🔌 Cara Mengakses dari AI Agent

### 1. Remote MCP (Cursor / Antigravity / Manus / Emergent)
- **URL:** `https://cms.domainanda.com/api/mcp`
- **Header:** `Authorization: Bearer <API_TOKEN>`

### 2. ChatGPT Custom GPTs (OpenAPI 3.1)
- **URL Schema:** `https://cms.domainanda.com/api/public/<tenant-slug>/openapi.json`
- **Auth:** API Key / Bearer Token

### 3. Google AI Studio / Gemini Function Calling
- **Tools URL:** `https://cms.domainanda.com/api/public/<tenant-slug>/gemini-tools`

### 4. Claude Desktop Local Stdio Bridge
```json
{
  "mcpServers": {
    "sacms": {
      "command": "bunx",
      "args": [
        "sacms-mcp",
        "--host",
        "https://cms.domainanda.com",
        "--token",
        "YOUR_TOKEN_HERE"
      ]
    }
  }
}
```
