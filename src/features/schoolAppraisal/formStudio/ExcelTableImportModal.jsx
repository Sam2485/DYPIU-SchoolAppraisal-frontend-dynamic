import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { importBatchTables } from './formStudioApi';

const FIELD_TYPES = [
  { value: 'TEXT', label: '🔤 Text (Single Line)' },
  { value: 'NUMBER', label: '🔢 Number (Numeric)' },
  { value: 'DATE', label: '📅 Date Picker' },
  { value: 'TEXTAREA', label: '📝 Textarea (Multi-line)' },
  { value: 'ATTACHMENT', label: '📎 Attachment / File Upload' },
  { value: 'SELECT', label: '🔽 Dropdown (Select)' },
  { value: 'EMAIL', label: '✉️ Email' },
  { value: 'URL', label: '🔗 Web URL' },
];

const slugify = (text) => {
  if (!text) return 'field_' + Math.floor(Math.random() * 10000);
  return text
    .toString()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 50);
};

const detectFieldType = (headerText) => {
  if (!headerText) return 'TEXT';
  const clean = headerText.toLowerCase().trim();

  // Attachment / Proof / Document (handles typos like 'Attachmet', 'Certif', 'Upload')
  if (/proof|doc|pdf|file|attach|link|certif|upload|letter|receipt/i.test(clean)) {
    return 'ATTACHMENT';
  }

  // Date
  if (/date|dob|doj|period|month|year|session|from|to/i.test(clean)) {
    return 'DATE';
  }

  // Number / Score / ID numbers / Counts
  if (
    /count|score|amount|intake|admitted|number|num\b|no\b|roll\s*no|marks|percentage|cgpa|sanctioned|funds|grant|days|cost|fee|inr|stipend|credits|capacity|qty|quantity/i.test(
      clean
    )
  ) {
    // If it's pure Sr No, treat as text
    if (/^(sr\.?\s*no\.?|sn|s\.no\.?|no\.?)$/i.test(clean)) {
      return 'TEXT';
    }
    return 'NUMBER';
  }

  // Textarea
  if (/remark|description|summary|brief|abstract|detail|comment|objective|scope/i.test(clean)) {
    return 'TEXTAREA';
  }

  // Select / Dropdown
  if (/status|category|level|gender|mode|type|cadre/i.test(clean)) {
    return 'SELECT';
  }

  return 'TEXT';
};

// Parser engine that supports:
// 1. Single sheet with multiple table blocks (Title row -> Header row -> blank row -> Next Title row)
// 2. Multi-sheet workbooks (1 tab = 1 table)
const parseTablesFromWorksheet = (ws, sheetName, baseIdx, sectionKey = '') => {
  const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (!rawData || rawData.length === 0) return [];

  const foundTables = [];
  const seenTableKeys = new Set();
  let pendingTitle = null;
  let i = 0;

  const generateUniqueTableKey = (title) => {
    const baseSlug = slugify(title);
    let candidate = baseSlug;
    if (seenTableKeys.has(candidate)) {
      candidate = sectionKey ? `${slugify(sectionKey)}_${baseSlug}` : `${baseSlug}_tbl`;
    }
    let suffix = 1;
    while (seenTableKeys.has(candidate)) {
      candidate = `${baseSlug}_${++suffix}`;
    }
    seenTableKeys.add(candidate);
    return candidate;
  };

  while (i < rawData.length) {
    const row = rawData[i];
    // Filter non-empty cells
    const nonEmptyCells = row
      .map((c, idx) => ({ val: String(c != null ? c : '').trim(), idx }))
      .filter((cell) => cell.val.length > 0);

    if (nonEmptyCells.length === 0) {
      // Empty spacer row
      i++;
      continue;
    }

    // Check if this row is a Table Title (single cell, or first cell has text while others are empty)
    if (nonEmptyCells.length === 1 && i + 1 < rawData.length) {
      const nextRow = rawData[i + 1];
      const nextNonEmpty = nextRow
        .map((c) => String(c != null ? c : '').trim())
        .filter((val) => val.length > 0);

      // If next row has 2 or more columns, then this current row is definitely a Table Title!
      if (nextNonEmpty.length >= 2) {
        pendingTitle = nonEmptyCells[0].val;
        i++;
        continue;
      }
    }

    // If this row has 2 or more column headers, treat as Column Headers row
    if (nonEmptyCells.length >= 2) {
      const tableTitle =
        pendingTitle ||
        (foundTables.length === 0 ? sheetName : `${sheetName} - Table ${foundTables.length + 1}`);
      pendingTitle = null; // consume title

      const fields = [];
      const seenColKeys = new Set();
      nonEmptyCells.forEach((cell, colIdx) => {
        const rawLabel = cell.val;
        const detectedType = detectFieldType(rawLabel);
        const isSrNo = /^(sr\.?\s*no\.?|sn|s\.no\.?|no\.?)$/i.test(rawLabel);
        let colKey = slugify(rawLabel);
        let colSuffix = 1;
        while (seenColKeys.has(colKey)) {
          colKey = `${slugify(rawLabel)}_${++colSuffix}`;
        }
        seenColKeys.add(colKey);

        fields.push({
          id: `temp_${baseIdx}_${foundTables.length}_${colIdx}`,
          label: rawLabel,
          fieldKey: colKey,
          fieldType: detectedType,
          isRequired: !isSrNo && !/optional|proof|remark|upload|attach/i.test(rawLabel),
          placeholder: `Enter ${rawLabel}`,
          optionsString: detectedType === 'SELECT' ? 'Option 1, Option 2, Option 3' : '',
        });
      });

      if (fields.length > 0) {
        const uniqueKey = generateUniqueTableKey(tableTitle);
        foundTables.push({
          id: `tbl_${baseIdx}_${foundTables.length}`,
          title: tableTitle,
          tableKey: uniqueKey,
          isRepeatable: true,
          showTitle: true,
          fields: fields,
        });
      }

      // Skip past any sample data rows following this table header until an empty row or next title
      i++;
      while (i < rawData.length) {
        const nextR = rawData[i];
        const nextNonEmpty = nextR
          .map((c) => String(c != null ? c : '').trim())
          .filter((val) => val.length > 0);

        if (nextNonEmpty.length === 0) {
          // Empty row ends table block
          i++;
          break;
        }

        // If next row is a potential new single-cell title, break so outer loop processes it
        if (nextNonEmpty.length === 1 && i + 1 < rawData.length) {
          const lookaheadRow = rawData[i + 1];
          const lookaheadNonEmpty = lookaheadRow
            .map((c) => String(c != null ? c : '').trim())
            .filter((val) => val.length > 0);
          if (lookaheadNonEmpty.length >= 2) {
            break;
          }
        }

        // Otherwise it's a data row, skip it
        i++;
      }
      continue;
    }

    i++;
  }

  // Fallback: If nothing was detected via multi-block, but sheet has data, extract Row 1 as headers
  if (foundTables.length === 0) {
    let headerRowIndex = 0;
    for (let r = 0; r < Math.min(rawData.length, 5); r++) {
      const nonEmpties = rawData[r].filter((c) => String(c != null ? c : '').trim().length > 0);
      if (nonEmpties.length > 0) {
        headerRowIndex = r;
        break;
      }
    }
    const headerRow = rawData[headerRowIndex] || [];
    const fields = [];
    const seenColKeys = new Set();
    headerRow.forEach((col, colIdx) => {
      const rawLabel = String(col || '').trim();
      if (!rawLabel) return;
      const detectedType = detectFieldType(rawLabel);
      const isSrNo = /^(sr\.?\s*no\.?|sn|s\.no\.?|no\.?)$/i.test(rawLabel);
      let colKey = slugify(rawLabel);
      let colSuffix = 1;
      while (seenColKeys.has(colKey)) {
        colKey = `${slugify(rawLabel)}_${++colSuffix}`;
      }
      seenColKeys.add(colKey);

      fields.push({
        id: `temp_${baseIdx}_${colIdx}`,
        label: rawLabel,
        fieldKey: colKey,
        fieldType: detectedType,
        isRequired: !isSrNo && !/optional|proof|remark|upload|attach/i.test(rawLabel),
        placeholder: `Enter ${rawLabel}`,
        optionsString: detectedType === 'SELECT' ? 'Option 1, Option 2, Option 3' : '',
      });
    });

    if (fields.length > 0) {
      const fallbackTitle = sheetName.trim() || `Table ${baseIdx + 1}`;
      const uniqueKey = generateUniqueTableKey(fallbackTitle);
      foundTables.push({
        id: `tbl_${baseIdx}_0`,
        title: fallbackTitle,
        tableKey: uniqueKey,
        isRepeatable: true,
        showTitle: true,
        fields: fields,
      });
    }
  }

  return foundTables;
};

export const ExcelTableImportModal = ({
  show,
  section,
  onClose,
  onImportSuccess,
}) => {
  const [file, setFile] = useState(null);
  const [parsedTables, setParsedTables] = useState([]);
  const [activeTableIndex, setActiveTableIndex] = useState(0);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);
  const [showFormatGuide, setShowFormatGuide] = useState(false);
  const fileInputRef = useRef(null);

  if (!show || !section) return null;

  // Generate and download a sample excel template for user convenience
  const handleDownloadSampleTemplate = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Single Sheet with Multiple Tables (Exact user layout)
      const wsSingleSheetData = [
        ['Table header1'],
        ['Sr. no', 'Name', 'Roll no', 'Number', 'Attachment'],
        ['', '', '', '', ''],
        [''],
        ['Table header2'],
        ['Sr.no', 'Paper Id', 'Paper Name', 'Writer Name', 'Writer Contact', 'Upload Attachment'],
        ['', '', '', '', '', ''],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(wsSingleSheetData);
      XLSX.utils.book_append_sheet(wb, ws1, 'All_Tables_Single_Sheet');

      // Sheet 2: Tab-based Format - Research Publications
      const ws2Data = [
        ['Sr No', 'Paper Title', 'Journal / Conference Name', 'ISSN / ISBN', 'Publication Date', 'Impact Factor', 'Upload Proof PDF'],
        ['1', 'Deep Learning in Health Informatics', 'IEEE Transactions on AI', '1234-5678', '2025-05-15', '4.5', ''],
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
      XLSX.utils.book_append_sheet(wb, ws2, 'Research Publications');

      // Sheet 3: Tab-based Format - Workshops & FDPs
      const ws3Data = [
        ['Sr No', 'Program Title', 'Organizing Institute', 'From Date', 'To Date', 'Duration (Days)', 'Certificate Attachment'],
        ['1', 'AI & Machine Learning Bootcamp', 'IIT Bombay', '2025-06-01', '2025-06-07', '7', ''],
      ];
      const ws3 = XLSX.utils.aoa_to_sheet(ws3Data);
      XLSX.utils.book_append_sheet(wb, ws3, 'Workshops & FDPs');

      XLSX.writeFile(wb, `Appraisal_Table_Template_Section_${section.number || 'A'}.xlsx`);
    } catch (err) {
      console.error('Failed to generate template:', err);
      alert('Failed to generate template: ' + err.message);
    }
  };

  // Handle file selection and parsing
  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setError(null);
    parseExcel(selected);
  };

  const parseExcel = (fileObj) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });

        const tables = [];
        const secIdentifier = section.sectionKey || section.title || '';

        wb.SheetNames.forEach((sheetName, sheetIdx) => {
          const ws = wb.Sheets[sheetName];
          const extracted = parseTablesFromWorksheet(ws, sheetName, sheetIdx, secIdentifier);
          if (extracted && extracted.length > 0) {
            tables.push(...extracted);
          }
        });

        if (tables.length === 0) {
          setError('No valid column headers found in the uploaded Excel file. Please check the format guide.');
        } else {
          setParsedTables(tables);
          setActiveTableIndex(0);
        }
      } catch (err) {
        console.error('Error parsing Excel:', err);
        setError('Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file.');
      }
    };
    reader.readAsBinaryString(fileObj);
  };

  // Table manipulation handlers
  const handleUpdateTableTitle = (tblIdx, title) => {
    const updated = [...parsedTables];
    const otherKeys = new Set(updated.filter((_, idx) => idx !== tblIdx).map((t) => t.tableKey).filter(Boolean));
    const baseKey = slugify(title);
    let candidate = baseKey;
    if (otherKeys.has(candidate)) {
      candidate = `${slugify(section.sectionKey || section.title || 'sec')}_${baseKey}`;
    }
    let suffix = 1;
    while (otherKeys.has(candidate)) {
      candidate = `${baseKey}_${++suffix}`;
    }

    updated[tblIdx].title = title;
    updated[tblIdx].tableKey = candidate;
    setParsedTables(updated);
  };

  const handleUpdateTableKey = (tblIdx, key) => {
    const updated = [...parsedTables];
    updated[tblIdx].tableKey = key;
    setParsedTables(updated);
  };

  const handleToggleTableRepeatable = (tblIdx) => {
    const updated = [...parsedTables];
    updated[tblIdx].isRepeatable = !updated[tblIdx].isRepeatable;
    setParsedTables(updated);
  };

  const handleDeleteTable = (tblIdx) => {
    if (parsedTables.length <= 1) {
      alert('You must have at least one table.');
      return;
    }
    const updated = parsedTables.filter((_, idx) => idx !== tblIdx);
    setParsedTables(updated);
    setActiveTableIndex(Math.max(0, activeTableIndex - 1));
  };

  // Column manipulation handlers
  const handleUpdateField = (tblIdx, fIdx, fieldProp, value) => {
    const updated = [...parsedTables];
    updated[tblIdx].fields[fIdx][fieldProp] = value;
    if (fieldProp === 'label') {
      updated[tblIdx].fields[fIdx].fieldKey = slugify(value);
    }
    setParsedTables(updated);
  };

  const handleDeleteField = (tblIdx, fIdx) => {
    const updated = [...parsedTables];
    if (updated[tblIdx].fields.length <= 1) {
      alert('Each table must have at least one column.');
      return;
    }
    updated[tblIdx].fields = updated[tblIdx].fields.filter((_, idx) => idx !== fIdx);
    setParsedTables(updated);
  };

  const handleAddColumn = (tblIdx) => {
    const updated = [...parsedTables];
    const newIndex = updated[tblIdx].fields.length + 1;
    updated[tblIdx].fields.push({
      id: 'temp_new_' + Date.now(),
      label: `New Column ${newIndex}`,
      fieldKey: `new_column_${newIndex}`,
      fieldType: 'TEXT',
      isRequired: false,
      placeholder: '',
      optionsString: '',
    });
    setParsedTables(updated);
  };

  // Execute Batch Import
  const handleExecuteImport = async () => {
    if (parsedTables.length === 0) {
      alert('No tables to import.');
      return;
    }

    setImporting(true);
    setError(null);

    try {
      const usedKeys = new Set();
      const sanitizedTables = parsedTables.map((t) => {
        let key = slugify(t.tableKey || t.title || 'tbl');
        if (usedKeys.has(key)) {
          key = `${slugify(section.sectionKey || section.title || 'sec')}_${key}`;
        }
        let suffix = 1;
        while (usedKeys.has(key)) {
          key = `${slugify(t.tableKey || t.title || 'tbl')}_${++suffix}`;
        }
        usedKeys.add(key);

        return {
          title: t.title,
          tableKey: key,
          isRepeatable: t.isRepeatable,
          showTitle: t.showTitle,
          fields: t.fields.map((f, idx) => ({
            label: f.label,
            fieldKey: f.fieldKey,
            fieldType: f.fieldType,
            isRequired: f.isRequired,
            placeholder: f.placeholder,
            optionsString: f.fieldType === 'SELECT' ? f.optionsString : null,
            displayOrder: idx + 1,
          })),
        };
      });

      const payload = {
        tables: sanitizedTables,
      };

      await importBatchTables(section.id, payload);
      if (onImportSuccess) {
        onImportSuccess();
      }
      onClose();
    } catch (err) {
      console.error('Batch import failed:', err);
      setError(err.response?.data?.message || err.message || 'Failed to import tables.');
    } finally {
      setImporting(false);
    }
  };

  const activeTable = parsedTables[activeTableIndex];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: '20px',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '1080px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#f8fafc',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: '#dbeafe',
                  color: '#1e40af',
                }}
              >
                Section {section.number || 'A'}
              </span>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                📥 Import Tables from Excel
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b' }}>
              Upload an Excel sheet to automatically create tables with column headers and configure field types.
            </p>
          </div>
          <button
            type="button"
            style={{
              border: 'none',
              background: '#f1f5f9',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              fontSize: '16px',
              color: '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {error && (
            <div
              style={{
                padding: '12px 16px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#b91c1c',
                fontSize: '13px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <span>⚠️</span>
              <span style={{ flex: 1 }}>{error}</span>
            </div>
          )}

          {/* Upload & Template Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '14px',
              background: '#f1f5f9',
              padding: '16px 20px',
              borderRadius: '12px',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#2563eb',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 4px rgba(37,99,235,0.2)',
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                📁 {file ? 'Change Excel File' : 'Choose Excel File (.xlsx)'}
              </button>
              {file && (
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                  📄 {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                }}
                onClick={() => setShowFormatGuide(!showFormatGuide)}
              >
                {showFormatGuide ? 'Hide Format Guide ▲' : '📖 View Excel Format Guide ▼'}
              </button>
              <button
                type="button"
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid #86efac',
                  background: '#f0fdf4',
                  color: '#15803d',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                onClick={handleDownloadSampleTemplate}
                title="Download a pre-formatted Excel template with sample tables and columns"
              >
                📥 Download Basic Excel Template
              </button>
            </div>
          </div>

          {/* Visual Format Guide Card (Toggleable or when empty) */}
          {(showFormatGuide || parsedTables.length === 0) && (
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '18px 20px',
                marginBottom: '24px',
              }}
            >
              <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📋 How to Format Your Excel File (Both Formats Supported)</span>
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                {/* Format 1 */}
                <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, padding: '2px 6px', background: '#dbeafe', color: '#1e40af', borderRadius: '4px' }}>
                      Format A (Your Format)
                    </span>
                    <strong style={{ fontSize: '12.5px', color: '#0f172a' }}>Single Sheet with Multiple Tables</strong>
                  </div>
                  <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#64748b' }}>
                    Put table titles in single rows, followed directly by column headers and separated by blank rows:
                  </p>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', background: '#f8fafc', border: '1px solid #e2e8f0', fontFamily: 'monospace' }}>
                    <tbody>
                      <tr style={{ background: '#e0f2fe', fontWeight: 'bold' }}>
                        <td colSpan={4} style={{ padding: '4px 8px', border: '1px solid #cbd5e1' }}>Table header1</td>
                      </tr>
                      <tr style={{ background: '#f1f5f9', fontWeight: 'bold' }}>
                        <td style={{ padding: '4px 6px', border: '1px solid #cbd5e1' }}>Sr. no</td>
                        <td style={{ padding: '4px 6px', border: '1px solid #cbd5e1' }}>Name</td>
                        <td style={{ padding: '4px 6px', border: '1px solid #cbd5e1' }}>Roll no</td>
                        <td style={{ padding: '4px 6px', border: '1px solid #cbd5e1' }}>Attachment</td>
                      </tr>
                      <tr>
                        <td colSpan={4} style={{ padding: '4px 8px', color: '#94a3b8', fontStyle: 'italic', border: '1px solid #cbd5e1' }}>[empty row]</td>
                      </tr>
                      <tr style={{ background: '#e0f2fe', fontWeight: 'bold' }}>
                        <td colSpan={4} style={{ padding: '4px 8px', border: '1px solid #cbd5e1' }}>Table header2</td>
                      </tr>
                      <tr style={{ background: '#f1f5f9', fontWeight: 'bold' }}>
                        <td style={{ padding: '4px 6px', border: '1px solid #cbd5e1' }}>Sr.no</td>
                        <td style={{ padding: '4px 6px', border: '1px solid #cbd5e1' }}>Paper Id</td>
                        <td style={{ padding: '4px 6px', border: '1px solid #cbd5e1' }}>Writer Name</td>
                        <td style={{ padding: '4px 6px', border: '1px solid #cbd5e1' }}>Attachment</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Format 2 */}
                <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, padding: '2px 6px', background: '#fef3c7', color: '#92400e', borderRadius: '4px' }}>
                      Format B
                    </span>
                    <strong style={{ fontSize: '12.5px', color: '#0f172a' }}>Multi-Sheet Workbook (Tabs)</strong>
                  </div>
                  <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#64748b' }}>
                    Each sheet tab is named after the Table (e.g. <em>Research Papers</em>), and Row 1 contains column headers:
                  </p>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', background: '#f8fafc', border: '1px solid #e2e8f0', fontFamily: 'monospace' }}>
                    <tbody>
                      <tr style={{ background: '#fef3c7', fontWeight: 'bold' }}>
                        <td colSpan={3} style={{ padding: '4px 8px', border: '1px solid #cbd5e1' }}>Sheet Tab: "Research Publications"</td>
                      </tr>
                      <tr style={{ background: '#f1f5f9', fontWeight: 'bold' }}>
                        <td style={{ padding: '4px 6px', border: '1px solid #cbd5e1' }}>Sr No</td>
                        <td style={{ padding: '4px 6px', border: '1px solid #cbd5e1' }}>Paper Title</td>
                        <td style={{ padding: '4px 6px', border: '1px solid #cbd5e1' }}>Upload Proof PDF</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Parsed Tables & Column Configurator */}
          {parsedTables.length > 0 ? (
            <div>
              {/* Sheet/Table Navigation Tabs */}
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  borderBottom: '2px solid #e2e8f0',
                  paddingBottom: '2px',
                  marginBottom: '20px',
                  overflowX: 'auto',
                }}
              >
                {parsedTables.map((tbl, idx) => (
                  <button
                    key={tbl.id || idx}
                    type="button"
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px 8px 0 0',
                      border: 'none',
                      background: activeTableIndex === idx ? '#2563eb' : '#f8fafc',
                      color: activeTableIndex === idx ? '#fff' : '#475569',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap',
                    }}
                    onClick={() => setActiveTableIndex(idx)}
                  >
                    <span>📊 {tbl.title || `Table ${idx + 1}`}</span>
                    <span
                      style={{
                        fontSize: '10.5px',
                        padding: '1px 6px',
                        borderRadius: '10px',
                        background: activeTableIndex === idx ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                        color: activeTableIndex === idx ? '#fff' : '#334155',
                      }}
                    >
                      {tbl.fields?.length || 0} cols
                    </span>
                  </button>
                ))}
              </div>

              {/* Active Table Details Form */}
              {activeTable && (
                <div
                  style={{
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '20px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                      gap: '16px',
                      marginBottom: '20px',
                      paddingBottom: '16px',
                      borderBottom: '1px solid #e2e8f0',
                    }}
                  >
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                        Table Title:
                      </label>
                      <input
                        type="text"
                        value={activeTable.title}
                        onChange={(e) => handleUpdateTableTitle(activeTableIndex, e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13px',
                          fontWeight: 600,
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                        Table Key (JSON Key):
                      </label>
                      <input
                        type="text"
                        value={activeTable.tableKey}
                        onChange={(e) => handleUpdateTableKey(activeTableIndex, e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13px',
                          fontFamily: 'monospace',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingTop: '22px' }}>
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '12.5px',
                          fontWeight: 650,
                          color: '#1e293b',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={activeTable.isRepeatable}
                          onChange={() => handleToggleTableRepeatable(activeTableIndex)}
                          style={{ cursor: 'pointer' }}
                        />
                        <span>Dynamic Rows (Multi-row table)</span>
                      </label>

                      {parsedTables.length > 1 && (
                        <button
                          type="button"
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: '1px solid #fecaca',
                            background: '#fff',
                            color: '#b91c1c',
                            fontWeight: 600,
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                          onClick={() => handleDeleteTable(activeTableIndex)}
                        >
                          🗑️ Delete Table
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Columns Definition Table */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ margin: 0, fontSize: '14.5px', fontWeight: 800, color: '#0f172a' }}>
                      ⚙️ Column Field Types & Rules ({activeTable.fields?.length || 0} Columns)
                    </h4>
                    <button
                      type="button"
                      style={{
                        padding: '5px 12px',
                        borderRadius: '6px',
                        border: '1px solid #93c5fd',
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                      onClick={() => handleAddColumn(activeTableIndex)}
                    >
                      + Add Column
                    </button>
                  </div>

                  <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                          <th style={{ padding: '10px 12px', width: '40px', color: '#64748b' }}>#</th>
                          <th style={{ padding: '10px 12px', width: '28%', color: '#334155', fontWeight: 700 }}>Column Header Label</th>
                          <th style={{ padding: '10px 12px', width: '26%', color: '#334155', fontWeight: 700 }}>Data Field Type</th>
                          <th style={{ padding: '10px 12px', width: '28%', color: '#334155', fontWeight: 700 }}>Options / Notes</th>
                          <th style={{ padding: '10px 12px', width: '80px', textAlign: 'center', color: '#334155', fontWeight: 700 }}>Req?</th>
                          <th style={{ padding: '10px 12px', width: '50px', textAlign: 'center' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeTable.fields?.map((field, fIdx) => (
                          <tr key={field.id || fIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 12px', color: '#94a3b8', fontWeight: 600, fontSize: '12px' }}>
                              {fIdx + 1}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <input
                                type="text"
                                value={field.label}
                                onChange={(e) => handleUpdateField(activeTableIndex, fIdx, 'label', e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '12.5px',
                                  fontWeight: 600,
                                }}
                              />
                              <small style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: '11px', display: 'block', marginTop: '2px' }}>
                                key: {field.fieldKey}
                              </small>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <select
                                value={field.fieldType}
                                onChange={(e) => handleUpdateField(activeTableIndex, fIdx, 'fieldType', e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  border:
                                    field.fieldType === 'ATTACHMENT'
                                      ? '1.5px solid #818cf8'
                                      : field.fieldType === 'DATE'
                                      ? '1.5px solid #38bdf8'
                                      : field.fieldType === 'NUMBER'
                                      ? '1.5px solid #34d399'
                                      : '1px solid #cbd5e1',
                                  background:
                                    field.fieldType === 'ATTACHMENT'
                                      ? '#eef2ff'
                                      : field.fieldType === 'DATE'
                                      ? '#f0f9ff'
                                      : field.fieldType === 'NUMBER'
                                      ? '#f0fdf4'
                                      : '#fff',
                                  fontSize: '12.5px',
                                  fontWeight: 650,
                                  color: '#0f172a',
                                }}
                              >
                                {FIELD_TYPES.map((ft) => (
                                  <option key={ft.value} value={ft.value}>
                                    {ft.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              {field.fieldType === 'SELECT' ? (
                                <input
                                  type="text"
                                  placeholder="e.g. Yes, No, In Progress"
                                  value={field.optionsString || ''}
                                  onChange={(e) => handleUpdateField(activeTableIndex, fIdx, 'optionsString', e.target.value)}
                                  style={{
                                    width: '100%',
                                    padding: '6px 10px',
                                    borderRadius: '6px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '12px',
                                  }}
                                  title="Comma-separated dropdown options"
                                />
                              ) : field.fieldType === 'ATTACHMENT' ? (
                                <span style={{ fontSize: '11.5px', color: '#4f46e5', fontWeight: 600 }}>
                                  📎 File/PDF upload enabled
                                </span>
                              ) : field.fieldType === 'DATE' ? (
                                <span style={{ fontSize: '11.5px', color: '#0284c7', fontWeight: 600 }}>
                                  📅 Date selection widget
                                </span>
                              ) : field.fieldType === 'NUMBER' ? (
                                <span style={{ fontSize: '11.5px', color: '#059669', fontWeight: 600 }}>
                                  🔢 Numeric values & scores
                                </span>
                              ) : field.fieldType === 'TEXTAREA' ? (
                                <span style={{ fontSize: '11.5px', color: '#d97706', fontWeight: 600 }}>
                                  📝 Multi-line descriptive box
                                </span>
                              ) : (
                                <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>Standard text</span>
                              )}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={field.isRequired}
                                onChange={(e) => handleUpdateField(activeTableIndex, fIdx, 'isRequired', e.target.checked)}
                                style={{ cursor: 'pointer', transform: 'scale(1.15)' }}
                                title="Mark column as mandatory"
                              />
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              <button
                                type="button"
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  fontSize: '14px',
                                  padding: '4px',
                                }}
                                onClick={() => handleDeleteField(activeTableIndex, fIdx)}
                                title="Remove Column"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                border: '2px dashed #cbd5e1',
                borderRadius: '12px',
                padding: '36px 20px',
                textAlign: 'center',
                background: '#fafafa',
              }}
            >
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>📊</div>
              <h4 style={{ margin: '0 0 6px', color: '#0f172a', fontWeight: 700 }}>No Excel file loaded yet</h4>
              <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '13px' }}>
                Upload your Excel file above or click the button below to download the ready-to-use template.
              </p>
              <button
                type="button"
                style={{
                  padding: '8px 18px',
                  borderRadius: '7px',
                  border: '1px solid #86efac',
                  background: '#f0fdf4',
                  color: '#15803d',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
                onClick={handleDownloadSampleTemplate}
              >
                📥 Download Basic Excel Template (.xlsx)
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            {parsedTables.length > 0 && (
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                Summary: <strong>{parsedTables.length}</strong> Table(s),{' '}
                <strong>{parsedTables.reduce((acc, t) => acc + (t.fields?.length || 0), 0)}</strong> Columns ready for import.
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#334155',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
              onClick={onClose}
              disabled={importing}
            >
              Cancel
            </button>
            <button
              type="button"
              style={{
                padding: '8px 22px',
                borderRadius: '8px',
                border: 'none',
                background: parsedTables.length === 0 || importing ? '#94a3b8' : '#16a34a',
                color: '#fff',
                fontWeight: 700,
                fontSize: '13px',
                cursor: parsedTables.length === 0 || importing ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: parsedTables.length > 0 && !importing ? '0 2px 4px rgba(22,163,74,0.25)' : 'none',
              }}
              onClick={handleExecuteImport}
              disabled={parsedTables.length === 0 || importing}
            >
              {importing ? (
                <>
                  <div className="spinner-border spinner-border-sm" role="status"></div>
                  <span>Creating Tables...</span>
                </>
              ) : (
                <>
                  <span>🚀 Create Tables & Columns ({parsedTables.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
