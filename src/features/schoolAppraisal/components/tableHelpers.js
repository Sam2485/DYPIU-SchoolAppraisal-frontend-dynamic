//for detecting if a column is a serial number column, and for adding a serial number column if not present
export const serialColumnFor = (columns = []) =>
  (Array.isArray(columns) ? columns : []).find((column) => column && /^(sr\.?\s*no\.?|s\.?no|sn|sl\.?\s*no\.?)$/i.test(String(column).trim()));

export const columnsWithSerial = (columns = []) => {
  const arr = Array.isArray(columns) ? columns : [];
  if (serialColumnFor(arr)) return arr;
  return ["Sr No", ...arr];
};

export const emptyRowFor = (columns = []) =>
  columnsWithSerial(columns).reduce((row, column) => {
    row[column] = "";
    return row;
  }, {});

export const numberedRowFor = (columns = [], index = 0) => {
  const row = emptyRowFor(columns);
  const serialColumn = serialColumnFor(Object.keys(row));
  if (serialColumn) row[serialColumn] = String(index + 1);
  return row;
};

export const withSerialNumbers = (columns = [], rows = []) => {
  const normalizedColumns = columnsWithSerial(columns);
  const serialColumn = serialColumnFor(normalizedColumns) || "Sr No";

  return (Array.isArray(rows) ? rows : []).map((row, index) => {
    const rowSerialCol = serialColumnFor(Object.keys(row || {})) || serialColumn;
    return {
      ...numberedRowFor(columns, index),
      ...row,
      [rowSerialCol]: String(index + 1),
      ...(serialColumn !== rowSerialCol ? { [serialColumn]: String(index + 1) } : {}),
    };
  });
};

export const findFieldForColumn = (column, table = {}) => {
  if (!table || !Array.isArray(table.fields)) return null;
  const colStr = String(column || "").trim().toLowerCase();
  return table.fields.find((f) => {
    if (!f) return false;
    const label = String(f.label || "").trim().toLowerCase();
    const key = String(f.fieldKey || f.key || "").trim().toLowerCase();
    const id = String(f.id || "").trim().toLowerCase();
    const idString = String(f.idString || "").trim().toLowerCase();
    return label === colStr || key === colStr || id === colStr || idString === colStr;
  });
};

export const isAttachmentColumn = (column, table = {}) => {
  if (!column) return false;
  if (table?.urlColumns?.includes(column)) return false;
  const field = findFieldForColumn(column, table);
  if (field) {
    const fieldType = String(field.fieldType || field.type || "").toUpperCase();
    if (fieldType === "FILE" || fieldType === "ATTACHMENT" || fieldType === "DOCUMENT") return true;
    if (["TEXT", "TEXTAREA", "NUMBER", "DATE", "SELECT", "RADIO", "CHECKBOX"].includes(fieldType)) return false;
  }
  if (table?.fileColumns?.includes(column) || table?.attachmentColumns?.includes(column)) return true;
  const colClean = String(column).trim().toLowerCase();
  // Columns whose titles indicate plain textual/numeric content should never be treated as attachment columns
  if (/\b(name|title|description|particular|particulars|category|topic|reason|type|status|remark|remarks|feedback|count|number|no|code|date|year)\b/i.test(colClean)) {
    return false;
  }
  return /\b(link|proof|attachment|document|mom|attach|file|upload)\b/i.test(colClean);
};

export const isAttachmentField = (field = {}) => {
  if (!field) return false;
  const rawType = String(field.fieldType || field.type || "").trim().toUpperCase();
  if (rawType === "FILE" || rawType === "ATTACHMENT" || rawType === "DOCUMENT") return true;
  if (["TEXT", "TEXTAREA", "NUMBER", "DATE", "SELECT", "RADIO", "CHECKBOX"].includes(rawType)) return false;
  const label = String(field.label || field.fieldKey || field.id || "").trim().toLowerCase();
  if (/\b(name|title|description|particular|particulars|category|topic|reason|type|status|remark|remarks|feedback|count|number|no|code|date|year)\b/i.test(label)) {
    return false;
  }
  return /\b(link|proof|attachment|document|mom|attach|file|upload)\b/i.test(label);
};
