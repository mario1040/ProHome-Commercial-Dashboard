export function formatEgp(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return '0 EGP';
  }
  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(value)} EGP`;
}

export function formatPercent(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return '0.0%';
  }
  return `${value.toFixed(1)}%`;
}

export function formatNumber(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return '0';
  }
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatRatio(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value) || value === 0) {
    return '0.0x';
  }
  return `${value.toFixed(2)}x`;
}
