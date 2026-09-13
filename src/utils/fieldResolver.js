/**
 * Resolves a field's value from a values dictionary.
 *
 * Supports looking up values stored under:
 * - field.id (e.g. numeric 84 or string "84")
 * - field.rawId (e.g. 84 or "84")
 * - field.fieldKey (e.g. "name", "email_id")
 * - field.idString (e.g. "email-id")
 * - field.key
 * - field.label (e.g. "Name", "Email-Id", "address")
 * - Alphanumerically-normalized key match (stripping punctuation/casing: "emailid", "email_id", "email-id")
 */
export const resolveFieldValue = (field, values) => {
  if (!field || !values || typeof values !== "object") return "";

  // 1. Direct candidate keys
  const directCandidates = [
    field.id,
    field.rawId,
    field.rawId != null ? String(field.rawId) : null,
    field.fieldKey,
    field.idString,
    field.key,
    field.label,
  ].filter((k) => k !== undefined && k !== null && String(k).trim() !== "");

  for (const key of directCandidates) {
    if (values[key] !== undefined && values[key] !== null) {
      const val = values[key];
      if (typeof val === "string") return val;
      if (typeof val === "number" || typeof val === "boolean") return val;
      if (Array.isArray(val)) return val;
      if (typeof val === "object") return val;
    }
  }

  // 2. Normalized alphanumeric key matching across all keys in values
  const normalizeKey = (k) => String(k || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const targetKeys = new Set(directCandidates.map(normalizeKey).filter(Boolean));

  if (targetKeys.size > 0) {
    for (const [vk, val] of Object.entries(values)) {
      if (targetKeys.has(normalizeKey(vk))) {
        if (val !== undefined && val !== null) {
          if (typeof val === "string" && val.trim() !== "") return val;
          if (typeof val === "number" || typeof val === "boolean") return val;
          if (Array.isArray(val) && val.length > 0) return val;
          if (typeof val === "object" && Object.keys(val).length > 0) return val;
        }
      }
    }
  }

  return "";
};
