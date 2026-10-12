import sql from "@/app/api/utils/sql";
import { 
  getCanonicalReceivedKg, 
  recalculateLot, 
  validateLotBalance, 
  getLotInventoryFromPallets,
  recalculateLotPerformance,
  logMovement 
} from "@/app/api/utils/recalculate";

/**
 * LOT SERVICE - Single source domain layer for lot operations.
 * All new code MUST go through here instead of direct += or scattered updates.
 */

export const LotService = {
  async getCanonicalReceivedKg(lotId) {
    return getCanonicalReceivedKg(lotId);
  },

  async recalculate(lotId) {
    return recalculateLot(lotId);
  },

  async validateBalance(lotId, tolerance = 5) {
    return validateLotBalance(lotId, tolerance);
  },

  async getCurrentInventoryKg(lotId) {
    return getLotInventoryFromPallets(lotId);
  },

  async recalculatePerformance(lotId) {
    return recalculateLotPerformance(lotId);
  },

  /**
   * Log a critical movement. For operations that must never silently fail,
   * pass required: true and the caller must handle rollback on error.
   */
  async logMovement(params, { required = false } = {}) {
    try {
      await logMovement(params);
    } catch (e) {
      if (required) throw e;
      // non-critical: swallow (existing behavior preserved)
    }
  }
};

export default LotService;
