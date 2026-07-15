import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class SlugService {
  constructor(private readonly prismaService: PrismaService) {}

  normalize(input: string) {
    const slug = input
      .trim()
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64);

    return slug || 'workspace';
  }

  async generateUniqueSlug(input: string) {
    const base = this.normalize(input);
    let candidate = base;
    let suffix = 1;

    while (await this.prismaService.client.workspace.findUnique({ where: { slug: candidate } })) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }

    return candidate;
  }
}
