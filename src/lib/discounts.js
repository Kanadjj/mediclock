export const DEFAULT_DISCOUNT_CONFIG = {
  tiers: [
    { id: 'tier-91-plus', minDays: 91, maxDays: null, percent: 0 },
    { id: 'tier-61-90', minDays: 61, maxDays: 90, percent: 5 },
    { id: 'tier-31-60', minDays: 31, maxDays: 60, percent: 10 },
    { id: 'tier-1-30', minDays: 1, maxDays: 30, percent: 15 },
  ],
};

export function validateDiscountTiers(tiers) {
  if (!Array.isArray(tiers) || !tiers.length) return 'Add at least one discount tier.';
  const normalized = [];
  for (const tier of tiers) {
    const minDays = Number(tier.minDays);
    const maxDays = tier.maxDays === '' || tier.maxDays == null ? null : Number(tier.maxDays);
    const percent = Number(tier.percent);
    if (!Number.isInteger(minDays) || minDays < 1) return 'Tier start days must be a whole number above 0.';
    if (maxDays !== null && (!Number.isInteger(maxDays) || maxDays < minDays)) return 'Tier end days must be a whole number at or above the start day.';
    if (tier.percent === '' || !Number.isFinite(percent) || percent < 0 || percent > 100) return 'Discount percentages must be between 0 and 100.';
    normalized.push({ minDays, maxDays, percent });
  }
  normalized.sort((a, b) => a.minDays - b.minDays);
  for (let i = 1; i < normalized.length; i++) {
    const previous = normalized[i - 1];
    if (previous.maxDays === null || previous.maxDays >= normalized[i].minDays) return 'Discount tiers cannot overlap.';
  }
  return null;
}

export function calculateBatchDiscount(batch, originalUnitPrice, transactionDate, config = DEFAULT_DISCOUNT_CONFIG) {
  const price = Number(originalUnitPrice);
  if (!Number.isFinite(price) || price < 0) throw new Error('Original unit price must be 0 or more.');
  const isISODate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const timestamp = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
  };
  if (!isISODate(batch?.expiry) || !isISODate(transactionDate)) throw new Error('A valid batch expiry and transaction date are required.');
  const expiryTime = Date.parse(`${batch.expiry}T00:00:00Z`);
  const transactionTime = Date.parse(`${transactionDate}T00:00:00Z`);
  const remainingDays = Math.round((expiryTime - transactionTime) / 86400000);
  if (remainingDays < 0) {
    return { expiry: batch.expiry, remainingDays, originalUnitPrice: price, discountPercent: 0, discountAmount: 0, finalUnitPrice: price, eligible: false };
  }
  const tiers = config?.tiers || DEFAULT_DISCOUNT_CONFIG.tiers;
  const tier = tiers.find((item) => remainingDays >= Number(item.minDays)
    && (item.maxDays == null || remainingDays <= Number(item.maxDays)));
  const discountPercent = tier ? Number(tier.percent) : 0;
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) throw new Error('Discount percentage must be between 0 and 100.');
  const discountAmount = Math.round((price * discountPercent / 100) * 100) / 100;
  return {
    expiry: batch.expiry, remainingDays, originalUnitPrice: price, discountPercent,
    discountAmount, finalUnitPrice: Math.round((price - discountAmount) * 100) / 100, eligible: true,
  };
}

export const discountedTotal = (quantity, discount) => Math.round(Number(quantity) * discount.finalUnitPrice * 100) / 100;
