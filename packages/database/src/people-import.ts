import type { CommunicationChannelType, Prisma, PrismaClient } from '@prisma/client';

export const PEOPLE_IMPORT_QUEUE = 'people-imports';
export const PEOPLE_IMPORT_JOB = 'people.import';

export type PeopleImportField =
  | 'firstName'
  | 'lastName'
  | 'displayName'
  | 'jobTitle'
  | 'organizationName'
  | 'organizationWebsite'
  | 'email'
  | 'linkedin'
  | 'x'
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'website'
  | 'phone'
  | 'countryCode'
  | 'languageCode'
  | 'followerCount'
  | 'tags';

export type PeopleImportMapping = {
  fields: Partial<Record<PeopleImportField, string>>;
  overwriteExisting?: boolean;
  rows?: CsvRow[];
};

export type CsvRow = Record<string, string>;

export type CsvParseResult = {
  headers: string[];
  rows: CsvRow[];
};

export function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, ' ') ?? '';
}

export function normalizeName(value: string | null | undefined) {
  return normalizeText(value).toLocaleLowerCase();
}

export function normalizeEmail(value: string | null | undefined) {
  const normalized = normalizeText(value).toLocaleLowerCase();
  return normalized.includes('@') ? normalized : '';
}

export function normalizeCountryCode(value: string | null | undefined) {
  const normalized = normalizeText(value).toLocaleUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : '';
}

export function normalizeLanguageCode(value: string | null | undefined) {
  const normalized = normalizeText(value).toLocaleLowerCase();
  return /^[a-z]{2}(-[a-z]{2})?$/.test(normalized) ? normalized : '';
}

export function normalizeInteger(value: string | number | null | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
  }
  const cleaned = normalizeText(value).replaceAll(',', '');
  if (!cleaned) {
    return null;
  }
  const parsed = Number.parseInt(cleaned, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function normalizeChannelValue(
  type: CommunicationChannelType,
  value: string | null | undefined,
) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return '';
  }
  if (type === 'EMAIL') {
    return normalizeEmail(normalized);
  }
  if (type === 'PHONE') {
    return normalized.replace(/[^\d+]/g, '');
  }
  if (
    type === 'WEBSITE' ||
    type === 'LINKEDIN' ||
    type === 'X' ||
    type === 'INSTAGRAM' ||
    type === 'TIKTOK' ||
    type === 'YOUTUBE'
  ) {
    return normalized
      .toLocaleLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/^@/, '')
      .replace(/\/$/, '');
  }
  return normalized.toLocaleLowerCase();
}

export function parseCsv(content: string): CsvParseResult {
  const rows: string[][] = [];
  let cell = '';
  let current: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      current.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        index += 1;
      }
      current.push(cell);
      cell = '';
      if (current.some((value) => value.trim().length > 0)) {
        rows.push(current);
      }
      current = [];
    } else {
      cell += char ?? '';
    }
  }

  current.push(cell);
  if (current.some((value) => value.trim().length > 0)) {
    rows.push(current);
  }

  const headers = (rows.shift() ?? []).map((header) => normalizeText(header));
  return {
    headers,
    rows: rows.map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, normalizeText(row[index] ?? '')])),
    ),
  };
}

export function inferPeopleImportMapping(
  headers: string[],
): Partial<Record<PeopleImportField, string>> {
  const aliases: Record<PeopleImportField, string[]> = {
    firstName: ['first name', 'firstname', 'nombre'],
    lastName: ['last name', 'lastname', 'apellido'],
    displayName: ['display name', 'name', 'full name', 'nombre completo'],
    jobTitle: ['job title', 'title', 'role', 'cargo'],
    organizationName: ['organization', 'company', 'account', 'empresa'],
    organizationWebsite: ['organization website', 'company website'],
    email: ['email', 'e-mail', 'mail'],
    linkedin: ['linkedin', 'linkedin url', 'linkedin profile'],
    x: ['x', 'twitter', 'twitter url'],
    instagram: ['instagram', 'ig'],
    tiktok: ['tiktok', 'tik tok'],
    youtube: ['youtube', 'youtube channel'],
    website: ['website', 'site', 'url'],
    phone: ['phone', 'mobile', 'telefono'],
    countryCode: ['country', 'country code', 'pais'],
    languageCode: ['language', 'language code', 'idioma'],
    followerCount: ['followers', 'follower count', 'audience'],
    tags: ['tags', 'tag'],
  };

  const normalizedHeaders = new Map(headers.map((header) => [normalizeName(header), header]));
  const mapping: Partial<Record<PeopleImportField, string>> = {};

  for (const [field, names] of Object.entries(aliases) as [PeopleImportField, string[]][]) {
    const match = names.find((name) => normalizedHeaders.has(name));
    if (match) {
      mapping[field] = normalizedHeaders.get(match);
    }
  }

  return mapping;
}

export async function processPeopleImportJob(prisma: PrismaClient, importJobId: string) {
  const job = await prisma.importJob.findUnique({ where: { id: importJobId } });
  if (!job) {
    throw new Error(`Import job ${importJobId} not found`);
  }

  const mapping = job.mapping as PeopleImportMapping;
  const rows = mapping.rows ?? [];
  const fields = mapping.fields ?? {};
  const overwriteExisting = mapping.overwriteExisting ?? false;

  await prisma.importJob.update({
    where: { id: importJobId },
    data: { status: 'PROCESSING', processedRows: 0, succeededRows: 0, failedRows: 0 },
  });
  await prisma.importRowError.deleteMany({ where: { importJobId } });

  let succeededRows = 0;
  let failedRows = 0;

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    try {
      await importPersonRow(prisma, job.workspaceId, row, fields, overwriteExisting);
      succeededRows += 1;
    } catch (error) {
      failedRows += 1;
      await prisma.importRowError.create({
        data: {
          importJobId,
          rowNumber,
          errorCode: error instanceof RowImportError ? error.code : 'ROW_FAILED',
          message: error instanceof Error ? error.message : 'Row failed',
          rawRow: row,
        },
      });
    }

    await prisma.importJob.update({
      where: { id: importJobId },
      data: {
        processedRows: index + 1,
        succeededRows,
        failedRows,
      },
    });
  }

  const completedStatus = failedRows === rows.length && rows.length > 0 ? 'FAILED' : 'COMPLETED';
  return prisma.importJob.update({
    where: { id: importJobId },
    data: {
      status: completedStatus,
      processedRows: rows.length,
      succeededRows,
      failedRows,
      completedAt: new Date(),
      mapping: { fields, overwriteExisting },
      summary: {
        imported: succeededRows,
        failed: failedRows,
        total: rows.length,
      },
    },
  });
}

class RowImportError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function importPersonRow(
  prisma: PrismaClient,
  workspaceId: string,
  row: CsvRow,
  fields: Partial<Record<PeopleImportField, string>>,
  overwriteExisting: boolean,
) {
  const value = (field: PeopleImportField) => {
    const header = fields[field];
    return header ? normalizeText(row[header]) : '';
  };

  const firstName = value('firstName');
  const lastName = value('lastName');
  const displayName = value('displayName') || normalizeText(`${firstName} ${lastName}`);
  const email = normalizeEmail(value('email'));
  const channelInputs = buildChannelInputs(value, email);

  if (!displayName) {
    throw new RowImportError('MISSING_NAME', 'A name or first/last name is required.');
  }
  if (channelInputs.length === 0) {
    throw new RowImportError(
      'MISSING_CHANNEL',
      'At least one email or social channel is required.',
    );
  }

  const organization = await findOrCreateOrganization(prisma, workspaceId, {
    name: value('organizationName'),
    website: value('organizationWebsite'),
  });

  const existingChannel = await prisma.communicationChannel.findFirst({
    where: {
      workspaceId,
      OR: channelInputs.map((channel) => ({
        type: channel.type,
        normalizedValue: channel.normalizedValue,
      })),
    },
    include: { person: true },
  });

  const scalarData = {
    organizationId: organization?.id,
    firstName: firstName || null,
    lastName: lastName || null,
    displayName,
    jobTitle: value('jobTitle') || null,
    countryCode: normalizeCountryCode(value('countryCode')) || null,
    languageCode: normalizeLanguageCode(value('languageCode')) || null,
    followerCount: normalizeInteger(value('followerCount')),
    source: 'IMPORT' as const,
  };

  const person =
    existingChannel?.person ??
    (await prisma.person.create({
      data: {
        workspaceId,
        ...scalarData,
      },
    }));

  if (existingChannel && overwriteExisting) {
    await prisma.person.update({
      where: { id: person.id },
      data: scalarData,
    });
  }

  await upsertChannels(prisma, workspaceId, person.id, channelInputs);
  await assignTags(prisma, workspaceId, person.id, value('tags'));
}

function buildChannelInputs(
  value: (field: PeopleImportField) => string,
  email: string,
): {
  type: CommunicationChannelType;
  value: string;
  normalizedValue: string;
  isPrimary?: boolean;
}[] {
  const rawChannels: { type: CommunicationChannelType; field: PeopleImportField }[] = [
    { type: 'LINKEDIN', field: 'linkedin' },
    { type: 'X', field: 'x' },
    { type: 'INSTAGRAM', field: 'instagram' },
    { type: 'TIKTOK', field: 'tiktok' },
    { type: 'YOUTUBE', field: 'youtube' },
    { type: 'WEBSITE', field: 'website' },
    { type: 'PHONE', field: 'phone' },
  ];
  const channels: {
    type: CommunicationChannelType;
    value: string;
    normalizedValue: string;
    isPrimary?: boolean;
  }[] = rawChannels
    .map((channel) => {
      const rawValue = value(channel.field);
      return {
        type: channel.type,
        value: rawValue,
        normalizedValue: normalizeChannelValue(channel.type, rawValue),
      };
    })
    .filter((channel) => channel.normalizedValue);

  if (email) {
    channels.unshift({ type: 'EMAIL', value: email, normalizedValue: email, isPrimary: true });
  }

  return channels;
}

async function findOrCreateOrganization(
  prisma: PrismaClient,
  workspaceId: string,
  input: { name: string; website: string },
) {
  const name = normalizeText(input.name);
  if (!name) {
    return null;
  }
  const normalizedName = normalizeName(name);
  return prisma.organization.upsert({
    where: {
      workspaceId_normalizedName: {
        workspaceId,
        normalizedName,
      },
    },
    update: {
      website: input.website || undefined,
    },
    create: {
      workspaceId,
      name,
      normalizedName,
      website: input.website || undefined,
    },
  });
}

async function upsertChannels(
  prisma: PrismaClient,
  workspaceId: string,
  personId: string,
  channels: {
    type: CommunicationChannelType;
    value: string;
    normalizedValue: string;
    isPrimary?: boolean;
  }[],
) {
  for (const channel of channels) {
    await prisma.communicationChannel.upsert({
      where: {
        workspaceId_type_normalizedValue: {
          workspaceId,
          type: channel.type,
          normalizedValue: channel.normalizedValue,
        },
      },
      update: {
        personId,
        value: channel.value,
        isPrimary: channel.isPrimary ?? false,
        status: 'ACTIVE',
      },
      create: {
        workspaceId,
        personId,
        type: channel.type,
        value: channel.value,
        normalizedValue: channel.normalizedValue,
        isPrimary: channel.isPrimary ?? false,
      },
    });
  }
}

async function assignTags(
  prisma: PrismaClient,
  workspaceId: string,
  personId: string,
  rawTags: string,
) {
  const names = rawTags
    .split(/[;,]/)
    .map((tag) => normalizeText(tag))
    .filter(Boolean);

  for (const name of names) {
    const tag = await prisma.tag.upsert({
      where: {
        workspaceId_normalizedName: {
          workspaceId,
          normalizedName: normalizeName(name),
        },
      },
      update: {},
      create: {
        workspaceId,
        name,
        normalizedName: normalizeName(name),
      },
    });
    await prisma.personTag.upsert({
      where: {
        personId_tagId: {
          personId,
          tagId: tag.id,
        },
      },
      update: {},
      create: {
        personId,
        tagId: tag.id,
      },
    });
  }
}

export function toJsonInput(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
