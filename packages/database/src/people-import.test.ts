import { describe, expect, it } from 'vitest';
import { inferPeopleImportMapping, normalizeChannelValue, parseCsv } from './people-import.js';

describe('people import utilities', () => {
  it('parses quoted csv cells', () => {
    const parsed = parseCsv('Name,Email,Tags\n"Alex, Morgan",alex@example.com,"VIP; Creator"\n');

    expect(parsed.headers).toEqual(['Name', 'Email', 'Tags']);
    expect(parsed.rows).toEqual([
      {
        Name: 'Alex, Morgan',
        Email: 'alex@example.com',
        Tags: 'VIP; Creator',
      },
    ]);
  });

  it('infers common people fields', () => {
    expect(inferPeopleImportMapping(['Full Name', 'E-mail', 'Company', 'Followers'])).toEqual({
      displayName: 'Full Name',
      email: 'E-mail',
      organizationName: 'Company',
      followerCount: 'Followers',
    });
  });

  it('normalizes social and email channels', () => {
    expect(normalizeChannelValue('EMAIL', ' Alex@Example.COM ')).toBe('alex@example.com');
    expect(normalizeChannelValue('LINKEDIN', 'https://www.linkedin.com/in/AlexMorgan/')).toBe(
      'linkedin.com/in/alexmorgan',
    );
    expect(normalizeChannelValue('X', '@AlexMorgan')).toBe('alexmorgan');
  });
});
