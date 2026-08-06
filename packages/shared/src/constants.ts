export const RESTOCK_COOLDOWN_MS = 60 * 60 * 1000; // 60 min
export const CONSECUTIVE_CONFIRMS_REQUIRED = 2;
export const ADAPTER_DEGRADED_THRESHOLD = 5;
export const ADAPTER_PAUSED_THRESHOLD = ADAPTER_DEGRADED_THRESHOLD;
export const STALE_ADAPTER_MS = 30 * 60 * 1000; // 30 min
export const JITTER_FACTOR = 0.2; // ±20%

export const LOCATION_ALIASES: Record<string, string> = {
  lax: 'Los Angeles',
  la: 'Los Angeles',
  sjc: 'San Jose',
  sea: 'Seattle',
  dal: 'Dallas',
  chi: 'Chicago',
  mia: 'Miami',
  nyc: 'New York',
  ny: 'New York',
  ash: 'Ashburn',
  ams: 'Amsterdam',
  fra: 'Frankfurt',
  lon: 'London',
  par: 'Paris',
  hkg: 'Hong Kong',
  hk: 'Hong Kong',
  sgp: 'Singapore',
  sg: 'Singapore',
  tyo: 'Tokyo',
  jp: 'Tokyo',
  nrt: 'Tokyo Narita',
  icn: 'Seoul',
  syd: 'Sydney',
  lux: 'Luxembourg',
  lu: 'Luxembourg',
  buf: 'Buffalo',
  lv: 'Las Vegas',
  mi: 'Miami',
  dc6: 'DC6 CN2 GIA-E',
  dc9: 'DC9 CN2 GIA',
};

export const REGION_MAP: Record<string, string> = {
  'Los Angeles': 'US West',
  'San Jose': 'US West',
  'Seattle': 'US West',
  'Las Vegas': 'US West',
  'Dallas': 'US Central',
  'Chicago': 'US Central',
  'Miami': 'US East',
  'New York': 'US East',
  'Ashburn': 'US East',
  'Buffalo': 'US East',
  'Amsterdam': 'Europe',
  'Frankfurt': 'Europe',
  'London': 'Europe',
  'Paris': 'Europe',
  'Luxembourg': 'Europe',
  'Hong Kong': 'Asia',
  'Singapore': 'Asia',
  'Tokyo': 'Asia',
  'Tokyo Narita': 'Asia',
  'Seoul': 'Asia',
  'Sydney': 'Oceania',
  'DC6 CN2 GIA-E': 'US West',
  'DC9 CN2 GIA': 'US West',
};

const REGION_ORDER = ['Asia', 'US West', 'US Central', 'US East', 'Europe', 'Oceania', 'Other'] as const;

/**
 * Map a free-text location to a coarse region for stock/offer filters.
 */
export function resolveRegion(location: string): string {
  const trimmed = location.trim();
  if (!trimmed) return 'Other';
  if (REGION_MAP[trimmed]) return REGION_MAP[trimmed]!;

  const aliased = LOCATION_ALIASES[trimmed.toLowerCase()];
  if (aliased && REGION_MAP[aliased]) return REGION_MAP[aliased]!;

  const lower = trimmed.toLowerCase();
  for (const [city, region] of Object.entries(REGION_MAP)) {
    if (lower.includes(city.toLowerCase())) return region;
  }

  if (/\b(hk|hong\s*kong|tokyo|osaka|seoul|singapore|taiwan|taipei)\b/i.test(trimmed)) {
    return 'Asia';
  }
  if (/\b(los\s*angeles|seattle|san\s*jose|las\s*vegas|california)\b/i.test(trimmed)) {
    return 'US West';
  }
  if (/\b(dallas|chicago|texas|midwest)\b/i.test(trimmed)) return 'US Central';
  if (/\b(new\s*york|ashburn|miami|virginia|buffalo)\b/i.test(trimmed)) return 'US East';
  if (/\b(amsterdam|frankfurt|london|paris|luxembourg|germany|netherlands|uk)\b/i.test(trimmed)) {
    return 'Europe';
  }
  if (/\b(sydney|australia)\b/i.test(trimmed)) return 'Oceania';

  return 'Other';
}

export function listRegions(): readonly string[] {
  return REGION_ORDER;
}
