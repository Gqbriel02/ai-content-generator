const buckets = new Map<string, { count: number; resetAt: number }>();

export function hitRateLimit(key: string, maxPerMinute: number) {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }

  if (current.count >= maxPerMinute) {
    return true;
  }

  current.count += 1;
  buckets.set(key, current);
  return false;
}
