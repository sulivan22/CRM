import { describe, expect, it } from 'vitest';
import { processBootstrapJob } from '../src/bootstrap-processor.js';

describe('processBootstrapJob', () => {
  it('processes a bootstrap job', () => {
    expect(processBootstrapJob({ data: { requestedBy: 'test' } })).toMatchObject({
      processed: true,
      requestedBy: 'test',
    });
  });
});
