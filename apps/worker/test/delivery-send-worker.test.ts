import { describe, expect, it, vi } from 'vitest';
import { processDeliveryJob } from '../src/delivery-send-worker.service.js';

describe('processDeliveryJob', () => {
  it('does not send messages that are not approved', async () => {
    const update = vi.fn().mockResolvedValue({});
    const db = {
      delivery: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'delivery-1',
          status: 'PENDING',
          workspace: { emailSettings: null },
          generatedMessage: { status: 'GENERATED' },
        }),
        update,
      },
    };

    await expect(processDeliveryJob(db as never, 'delivery-1')).rejects.toThrow(/not approved/i);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'delivery-1' },
      data: { status: 'FAILED', error: 'Generated message is not approved.' },
    });
  });
});
