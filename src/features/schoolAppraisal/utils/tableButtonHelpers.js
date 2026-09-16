/**
 * Helper utilities for Dynamic Table Buttons (Repeater Groups) in Appraisal Forms.
 */

/**
 * Safely normalizes tableButtons from section (can be JSON string or array).
 */
export const normalizeTableButtons = (tableButtons) => {
  if (!tableButtons) return [];
  if (Array.isArray(tableButtons)) return tableButtons;
  if (typeof tableButtons === 'string') {
    try {
      const parsed = JSON.parse(tableButtons);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

/**
 * Checks whether a table is assigned to a specific button.
 */
export const isTableAssignedToButton = (table, button) => {
  if (!table || !button || !Array.isArray(button.assignedTableKeys) || button.assignedTableKeys.length === 0) {
    return false;
  }
  const assigned = button.assignedTableKeys.map((k) => String(k).trim().toLowerCase());
  const candidates = [
    table.tableKey,
    table.idString,
    table.id != null ? String(table.id) : null,
    table.title ? table.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') : null,
  ].filter(Boolean).map((k) => String(k).trim().toLowerCase());

  return assigned.some((k) => candidates.includes(k));
};

/**
 * Finds which button (if any) a table is assigned to.
 */
export const findButtonForTable = (table, tableButtons = []) => {
  const buttons = normalizeTableButtons(tableButtons);
  return buttons.find((btn) => isTableAssignedToButton(table, btn)) || null;
};

/**
 * Partitions section tables into:
 * - unassignedTables: permanently visible tables (not assigned to any button)
 * - buttonGroups: [{ button, tables: [...] }] for each button
 */
export const partitionTablesByButtons = (tables = [], tableButtons = []) => {
  const buttons = normalizeTableButtons(tableButtons);
  const arr = Array.isArray(tables) ? tables : [];

  if (!buttons.length) {
    return {
      unassignedTables: arr,
      buttonGroups: [],
    };
  }

  const unassignedTables = [];
  const buttonGroupsMap = new Map();

  buttons.forEach((btn) => {
    buttonGroupsMap.set(btn.id, { button: btn, tables: [] });
  });

  arr.forEach((tbl) => {
    const assignedBtn = buttons.find((btn) => isTableAssignedToButton(tbl, btn));
    if (assignedBtn && buttonGroupsMap.has(assignedBtn.id)) {
      buttonGroupsMap.get(assignedBtn.id).tables.push(tbl);
    } else {
      unassignedTables.push(tbl);
    }
  });

  return {
    unassignedTables,
    buttonGroups: Array.from(buttonGroupsMap.values()),
  };
};

/**
 * Gets the active instances for a button from valuesData and/or tablesData.
 */
export const getActiveInstancesForButton = (button, valuesData = {}, tablesData = {}) => {
  if (!button) return [];
  const instancesKey = `__tb_${button.id}_instances`;
  const rawFromValues = valuesData?.[instancesKey];

  // If instancesKey is defined in valuesData (even if []), it is the authoritative source of truth
  if (rawFromValues !== undefined && rawFromValues !== null) {
    if (Array.isArray(rawFromValues)) {
      return rawFromValues.map((item) => String(item).trim()).filter(Boolean);
    }
    if (typeof rawFromValues === 'string') {
      const trimmed = rawFromValues.trim();
      if (!trimmed) return [];
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => String(item).trim()).filter(Boolean);
        }
      } catch {
        return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
      }
      return [trimmed];
    }
    return [];
  }

  // Fallback discovery from tablesData only when valuesData does not have instancesKey at all
  const instancesSet = new Set();
  if (tablesData && typeof tablesData === 'object') {
    const assignedKeys = (button.assignedTableKeys || []).map((k) => String(k).trim().toLowerCase());
    Object.keys(tablesData).forEach((key) => {
      if (key.includes('__')) {
        const [baseKey, ...rest] = key.split('__');
        const instance = rest.join('__').trim();
        const rows = tablesData[key];
        const hasRows = Array.isArray(rows) ? rows.length > 0 : Boolean(rows);
        if (instance && hasRows && (assignedKeys.length === 0 || assignedKeys.includes(baseKey.toLowerCase()))) {
          instancesSet.add(instance);
        }
      }
    });
  }

  return Array.from(instancesSet);
};

/**
 * Builds a scoped table key: `${tableKey}__${instance}`
 */
export const buildScopedTableKey = (baseKey, instance) => {
  if (!instance) return baseKey;
  return `${baseKey}__${instance}`;
};

/**
 * Resolves rows for a table and instance from tablesData.
 */
export const getScopedTableRows = (tablesData = {}, table = {}, instance = null) => {
  if (!tablesData || typeof tablesData !== 'object') return [];

  const candidateKeys = [
    table.tableKey,
    table.idString,
    table.id != null ? String(table.id) : null,
  ].filter(Boolean);

  if (instance) {
    if (table.scopedKey && Array.isArray(tablesData[table.scopedKey])) {
      return tablesData[table.scopedKey];
    }
    for (const ck of candidateKeys) {
      const scoped = `${ck}__${instance}`;
      if (Array.isArray(tablesData[scoped])) {
        return tablesData[scoped];
      }
    }
    return [];
  }

  // Fallback to unscoped only when instance is not provided or empty
  for (const ck of candidateKeys) {
    if (Array.isArray(tablesData[ck])) {
      return tablesData[ck];
    }
  }

  return [];
};
