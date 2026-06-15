
import { PrismaClient } from "../prisma/generated-client"
const prisma = new PrismaClient()

async function main() {
  await prisma.setting.upsert({ 
    where: { key: 'systemApiKey' }, 
    update: { value: 'cf_cc0045e6f75d9cb58a5a81a4b03dbc5602258b70c06c5c6ce8be304e9474b5fd' }, 
    create: { key: 'systemApiKey', value: 'cf_cc0045e6f75d9cb58a5a81a4b03dbc5602258b70c06c5c6ce8be304e9474b5fd' } 
  })
  console.log('API Key Updated')
}

main().finally(() => prisma.$disconnect())
