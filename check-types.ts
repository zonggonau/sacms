import { PrismaClient } from './prisma/generated-client';
const p = new PrismaClient();
p.contentType.findMany().then(c => console.log(c.map(x => ({ id: x.id, name: x.name, tenantId: x.tenantId })))).finally(() => p.$disconnect());
