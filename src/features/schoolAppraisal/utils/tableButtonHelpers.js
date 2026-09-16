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
 * Derives a clean, normalized section identifier.
 * e.g., 'part_1', 'part_2', 'part_a', 'sec_14'
 */
export const getSectionKey = (section) => {
  if (!section) return '';
  if (section.sectionKey) {
    return String(section.sectionKey).toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/^_+|_+$/g, '');
  }
  if (section.number !== undefined && section.number !== null && String(section.number).trim() !== '') {
    return `part_${String(section.number).toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/^_+|_+$/g, '')}`;
  }
  if (section.id != null) {
    return `sec_${section.id}`;
  }
  if (section.name || section.title) {
    const slug = String(section.name || section.title).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return slug ? slug.slice(0, 30) : '';
  }
  return '';
};

/**
 * Normalizes context role: 'director', 'internal', or 'external'.
 */
export const normalizeContextRole = (context = {}) => {
  if (context?.auditorType) {
    const at = String(context.auditorType).toLowerCase().trim();
    return at.includes('ext') ? 'external' : 'internal';
  }
  if (context?.role) {
    const r = String(context.role).toLowerCase().trim();
    if (r.includes('ext')) return 'external';
    if (r.includes('audit') || r.includes('int')) return 'internal';
    return 'director';
  }
  return '';
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
 * Deconstructs a scoped table key into its components:
 * - role ('director', 'internal', 'external', or '')
 * - instance (e.g. 'SOEMR')
 * - sectionKey (e.g. 'part_1')
 * - baseKey (e.g. 'table_header1')
 */
export const parseScopedTableKey = (key) => {
  if (!key || typeof key !== 'string' || !key.includes('__')) {
    return { role: '', instance: '', sectionKey: '', baseKey: key || '' };
  }
  const parts = key.split('__');
  if (parts.length === 2) {
    // Legacy format: baseKey__instance
    return { role: '', instance: parts[1], sectionKey: '', baseKey: parts[0] };
  }
  if (parts.length === 3) {
    // instance__sectionKey__baseKey
    return { role: '', instance: parts[0], sectionKey: parts[1], baseKey: parts[2] };
  }
  if (parts.length >= 4) {
    // role__instance__sectionKey__baseKey
    return {
      role: parts[0],
      instance: parts[1],
      sectionKey: parts[2],
      baseKey: parts.slice(3).join('__'),
    };
  }
  return { role: '', instance: '', sectionKey: '', baseKey: key };
};

/**
 * Builds a scoped table key unique across role, instance (school/option), part, and table name:
 * Format: `${role}__${instance}__${sectionKey}__${baseKey}`
 * (e.g. 'director__SOEMR__part_1__table_header1' or 'internal__SOEMR__part_2__table_header1')
 */
export const buildScopedTableKey = (baseKey, instance, context = {}) => {
  if (!instance) return baseKey;
  const inst = String(instance).trim();
  const base = String(baseKey || '').trim();

  const ctxObj = typeof context === 'string' ? { role: context } : (context || {});
  const role = normalizeContextRole(ctxObj);
  const secKey = ctxObj?.sectionKey || (ctxObj?.section ? getSectionKey(ctxObj.section) : (ctxObj?.sectionId != null ? `sec_${ctxObj.sectionId}` : ''));

  // If no role or sectionKey, fallback to legacy: `${base}__${inst}`
  if (!role && !secKey) {
    return `${base}__${inst}`;
  }

  const rolePart = role || 'director';
  const secPart = secKey || 'part_1';
  return `${rolePart}__${inst}__${secPart}__${base}`;
};

/**
 * Builds a scoped button instances key for valuesData:
 * Format: `__tb_${role}_${sectionKey}_${button.id}_instances` or legacy `__tb_${button.id}_instances`
 */
export const buildButtonInstancesKey = (button, context = {}) => {
  if (!button?.id) return '__tb_instances';
  const ctxObj = typeof context === 'string' ? { role: context } : (context || {});
  const role = normalizeContextRole(ctxObj);
  const secKey = ctxObj?.sectionKey || (ctxObj?.section ? getSectionKey(ctxObj.section) : (ctxObj?.sectionId != null ? `sec_${ctxObj.sectionId}` : ''));

  if (role || secKey) {
    const rolePart = role || 'director';
    const secPart = secKey || 'part_1';
    return `__tb_${rolePart}_${secPart}_${button.id}_instances`;
  }
  return `__tb_${button.id}_instances`;
};

/**
 * Gets the active instances for a button from valuesData and/or tablesData,
 * with full context isolation between director, internal auditor, and external auditor.
 */
export const getActiveInstancesForButton = (button, valuesData = {}, tablesData = {}, context = {}) => {
  if (!button) return [];

  const ctxObj = typeof context === 'string' ? { role: context } : (context || {});
  const expectedRole = normalizeContextRole(ctxObj);
  const expectedSecKey = ctxObj?.sectionKey || (ctxObj?.section ? getSectionKey(ctxObj.section) : '');

  // 1. Check context-scoped instancesKey in valuesData
  const scopedKey = buildButtonInstancesKey(button, context);
  const rawFromScoped = valuesData?.[scopedKey];
  if (rawFromScoped !== undefined && rawFromScoped !== null) {
    if (Array.isArray(rawFromScoped)) {
      const arr = rawFromScoped.map((item) => String(item).trim()).filter(Boolean);
      if (arr.length > 0) return arr;
    }
    if (typeof rawFromScoped === 'string' && rawFromScoped.trim()) {
      try {
        const parsed = JSON.parse(rawFromScoped.trim());
        if (Array.isArray(parsed)) {
          const arr = parsed.map((item) => String(item).trim()).filter(Boolean);
          if (arr.length > 0) return arr;
        }
      } catch {
        const arr = rawFromScoped.split(',').map((s) => s.trim()).filter(Boolean);
        if (arr.length > 0) return arr;
      }
    }
  }

  // 2. Check legacy instancesKey in valuesData (fallback)
  const legacyKey = `__tb_${button.id}_instances`;
  const rawFromLegacy = valuesData?.[legacyKey];
  if (rawFromLegacy !== undefined && rawFromLegacy !== null) {
    if (Array.isArray(rawFromLegacy)) {
      const arr = rawFromLegacy.map((item) => String(item).trim()).filter(Boolean);
      if (arr.length > 0) return arr;
    }
    if (typeof rawFromLegacy === 'string' && rawFromLegacy.trim()) {
      try {
        const parsed = JSON.parse(rawFromLegacy.trim());
        if (Array.isArray(parsed)) {
          const arr = parsed.map((item) => String(item).trim()).filter(Boolean);
          if (arr.length > 0) return arr;
        }
      } catch {
        const arr = rawFromLegacy.split(',').map((s) => s.trim()).filter(Boolean);
        if (arr.length > 0) return arr;
      }
    }
  }

  // 3. Check any other key in valuesData matching button id
  if (valuesData && typeof valuesData === 'object') {
    const matchingKey = Object.keys(valuesData).find((k) =>
      k.startsWith('__tb_') &&
      k.endsWith('_instances') &&
      k.includes(`_${button.id}_`)
    );
    if (matchingKey && Array.isArray(valuesData[matchingKey]) && valuesData[matchingKey].length > 0) {
      return valuesData[matchingKey].map((item) => String(item).trim()).filter(Boolean);
    }
  }

  // 4. Fallback discovery from tablesData (inspecting non-empty rows)
  const instancesSet = new Set();
  if (tablesData && typeof tablesData === 'object') {
    const assignedKeys = (button.assignedTableKeys || []).map((k) => String(k).trim().toLowerCase());
    Object.keys(tablesData).forEach((key) => {
      if (!key.includes('__')) return;
      const rows = tablesData[key];
      const hasRows = Array.isArray(rows) ? rows.length > 0 : Boolean(rows);
      if (!hasRows) return;

      const parsed = parseScopedTableKey(key);
      const instance = parsed.instance;
      if (!instance) return;

      // Filter by role if both are specified
      if (expectedRole && parsed.role && expectedRole !== parsed.role) {
        return;
      }
      // If expected role is external, never inherit internal auditor or director data
      if (expectedRole === 'external' && (!parsed.role || parsed.role !== 'external')) {
        return;
      }
      // If expected role is internal, never inherit external auditor data
      if (expectedRole === 'internal' && parsed.role === 'external') {
        return;
      }

      // Filter by sectionKey if both are specified
      if (expectedSecKey && parsed.sectionKey && expectedSecKey !== parsed.sectionKey) {
        return;
      }

      const baseLower = parsed.baseKey.toLowerCase();
      const baseNoTable = baseLower.replace(/^table_/, '');
      const isMatch =
        assignedKeys.length === 0 ||
        assignedKeys.includes(baseLower) ||
        assignedKeys.includes(baseNoTable) ||
        assignedKeys.some((ak) => ak.replace(/^table_/, '') === baseNoTable);

      if (isMatch) {
        instancesSet.add(instance);
      }
    });
  }

  return Array.from(instancesSet);
};

/**
 * Resolves rows for a table and instance from tablesData.
 * Checks context-scoped keys first, followed by legacy keys and fuzzy match.
 */
export const getScopedTableRows = (tablesData = {}, table = {}, instance = null, context = {}) => {
  if (!tablesData || typeof tablesData !== 'object') return [];

  const candidateKeys = [
    table.tableKey,
    table.idString,
    table.id != null ? String(table.id) : null,
    table.id != null ? `table_${table.id}` : null,
  ].filter(Boolean);

  if (table.tableKey && String(table.tableKey).startsWith('table_')) {
    candidateKeys.push(String(table.tableKey).replace(/^table_/, ''));
  }
  if (table.title) {
    const titleKey = table.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (titleKey && !candidateKeys.includes(titleKey)) {
      candidateKeys.push(titleKey);
    }
  }

  if (instance) {
    // 1. If table already has an exact scopedKey set on it
    if (table.scopedKey && Array.isArray(tablesData[table.scopedKey]) && tablesData[table.scopedKey].length > 0) {
      return tablesData[table.scopedKey];
    }

    // 2. Check context-scoped unique key: ${role}__${instance}__${secKey}__${ck}
    for (const ck of candidateKeys) {
      const scoped = buildScopedTableKey(ck, instance, context);
      if (Array.isArray(tablesData[scoped]) && tablesData[scoped].length > 0) {
        return tablesData[scoped];
      }
    }

    // 3. Check semi-scoped key without role: ${instance}__${secKey}__${ck}
    const ctxObj = typeof context === 'string' ? { role: context } : (context || {});
    const secKey = ctxObj?.sectionKey || (ctxObj?.section ? getSectionKey(ctxObj.section) : '');
    if (secKey) {
      for (const ck of candidateKeys) {
        const semiScoped = `${instance}__${secKey}__${ck}`;
        if (Array.isArray(tablesData[semiScoped]) && tablesData[semiScoped].length > 0) {
          return tablesData[semiScoped];
        }
      }
    }

    // 4. Legacy format: ${ck}__${instance}
    for (const ck of candidateKeys) {
      const legacyScoped = `${ck}__${instance}`;
      if (Array.isArray(tablesData[legacyScoped]) && tablesData[legacyScoped].length > 0) {
        return tablesData[legacyScoped];
      }
    }

    // 5. Reversed legacy format: ${instance}__${ck}
    for (const ck of candidateKeys) {
      const revScoped = `${instance}__${ck}`;
      if (Array.isArray(tablesData[revScoped]) && tablesData[revScoped].length > 0) {
        return tablesData[revScoped];
      }
    }

    // 6. Case-insensitive search across all keys in tablesData
    const entries = Object.entries(tablesData);
    const expectedRole = normalizeContextRole(ctxObj);
    const instLower = String(instance).toLowerCase().trim();

    const match = entries.find(([k, rows]) => {
      if (!Array.isArray(rows) || rows.length === 0) return false;
      const parsed = parseScopedTableKey(k);
      if (parsed.instance.toLowerCase().trim() !== instLower) return false;

      // Don't leak external to internal or vice-versa
      if (expectedRole === 'external' && parsed.role === 'internal') return false;
      if (expectedRole === 'internal' && parsed.role === 'external') return false;

      const baseLower = parsed.baseKey.toLowerCase().trim();
      const baseNoTable = baseLower.replace(/^table_/, '');
      return candidateKeys.some((ck) => {
        const ckLower = String(ck).toLowerCase().trim();
        const ckNoTable = ckLower.replace(/^table_/, '');
        return ckLower === baseLower || ckNoTable === baseNoTable;
      });
    });

    if (match && Array.isArray(match[1])) {
      return match[1];
    }

    // Empty array if key exists but is empty
    if (table.scopedKey && Array.isArray(tablesData[table.scopedKey])) {
      return tablesData[table.scopedKey];
    }
    for (const ck of candidateKeys) {
      const scoped = buildScopedTableKey(ck, instance, context);
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
