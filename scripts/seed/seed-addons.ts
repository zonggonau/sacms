import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const addonContentType = await prisma.contentType.findFirst({
    where: { slug: "sacms-addons", tenantId: null }
  });

  if (!addonContentType) {
    console.error("Content type 'sacms-addons' not found.");
    return;
  }

  // 1. Paket AI Kontent
  const aiPackData = {
    name: "Paket AI Kontent",
    price: 150000,
    description: "Generasi Konten AI Tanpa Batas, Otomatisasi Deskripsi, Smart Fill & Auto-Tagging",
    icon: "Bot"
  };

  const aiEntry = await prisma.contentEntry.create({
    data: {
      contentTypeId: addonContentType.id,
      tenantId: null,
      locale: "en",
      data: aiPackData as any,
      status: "PUBLISHED",
      publishedAt: new Date(),
      createdBy: "system",
      updatedBy: "system",
    }
  });

  await prisma.contentEntry.update({
    where: { id: aiEntry.id },
    data: { documentId: aiEntry.id }
  });

  // 2. Plugin Format Surat
  const suratPackData = {
    name: "Plugin Format Surat",
    price: 75000,
    description: "Template Surat Resmi, Generate PDF/Word, Dynamic Variables Integration",
    icon: "FileText"
  };

  const suratEntry = await prisma.contentEntry.create({
    data: {
      contentTypeId: addonContentType.id,
      tenantId: null,
      locale: "en",
      data: suratPackData as any,
      status: "PUBLISHED",
      publishedAt: new Date(),
      createdBy: "system",
      updatedBy: "system",
    }
  });

  await prisma.contentEntry.update({
    where: { id: suratEntry.id },
    data: { documentId: suratEntry.id }
  });

  console.log("Addons seeded successfully.");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
