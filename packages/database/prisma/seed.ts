import { prisma } from '../src/index.js';

await prisma.systemHealth.upsert({
  where: { name: 'bootstrap' },
  update: { status: 'ok' },
  create: { name: 'bootstrap', status: 'ok' }
});

await prisma.$disconnect();
