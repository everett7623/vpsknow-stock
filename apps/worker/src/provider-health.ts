import { ADAPTER_DEGRADED_THRESHOLD, ADAPTER_PAUSED_THRESHOLD } from '@vpsknow/shared';

const FAILURE_KEY_PREFIX = 'provider-failures:';
const PAUSE_KEY_PREFIX = 'provider-paused:';
const PAUSE_DURATION_SECONDS = 5 * 60;

export interface ProviderFailureState {
  failures: number;
  degraded: boolean;
  paused: boolean;
}

export interface ProviderHealthConnection {
  del(...keys: string[]): Promise<number>;
  exists(key: string): Promise<number>;
  incr(key: string): Promise<number>;
  set(key: string, value: string, mode: 'EX', durationSeconds: number): Promise<string | null>;
}

function failureKey(provider: string): string {
  return `${FAILURE_KEY_PREFIX}${provider}`;
}

function pauseKey(provider: string): string {
  return `${PAUSE_KEY_PREFIX}${provider}`;
}

export async function isProviderPaused(connection: ProviderHealthConnection, provider: string): Promise<boolean> {
  return (await connection.exists(pauseKey(provider))) === 1;
}

export async function recordProviderSuccess(connection: ProviderHealthConnection, provider: string): Promise<void> {
  await connection.del(failureKey(provider), pauseKey(provider));
}

export async function recordProviderFailure(
  connection: ProviderHealthConnection,
  provider: string,
): Promise<ProviderFailureState> {
  const failures = await connection.incr(failureKey(provider));
  const paused = failures >= ADAPTER_PAUSED_THRESHOLD;

  if (paused) {
    await connection.set(pauseKey(provider), String(failures), 'EX', PAUSE_DURATION_SECONDS);
  }

  return {
    failures,
    degraded: failures >= ADAPTER_DEGRADED_THRESHOLD,
    paused,
  };
}
