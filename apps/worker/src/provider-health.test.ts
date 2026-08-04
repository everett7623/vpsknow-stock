import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isProviderPaused,
  formatProviderFailureAlert,
  formatProviderRecoveryAlert,
  recordProviderFailure,
  recordProviderSuccess,
  type ProviderHealthConnection,
} from './provider-health.js';

const footer = ['🌐 vpsknow.com', '💬@vpsknow | 📢@vpsknow_channel | 🤖@vpsknow_bot'].join('\n');

function createConnection(incrementedFailures = 0): ProviderHealthConnection & {
  del: ReturnType<typeof vi.fn>;
  exists: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  incr: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
} {
  return {
    del: vi.fn().mockResolvedValue(2),
    exists: vi.fn().mockResolvedValue(0),
    get: vi.fn().mockResolvedValue(null),
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
    connection.get.mockResolvedValue('5');

    await expect(recordProviderSuccess(connection, 'buyvm')).resolves.toBe(5);
    expect(connection.get).toHaveBeenCalledWith('provider-failures:buyvm');
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

  it('formats actionable failure and recovery alerts', () => {
    const failureAlert = formatProviderFailureAlert(
      'buyvm',
      { failures: 5, degraded: true, paused: true },
      1234,
      new Error('No parseable products'),
    );
    const recoveryAlert = formatProviderRecoveryAlert('buyvm', 5);

    expect(failureAlert).toContain('Possible provider page or API change');
    expect(failureAlert.endsWith(footer)).toBe(true);
    expect(recoveryAlert).toContain('Previous failures: 5');
    expect(recoveryAlert.endsWith(footer)).toBe(true);
  });
});
