import { prisma } from './index.js';

const result = await prisma.session.deleteMany({
  where: {
    OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }]
  }
});

console.log(JSON.stringify({ deletedSessions: result.count }));

await prisma.$disconnect();
