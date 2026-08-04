import { ADAPTER_DEGRADED_THRESHOLD, ADAPTER_PAUSED_THRESHOLD } from '@vpsknow/shared';

const FAILURE_KEY_PREFIX = 'provider-failures:';
const PAUSE_KEY_PREFIX = 'provider-paused:';
const PAUSE_DURATION_SECONDS = 5 * 60;
const MESSAGE_FOOTER = ['🌐 vpsknow.com', '💬@vpsknow | 📢@vpsknow_channel | 🤖@vpsknow_bot'];

export interface ProviderFailureState {
  failures: number;
  degraded: boolean;
  paused: boolean;
}

export interface ProviderHealthConnection {
  del(...keys: string[]): Promise<number>;
  exists(key: string): Promise<number>;
  get(key: string): Promise<string | null>;
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

export async function recordProviderSuccess(
  connection: ProviderHealthConnection,
  provider: string,
): Promise<number> {
  const previousFailures = Number.parseInt(await connection.get(failureKey(provider)) ?? '0', 10);
  await connection.del(failureKey(provider), pauseKey(provider));
  return Number.isFinite(previousFailures) ? previousFailures : 0;
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

export function formatProviderFailureAlert(
  provider: string,
  state: ProviderFailureState,
  durationMs: number,
  error: unknown,
): string {
  const detail = error instanceof Error ? error.message : String(error);
  return [
    '🚨 Provider adapter paused',
    `Provider: ${provider}`,
    `Failures: ${state.failures}`,
    `Pause: 5 minutes`,
    `Last request: ${durationMs} ms`,
    `Error: ${detail.slice(0, 300)}`,
    '',
    'Possible provider page or API change. Review the adapter before re-enabling notifications.',
    '',
    ...MESSAGE_FOOTER,
  ].join('\n');
}

export function formatProviderRecoveryAlert(provider: string, previousFailures: number): string {
  return [
    '✅ Provider adapter recovered',
    `Provider: ${provider}`,
    `Previous failures: ${previousFailures}`,
    'Stock checks are succeeding again.',
    '',
    ...MESSAGE_FOOTER,
  ].join('\n');
}
