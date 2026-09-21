// First letters of the first two words of a name, upper-cased ("Ada Lovelace" -> "AL").
export const initialsFromName = (name = "") =>
  name.split(" ").filter(Boolean).map((word) => word[0]).join("").slice(0, 2).toUpperCase();
