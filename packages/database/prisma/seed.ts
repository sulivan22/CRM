import { prisma } from '../src/index.js';
import argon2 from 'argon2';

const email = 'dev@example.com';
const passwordHash = await argon2.hash('ChangeMe12345!', { type: argon2.argon2id });

const user = await prisma.user.upsert({
  where: { email },
  update: {},
  create: {
    email,
    passwordHash,
    displayName: 'Development User'
  }
});

const workspace = await prisma.workspace.upsert({
  where: { slug: 'development-workspace' },
  update: {},
  create: {
    name: 'Development Workspace',
    slug: 'development-workspace',
    createdByUserId: user.id
  }
});

await prisma.workspaceMembership.upsert({
  where: {
    workspaceId_userId: {
      workspaceId: workspace.id,
      userId: user.id
    }
  },
  update: {
    role: 'OWNER',
    status: 'ACTIVE'
  },
  create: {
    workspaceId: workspace.id,
    userId: user.id,
    role: 'OWNER',
    status: 'ACTIVE',
    joinedAt: new Date()
  }
});

await prisma.$disconnect();
