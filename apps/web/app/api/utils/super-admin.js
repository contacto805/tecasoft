import { getVerifiedErpUser } from "@/app/api/utils/erp-session-proof";

export const getCurrentUser = getVerifiedErpUser;

export async function isSuperAdmin() {
  const user = await getCurrentUser();
  if (!user) return false;
  return !!(user.is_super_admin || user.admin_role === "superadministrador");
}

export async function requireSuperAdmin() {
  const ok = await isSuperAdmin();
  if (!ok) {
    throw new Error("Solo Superadministrador puede realizar esta acción");
  }
  return true;
}

export function sanitizeForNonSuper(row, isSuper) {
  if (isSuper) return row;
  if (!row) return row;
  const copy = { ...row };
  // Restricted fields for non-supers
  const restricted = [
    "agreed_commission", "agreed_price_per_kg", "show_agreed_price",
    "commission_amount", "fruit_price", "pact_price", "negotiated_price",
    "broker_commission", "margin", "descuento", "condiciones_comerciales",
    "price_per_kg_agreed", "internal_cost", "net_margin"
  ];
  restricted.forEach(k => {
    if (k in copy) copy[k] = null;
  });
  return copy;
}
