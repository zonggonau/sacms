const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  await prisma.contentTypeField.update({
    where: { id: "cmq7v8a0e001kuj9s6b4vilza" },
    data: { 
      options: JSON.stringify({ 
        templateUrl: "https://files.testfile.org/DOCX/100KB-TESTFILE.ORG.docx" 
      }) 
    }
  });
  console.log("DB Updated successfully!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
