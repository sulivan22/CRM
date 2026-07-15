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
    displayName: 'Development User',
  },
});

const workspace = await prisma.workspace.upsert({
  where: { slug: 'development-workspace' },
  update: {},
  create: {
    name: 'Development Workspace',
    slug: 'development-workspace',
    createdByUserId: user.id,
  },
});

await prisma.workspaceMembership.upsert({
  where: {
    workspaceId_userId: {
      workspaceId: workspace.id,
      userId: user.id,
    },
  },
  update: {
    role: 'OWNER',
    status: 'ACTIVE',
  },
  create: {
    workspaceId: workspace.id,
    userId: user.id,
    role: 'OWNER',
    status: 'ACTIVE',
    joinedAt: new Date(),
  },
});

await prisma.workspaceEmailSettings.upsert({
  where: { workspaceId: workspace.id },
  update: {
    provider: 'FAKE',
    fromName: 'Development CRM',
    fromEmail: 'hello@example.com',
    replyTo: 'reply@example.com',
    apiKey: null,
  },
  create: {
    workspaceId: workspace.id,
    provider: 'FAKE',
    fromName: 'Development CRM',
    fromEmail: 'hello@example.com',
    replyTo: 'reply@example.com',
  },
});

const organization = await prisma.organization.upsert({
  where: {
    workspaceId_normalizedName: {
      workspaceId: workspace.id,
      normalizedName: 'northstar media',
    },
  },
  update: {},
  create: {
    workspaceId: workspace.id,
    name: 'Northstar Media',
    normalizedName: 'northstar media',
    type: 'AGENCY',
    website: 'https://northstar.example',
    countryCode: 'US',
  },
});

const creatorTag = await prisma.tag.upsert({
  where: {
    workspaceId_normalizedName: {
      workspaceId: workspace.id,
      normalizedName: 'creator',
    },
  },
  update: {},
  create: {
    workspaceId: workspace.id,
    name: 'Creator',
    normalizedName: 'creator',
    color: '#2563eb',
  },
});

const vipTag = await prisma.tag.upsert({
  where: {
    workspaceId_normalizedName: {
      workspaceId: workspace.id,
      normalizedName: 'vip',
    },
  },
  update: {},
  create: {
    workspaceId: workspace.id,
    name: 'VIP',
    normalizedName: 'vip',
    color: '#16a34a',
  },
});

async function upsertSeedPerson(input: {
  email: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  countryCode: string;
  languageCode: string;
  followerCount: number;
  secondaryChannel: {
    type: 'LINKEDIN' | 'X';
    value: string;
    normalizedValue: string;
  };
  tagIds: string[];
}) {
  const existingChannel = await prisma.communicationChannel.findFirst({
    where: {
      workspaceId: workspace.id,
      type: 'EMAIL',
      normalizedValue: input.email,
    },
    include: { person: true },
  });

  const person =
    existingChannel?.person ??
    (await prisma.person.create({
      data: {
        workspaceId: workspace.id,
        displayName: `${input.firstName} ${input.lastName}`,
      },
    }));

  await prisma.person.update({
    where: { id: person.id },
    data: {
      organizationId: organization.id,
      firstName: input.firstName,
      lastName: input.lastName,
      displayName: `${input.firstName} ${input.lastName}`,
      jobTitle: input.jobTitle,
      countryCode: input.countryCode,
      languageCode: input.languageCode,
      followerCount: input.followerCount,
      source: 'MANUAL',
    },
  });

  await prisma.communicationChannel.upsert({
    where: {
      personId_type_normalizedValue: {
        personId: person.id,
        type: 'EMAIL',
        normalizedValue: input.email,
      },
    },
    update: {
      value: input.email,
      isPrimary: true,
      status: 'ACTIVE',
    },
    create: {
      workspaceId: workspace.id,
      personId: person.id,
      type: 'EMAIL',
      value: input.email,
      normalizedValue: input.email,
      isPrimary: true,
    },
  });

  await prisma.communicationChannel.upsert({
    where: {
      personId_type_normalizedValue: {
        personId: person.id,
        type: input.secondaryChannel.type,
        normalizedValue: input.secondaryChannel.normalizedValue,
      },
    },
    update: {
      value: input.secondaryChannel.value,
      status: 'ACTIVE',
    },
    create: {
      workspaceId: workspace.id,
      personId: person.id,
      type: input.secondaryChannel.type,
      value: input.secondaryChannel.value,
      normalizedValue: input.secondaryChannel.normalizedValue,
    },
  });

  for (const tagId of input.tagIds) {
    await prisma.personTag.upsert({
      where: {
        personId_tagId: {
          personId: person.id,
          tagId,
        },
      },
      update: {},
      create: {
        personId: person.id,
        tagId,
      },
    });
  }
}

await upsertSeedPerson({
  email: 'alex.morgan@example.com',
  firstName: 'Alex',
  lastName: 'Morgan',
  jobTitle: 'Creator Partnerships Lead',
  countryCode: 'US',
  languageCode: 'en',
  followerCount: 145000,
  secondaryChannel: {
    type: 'LINKEDIN',
    value: 'https://linkedin.com/in/alexmorgan',
    normalizedValue: 'linkedin.com/in/alexmorgan',
  },
  tagIds: [creatorTag.id, vipTag.id],
});

await upsertSeedPerson({
  email: 'jamie.chen@example.com',
  firstName: 'Jamie',
  lastName: 'Chen',
  jobTitle: 'B2B Influencer',
  countryCode: 'GB',
  languageCode: 'en',
  followerCount: 82000,
  secondaryChannel: {
    type: 'X',
    value: '@jamiechen',
    normalizedValue: 'jamiechen',
  },
  tagIds: [creatorTag.id],
});

const seedPeople = await prisma.person.findMany({
  where: {
    workspaceId: workspace.id,
    channels: { some: { type: 'EMAIL', status: 'ACTIVE' } },
  },
  take: 2,
});

if (seedPeople.length > 0) {
  const outreach = await prisma.outreach.upsert({
    where: { id: '00000000-0000-4000-8000-000000000003' },
    update: {
      totalRecipients: seedPeople.length,
    },
    create: {
      id: '00000000-0000-4000-8000-000000000003',
      workspaceId: workspace.id,
      createdByUserId: user.id,
      name: 'Creator partnership draft',
      objective: 'Explore a lightweight creator partnership for the next product launch.',
      languageCode: 'en',
      tone: 'PROFESSIONAL',
      length: 'MEDIUM',
      audienceDefinition: { filters: { hasEmail: true } },
      totalRecipients: seedPeople.length,
      instruction: {
        create: {
          workspaceId: workspace.id,
          objective: 'Explore a lightweight creator partnership for the next product launch.',
          languageCode: 'en',
          tone: 'PROFESSIONAL',
          length: 'MEDIUM',
          additionalContext: 'Development seed outreach.',
        },
      },
    },
  });

  for (const person of seedPeople) {
    await prisma.outreachRecipient.upsert({
      where: {
        outreachId_personId: {
          outreachId: outreach.id,
          personId: person.id,
        },
      },
      update: {},
      create: {
        workspaceId: workspace.id,
        outreachId: outreach.id,
        personId: person.id,
      },
    });
  }
}

await prisma.$disconnect();
