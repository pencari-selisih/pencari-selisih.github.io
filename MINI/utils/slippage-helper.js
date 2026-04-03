// ============================================================
// slippage-helper.js — User-Configurable Slippage Manager
// ============================================================

const SLIPPAGE_STORAGE_KEY = 'mini_slippage_tolerance';
const DEFAULT_SLIPPAGE = 0.3;  // 0.3%

/**
 * Get current slippage tolerance from storage
 * Returns float value (e.g., 0.3, 0.5, 1.0)
 * Defaults to 0.3% if not set
 */
function getSlippageTolerance() {
  try {
    const stored = dbGet(SLIPPAGE_STORAGE_KEY);
    if (stored !== undefined) {
      const parsed = parseFloat(stored);
      return isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SLIPPAGE;
    }
    return DEFAULT_SLIPPAGE;
  } catch (e) {
    return DEFAULT_SLIPPAGE;
  }
}

/**
 * Set slippage tolerance to storage
 * Validates input, converts to number, saves value
 */
function setSlippageTolerance(value) {
  try {
    const num = parseFloat(value);
    const cleaned = isFinite(num) && num > 0 ? num : DEFAULT_SLIPPAGE;
    dbSet(SLIPPAGE_STORAGE_KEY, cleaned);
    return cleaned;
  } catch (e) {
    return DEFAULT_SLIPPAGE;
  }
}

/**
 * Get slippage value as string for API requests
 * Used by DEX collectors to pass to API calls
 */
function getSlippageValueForApi() {
  return String(getSlippageTolerance());
}

/**
 * Get slippage value as decimal (for APIs that need 0.03 format instead of 3)
 * Example: 0.3% → 0.003
 */
function getSlippageAsDecimal() {
  return getSlippageTolerance() / 100;
}

/**
 * Get slippage value in basis points (for APIs that use bps format)
 * Example: 0.3% → 30 bps
 */
function getSlippageInBps() {
  return Math.round(getSlippageTolerance() * 100);
}

// Export to window for global access
if (typeof window !== 'undefined') {
  window.getSlippageTolerance = getSlippageTolerance;
  window.setSlippageTolerance = setSlippageTolerance;
  window.getSlippageValueForApi = getSlippageValueForApi;
  window.getSlippageAsDecimal = getSlippageAsDecimal;
  window.getSlippageInBps = getSlippageInBps;
}
