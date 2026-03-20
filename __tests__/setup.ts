import { vi } from "vitest"

// Mock Prisma
vi.mock("@/lib/database", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    tenant: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    tenantMember: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    contentType: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    contentEntry: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    tenantContentTypeAssignment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    tenantSingleTypeAssignment: {
      findMany: vi.fn(),
    },
    apiToken: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    tenantLocale: {
      findMany: vi.fn(),
    },
    webhook: {
      findMany: vi.fn(),
    },
    webhookLog: {
      create: vi.fn(),
    },
    media: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn({
      user: { create: vi.fn(), findUnique: vi.fn() },
      tenant: { create: vi.fn() },
      tenantMember: { create: vi.fn() },
    })),
    $queryRawUnsafe: vi.fn(),
  },
}))

// Mock rate limit
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 99 }),
  RATE_LIMITS: {
    auth: { max: 10, window: 60 },
    api: { max: 100, window: 60 },
    admin: { max: 300, window: 60 },
  },
}))

// Mock audit log
vi.mock("@/lib/audit-log", () => ({
  logAudit: vi.fn(),
  AuditAction: {
    USER_REGISTER: "USER_REGISTER",
    USER_LOGIN: "USER_LOGIN",
    CONTENT_CREATE: "CONTENT_CREATE",
    CONTENT_UPDATE: "CONTENT_UPDATE",
    CONTENT_DELETE: "CONTENT_DELETE",
    CONTENT_PUBLISH: "CONTENT_PUBLISH",
  },
}))

// Mock bcrypt
vi.mock("bcrypt", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("$2b$12$hashedpassword"),
    compare: vi.fn().mockResolvedValue(true),
  },
}))
