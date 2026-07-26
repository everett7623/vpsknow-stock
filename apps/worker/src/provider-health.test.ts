import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isProviderPaused,
  recordProviderFailure,
  recordProviderSuccess,
  type ProviderHealthConnection,
} from './provider-health.js';

function createConnection(incrementedFailures = 0): ProviderHealthConnection & {
  del: ReturnType<typeof vi.fn>;
  exists: ReturnType<typeof vi.fn>;
  incr: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
} {
  return {
    del: vi.fn().mockResolvedValue(2),
    exists: vi.fn().mockResolvedValue(0),
    incr: vi.fn().mockResolvedValue(incrementedFailures),
    set: vi.fn().mockResolvedValue('OK'),
  };
}

describe('provider health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects an active provider pause', async () => {
    const connection = createConnection();
    connection.exists.mockResolvedValue(1);

    await expect(isProviderPaused(connection, 'buyvm')).resolves.toBe(true);
    expect(connection.exists).toHaveBeenCalledWith('provider-paused:buyvm');
  });

  it('clears failure and pause state after a successful check', async () => {
    const connection = createConnection();

    await expect(recordProviderSuccess(connection, 'buyvm')).resolves.toBeUndefined();
    expect(connection.del).toHaveBeenCalledWith('provider-failures:buyvm', 'provider-paused:buyvm');
  });

  it('opens the circuit for five minutes after five consecutive failures', async () => {
    const connection = createConnection(5);

    await expect(recordProviderFailure(connection, 'buyvm')).resolves.toEqual({
      failures: 5,
      degraded: true,
      paused: true,
    });
    expect(connection.set).toHaveBeenCalledWith('provider-paused:buyvm', '5', 'EX', 300);
  });
});
