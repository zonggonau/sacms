import { chromium, FullConfig } from '@playwright/test';
import { PrismaClient } from '../prisma/generated-client';
import bcrypt from 'bcrypt';

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  
  // Seed Test User and Tenant
  const prisma = new PrismaClient();
  try {
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    
    // Create or update user
    const user = await prisma.user.upsert({
      where: { email: 'admin@example.com' },
      update: { password: hashedPassword, role: 'admin', emailVerified: new Date() },
      create: {
        name: 'Test Admin',
        email: 'admin@example.com',
        password: hashedPassword,
        role: 'admin',
        emailVerified: new Date(),
      },
    });

    await prisma.tenant.upsert({
      where: { slug: 'demo-tenant' },
      update: { plan: 'enterprise' },
      create: {
        id: 'test-tenant-id',
        name: 'Demo Tenant',
        slug: 'demo-tenant',
        plan: 'enterprise',
      },
    });
    
    // Ensure membership
    await prisma.tenantMember.upsert({
      where: {
        tenantId_userId: {
          tenantId: 'test-tenant-id',
          userId: user.id,
        }
      },
      update: { role: 'owner' },
      create: {
        tenantId: 'test-tenant-id',
        userId: user.id,
        role: 'owner',
      }
    });

    // Create API Token for testing
    await prisma.apiToken.upsert({
      where: { token: '3f98e3ad578064e710ba3876cb369f9c9c29331875673bebb80efe369c17adbd' },
      update: {},
      create: {
        tenantId: 'test-tenant-id',
        name: 'Test Token',
        token: '3f98e3ad578064e710ba3876cb369f9c9c29331875673bebb80efe369c17adbd',
        type: 'read-only',
      }
    });

  } catch (error) {
    console.error("Database seed failed in global setup:", error);
  } finally {
    await prisma.$disconnect();
  }

  // Perform UI Login
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    await page.goto(baseURL + '/login');
    
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard**');
    
    // Save storage state
    await page.context().storageState({ path: 'e2e/storageState.json' });
  } catch (error) {
    console.error("Global setup login failed.", error);
  } finally {
    await browser.close();
  }
}

export default globalSetup;
