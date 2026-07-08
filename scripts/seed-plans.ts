import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding default Plans Configuration...");

  const workspacePlans = [
    {
      id: "ws-starter",
      name: "Starter",
      price: 0,
      is_popular: false,
      features: ["5 Content Types", "1,000 Entries", "1GB Media Storage", "Basic Support"],
    },
    {
      id: "ws-pro",
      name: "Pro",
      price: 299000,
      is_popular: true,
      features: ["Unlimited Content Types", "50,000 Entries", "50GB Media Storage", "Content Workflow", "Priority Support"],
    },
    {
      id: "ws-enterprise",
      name: "Enterprise",
      price: 999000,
      is_popular: false,
      features: ["Everything in Pro", "Unlimited Storage", "Unlimited Locales", "White-Label Domains", "SSO / SAML", "24/7 SLA Support"],
    }
  ];

  const accountPlans = [
    {
      id: "acc-free",
      name: "Free Account",
      price: 0,
      is_popular: true,
      features: ["1 Workspace", "Basic Collaboration", "Community Support"],
    },
    {
      id: "acc-premium",
      name: "Premium Account",
      price: 99000,
      is_popular: false,
      features: ["Unlimited Workspaces", "Advanced Collaboration", "Dedicated Account Manager"],
    }
  ];

  const addonsPlans = [
    {
      id: "addon-storage",
      name: "Penyimpanan Ekstra",
      price: 29000,
      is_popular: true,
      features: ["50GB tambahan penyimpanan Cloudflare R2 untuk aset digital berat."],
    },
    {
      id: "addon-api",
      name: "Boost API Request",
      price: 39000,
      is_popular: false,
      features: ["Tambahan kuota 500.000 API request untuk traffic website tinggi."],
    }
  ];

  // Helper function to upsert setting
  const upsertSetting = async (key: string, value: any) => {
    await prisma.setting.upsert({
      where: { key },
      update: { value: JSON.stringify(value) },
      create: { key, value: JSON.stringify(value) },
    });
    console.log(`✅ Seeded ${key}`);
  };

  await upsertSetting("workspacePlan", workspacePlans);
  await upsertSetting("accountPlan", accountPlans);
  await upsertSetting("addonsPlan", addonsPlans);

  console.log("🎉 Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
