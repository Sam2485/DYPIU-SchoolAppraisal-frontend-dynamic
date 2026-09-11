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
