/**
 * Stable labels for China-facing or otherwise optimized network routes.
 * Keep the most specific patterns first so CN2 GIA-E is not reduced to CN2 GIA.
 */
export const OPTIMIZED_LINE_LABELS = [
  'CN2 GIA-E',
  'CN2 GIA',
  'CMIN2',
  'CMI',
  'CU Premium',
  'CTG',
  '9929',
  '4837',
  'IEPL',
  'IPLC',
  'BGP',
  'Premium',
  'Eyeball',
  'Tier 1',
] as const;

export type OptimizedLineLabel = (typeof OPTIMIZED_LINE_LABELS)[number];

const OPTIMIZED_LINE_PATTERNS: readonly [RegExp, OptimizedLineLabel][] = [
  [/CN2\s*GIA\s*[- ]?E|GIA\s*E/i, 'CN2 GIA-E'],
  [/CN2\s*GIA/i, 'CN2 GIA'],
  [/CMI\s*N2|CMIN2/i, 'CMIN2'],
  [/\bCMI\b/i, 'CMI'],
  [/CU\s*(?:Premium|Premium\s*Line)/i, 'CU Premium'],
  [/\bCTG\b|China\s*Telecom\s*Global/i, 'CTG'],
  [/\b9929\b/i, '9929'],
  [/\b4837\b/i, '4837'],
  [/\bIEPL\b/i, 'IEPL'],
  [/\bIPLC\b/i, 'IPLC'],
  [/\bBGP\b/i, 'BGP'],
  [/\bPremium(?:\s*Line)?\b/i, 'Premium'],
  [/\bEyeball\b/i, 'Eyeball'],
  [/\bTier\s*1\b|\bT1\b/i, 'Tier 1'],
];

export function detectOptimizedLine(text: string): OptimizedLineLabel | null {
  const value = text.trim();
  if (!value) return null;
  return OPTIMIZED_LINE_PATTERNS.find(([pattern]) => pattern.test(value))?.[1] ?? null;
}
