import { toast } from "../../../components/feedback/feedbackBus";
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
      toast.error('Failed to generate template: ' + err.message);
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
      toast.warning('You must have at least one table.');
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
      toast.warning('Each table must have at least one column.');
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
      toast.warning('No tables to import.');
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
        padding: "var(--space-8)",
      }}
    >
      <div
        style={{
          background: 'var(--card)',
          borderRadius: "var(--radius-xl)",
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
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: "var(--space-3)", marginBottom: "var(--space-1)" }}>
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: "var(--radius-sm)",
                  background: '#dbeafe',
                  color: '#1e40af',
                }}
              >
                Section {section.number || 'A'}
              </span>
              <h3 style={{ margin: 0, fontSize: "var(--text-xl)", fontWeight: 800, color: 'var(--ink)' }}>
                📥 Import Tables from Excel
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: "var(--text-base)", color: 'var(--muted)' }}>
              Upload an Excel sheet to automatically create tables with column headers and configure field types.
            </p>
          </div>
          <button
            type="button"
            style={{
              border: 'none',
              background: 'var(--bg-alt)',
              borderRadius: "var(--radius-sm)",
              width: '32px',
              height: '32px',
              fontSize: "var(--text-lg)",
              color: 'var(--muted)',
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
        <div style={{ flex: 1, overflowY: 'auto', padding: "var(--space-9)" }}>
          {error && (
            <div
              style={{
                padding: '12px 16px',
                background: 'var(--red-50)',
                border: '1px solid var(--red-200)',
                borderRadius: "var(--radius-sm)",
                color: 'var(--red-700)',
                fontSize: "var(--text-base)",
                marginBottom: "var(--space-8)",
                display: 'flex',
                alignItems: 'center',
                gap: "var(--space-4)",
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
              gap: "var(--space-6)",
              background: 'var(--bg-alt)',
              padding: '16px 20px',
              borderRadius: "var(--radius-lg)",
              marginBottom: "var(--space-8)",
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: "var(--space-5)", flexWrap: 'wrap' }}>
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
                  borderRadius: "var(--radius-sm)",
                  border: 'none',
                  background: 'var(--primary)',
                  color: 'var(--card)',
                  fontWeight: 700,
                  fontSize: "var(--text-base)",
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: "var(--space-3)",
                  boxShadow: '0 2px 4px rgba(37,99,235,0.2)',
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                📁 {file ? 'Change Excel File' : 'Choose Excel File (.xlsx)'}
              </button>
              {file && (
                <span style={{ fontSize: "var(--text-base)", fontWeight: 600, color: 'var(--ink)' }}>
                  📄 {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: "var(--space-3)", flexWrap: 'wrap' }}>
              <button
                type="button"
                style={{
                  padding: '8px 12px',
                  borderRadius: "var(--radius-sm)",
                  border: '1px solid var(--border-strong)',
                  background: 'var(--card)',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: "var(--text-base)",
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
                  borderRadius: "var(--radius-sm)",
                  border: '1px solid var(--green-300)',
                  background: 'var(--green-50)',
                  color: 'var(--green-600)',
                  fontWeight: 700,
                  fontSize: "var(--text-base)",
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: "var(--space-2)",
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
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: "var(--radius-lg)",
                padding: '18px 20px',
                marginBottom: "var(--space-9)",
              }}
            >
              <h4 style={{ margin: '0 0 12px', fontSize: "var(--text-md)", fontWeight: 800, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: "var(--space-3)" }}>
                <span>📋 How to Format Your Excel File (Both Formats Supported)</span>
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: "var(--space-7)" }}>
                {/* Format 1 */}
                <div style={{ background: 'var(--card)', border: '1px solid var(--border-strong)', borderRadius: "var(--radius-sm)", padding: "var(--space-6)" }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
                    <span style={{ fontSize: "var(--text-xs)", fontWeight: 800, padding: '2px 6px', background: '#dbeafe', color: '#1e40af', borderRadius: "var(--radius-2xs)" }}>
                      Format A (Your Format)
                    </span>
                    <strong style={{ fontSize: "var(--text-base)", color: 'var(--ink)' }}>Single Sheet with Multiple Tables</strong>
                  </div>
                  <p style={{ margin: '0 0 10px', fontSize: "var(--text-base)", color: 'var(--muted)' }}>
                    Put table titles in single rows, followed directly by column headers and separated by blank rows:
                  </p>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: "var(--text-sm)", background: 'var(--bg)', border: '1px solid var(--border)', fontFamily: 'monospace' }}>
                    <tbody>
                      <tr style={{ background: '#e0f2fe', fontWeight: 'bold' }}>
                        <td colSpan={4} style={{ padding: '4px 8px', border: '1px solid var(--border-strong)' }}>Table header1</td>
                      </tr>
                      <tr style={{ background: 'var(--bg-alt)', fontWeight: 'bold' }}>
                        <td style={{ padding: '4px 6px', border: '1px solid var(--border-strong)' }}>Sr. no</td>
                        <td style={{ padding: '4px 6px', border: '1px solid var(--border-strong)' }}>Name</td>
                        <td style={{ padding: '4px 6px', border: '1px solid var(--border-strong)' }}>Roll no</td>
                        <td style={{ padding: '4px 6px', border: '1px solid var(--border-strong)' }}>Attachment</td>
                      </tr>
                      <tr>
                        <td colSpan={4} style={{ padding: '4px 8px', color: 'var(--muted)', fontStyle: 'italic', border: '1px solid var(--border-strong)' }}>[empty row]</td>
                      </tr>
                      <tr style={{ background: '#e0f2fe', fontWeight: 'bold' }}>
                        <td colSpan={4} style={{ padding: '4px 8px', border: '1px solid var(--border-strong)' }}>Table header2</td>
                      </tr>
                      <tr style={{ background: 'var(--bg-alt)', fontWeight: 'bold' }}>
                        <td style={{ padding: '4px 6px', border: '1px solid var(--border-strong)' }}>Sr.no</td>
                        <td style={{ padding: '4px 6px', border: '1px solid var(--border-strong)' }}>Paper Id</td>
                        <td style={{ padding: '4px 6px', border: '1px solid var(--border-strong)' }}>Writer Name</td>
                        <td style={{ padding: '4px 6px', border: '1px solid var(--border-strong)' }}>Attachment</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Format 2 */}
                <div style={{ background: 'var(--card)', border: '1px solid var(--border-strong)', borderRadius: "var(--radius-sm)", padding: "var(--space-6)" }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
                    <span style={{ fontSize: "var(--text-xs)", fontWeight: 800, padding: '2px 6px', background: 'var(--amber-100)', color: 'var(--amber-700)', borderRadius: "var(--radius-2xs)" }}>
                      Format B
                    </span>
                    <strong style={{ fontSize: "var(--text-base)", color: 'var(--ink)' }}>Multi-Sheet Workbook (Tabs)</strong>
                  </div>
                  <p style={{ margin: '0 0 10px', fontSize: "var(--text-base)", color: 'var(--muted)' }}>
                    Each sheet tab is named after the Table (e.g. <em>Research Papers</em>), and Row 1 contains column headers:
                  </p>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: "var(--text-sm)", background: 'var(--bg)', border: '1px solid var(--border)', fontFamily: 'monospace' }}>
                    <tbody>
                      <tr style={{ background: 'var(--amber-100)', fontWeight: 'bold' }}>
                        <td colSpan={3} style={{ padding: '4px 8px', border: '1px solid var(--border-strong)' }}>Sheet Tab: "Research Publications"</td>
                      </tr>
                      <tr style={{ background: 'var(--bg-alt)', fontWeight: 'bold' }}>
                        <td style={{ padding: '4px 6px', border: '1px solid var(--border-strong)' }}>Sr No</td>
                        <td style={{ padding: '4px 6px', border: '1px solid var(--border-strong)' }}>Paper Title</td>
                        <td style={{ padding: '4px 6px', border: '1px solid var(--border-strong)' }}>Upload Proof PDF</td>
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
                  gap: "var(--space-3)",
                  borderBottom: '2px solid var(--border)',
                  paddingBottom: '2px',
                  marginBottom: "var(--space-8)",
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
                      background: activeTableIndex === idx ? 'var(--primary)' : 'var(--bg)',
                      color: activeTableIndex === idx ? 'var(--card)' : '#475569',
                      fontWeight: 700,
                      fontSize: "var(--text-base)",
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: "var(--space-3)",
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap',
                    }}
                    onClick={() => setActiveTableIndex(idx)}
                  >
                    <span>📊 {tbl.title || `Table ${idx + 1}`}</span>
                    <span
                      style={{
                        fontSize: "var(--text-2xs)",
                        padding: '1px 6px',
                        borderRadius: "var(--radius-md)",
                        background: activeTableIndex === idx ? 'rgba(255,255,255,0.25)' : 'var(--border)',
                        color: activeTableIndex === idx ? 'var(--card)' : '#334155',
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
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: "var(--radius-lg)",
                    padding: "var(--space-8)",
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                      gap: "var(--space-7)",
                      marginBottom: "var(--space-8)",
                      paddingBottom: "var(--space-7)",
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <div>
                      <label style={{ display: 'block', fontSize: "var(--text-base)", fontWeight: 700, color: '#475569', marginBottom: "var(--space-2)" }}>
                        Table Title:
                      </label>
                      <input
                        type="text"
                        value={activeTable.title}
                        onChange={(e) => handleUpdateTableTitle(activeTableIndex, e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: "var(--radius-sm)",
                          border: '1px solid var(--border-strong)',
                          fontSize: "var(--text-base)",
                          fontWeight: 600,
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: "var(--text-base)", fontWeight: 700, color: '#475569', marginBottom: "var(--space-2)" }}>
                        Table Key (JSON Key):
                      </label>
                      <input
                        type="text"
                        value={activeTable.tableKey}
                        onChange={(e) => handleUpdateTableKey(activeTableIndex, e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: "var(--radius-sm)",
                          border: '1px solid var(--border-strong)',
                          fontSize: "var(--text-base)",
                          fontFamily: 'monospace',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: "var(--space-7)", paddingTop: '22px' }}>
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: "var(--space-2)",
                          fontSize: "var(--text-base)",
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
                            borderRadius: "var(--radius-sm)",
                            border: '1px solid var(--red-200)',
                            background: 'var(--card)',
                            color: 'var(--red-700)',
                            fontWeight: 600,
                            fontSize: "var(--text-base)",
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "var(--space-5)" }}>
                    <h4 style={{ margin: 0, fontSize: "var(--text-md)", fontWeight: 800, color: 'var(--ink)' }}>
                      ⚙️ Column Field Types & Rules ({activeTable.fields?.length || 0} Columns)
                    </h4>
                    <button
                      type="button"
                      style={{
                        padding: '5px 12px',
                        borderRadius: "var(--radius-sm)",
                        border: '1px solid #93c5fd',
                        background: 'var(--accent-soft)',
                        color: 'var(--primary-dark)',
                        fontWeight: 700,
                        fontSize: "var(--text-base)",
                        cursor: 'pointer',
                      }}
                      onClick={() => handleAddColumn(activeTableIndex)}
                    >
                      + Add Column
                    </button>
                  </div>

                  <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: "var(--radius-sm)" }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: "var(--text-base)" }}>
                      <thead>
                        <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                          <th style={{ padding: '10px 12px', width: '40px', color: 'var(--muted)' }}>#</th>
                          <th style={{ padding: '10px 12px', width: '28%', color: '#334155', fontWeight: 700 }}>Column Header Label</th>
                          <th style={{ padding: '10px 12px', width: '26%', color: '#334155', fontWeight: 700 }}>Data Field Type</th>
                          <th style={{ padding: '10px 12px', width: '28%', color: '#334155', fontWeight: 700 }}>Options / Notes</th>
                          <th style={{ padding: '10px 12px', width: '80px', textAlign: 'center', color: '#334155', fontWeight: 700 }}>Req?</th>
                          <th style={{ padding: '10px 12px', width: '50px', textAlign: 'center' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeTable.fields?.map((field, fIdx) => (
                          <tr key={field.id || fIdx} style={{ borderBottom: '1px solid var(--bg-alt)' }}>
                            <td style={{ padding: '10px 12px', color: 'var(--muted)', fontWeight: 600, fontSize: "var(--text-base)" }}>
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
                                  borderRadius: "var(--radius-sm)",
                                  border: '1px solid var(--border-strong)',
                                  fontSize: "var(--text-base)",
                                  fontWeight: 600,
                                }}
                              />
                              <small style={{ color: 'var(--muted)', fontFamily: 'monospace', fontSize: "var(--text-xs)", display: 'block', marginTop: '2px' }}>
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
                                  borderRadius: "var(--radius-sm)",
                                  border:
                                    field.fieldType === 'ATTACHMENT'
                                      ? '1.5px solid #60a5fa'
                                      : field.fieldType === 'DATE'
                                      ? '1.5px solid #60a5fa'
                                      : field.fieldType === 'NUMBER'
                                      ? '1.5px solid #34d399'
                                      : '1px solid var(--border-strong)',
                                  background:
                                    field.fieldType === 'ATTACHMENT'
                                      ? 'var(--accent-soft)'
                                      : field.fieldType === 'DATE'
                                      ? '#f0f9ff'
                                      : field.fieldType === 'NUMBER'
                                      ? 'var(--green-50)'
                                      : 'var(--card)',
                                  fontSize: "var(--text-base)",
                                  fontWeight: 650,
                                  color: 'var(--ink)',
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
                                    borderRadius: "var(--radius-sm)",
                                    border: '1px solid var(--border-strong)',
                                    fontSize: "var(--text-base)",
                                  }}
                                  title="Comma-separated dropdown options"
                                />
                              ) : field.fieldType === 'ATTACHMENT' ? (
                                <span style={{ fontSize: "var(--text-sm)", color: 'var(--primary)', fontWeight: 600 }}>
                                  📎 File/PDF upload enabled
                                </span>
                              ) : field.fieldType === 'DATE' ? (
                                <span style={{ fontSize: "var(--text-sm)", color: '#0284c7', fontWeight: 600 }}>
                                  📅 Date selection widget
                                </span>
                              ) : field.fieldType === 'NUMBER' ? (
                                <span style={{ fontSize: "var(--text-sm)", color: 'var(--green-650)', fontWeight: 600 }}>
                                  🔢 Numeric values & scores
                                </span>
                              ) : field.fieldType === 'TEXTAREA' ? (
                                <span style={{ fontSize: "var(--text-sm)", color: 'var(--amber-600)', fontWeight: 600 }}>
                                  📝 Multi-line descriptive box
                                </span>
                              ) : (
                                <span style={{ fontSize: "var(--text-sm)", color: 'var(--muted)' }}>Standard text</span>
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
                                  color: 'var(--red-500)',
                                  cursor: 'pointer',
                                  fontSize: "var(--text-md)",
                                  padding: "var(--space-1)",
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
                border: '2px dashed var(--border-strong)',
                borderRadius: "var(--radius-lg)",
                padding: '36px 20px',
                textAlign: 'center',
                background: '#fafafa',
              }}
            >
              <div style={{ fontSize: "var(--text-5xl)", marginBottom: "var(--space-4)" }}>📊</div>
              <h4 style={{ margin: '0 0 6px', color: 'var(--ink)', fontWeight: 700 }}>No Excel file loaded yet</h4>
              <p style={{ margin: '0 0 16px', color: 'var(--muted)', fontSize: "var(--text-base)" }}>
                Upload your Excel file above or click the button below to download the ready-to-use template.
              </p>
              <button
                type="button"
                style={{
                  padding: '8px 18px',
                  borderRadius: "var(--radius-sm)",
                  border: '1px solid var(--green-300)',
                  background: 'var(--green-50)',
                  color: 'var(--green-600)',
                  fontWeight: 700,
                  fontSize: "var(--text-base)",
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
            borderTop: '1px solid var(--border)',
            background: 'var(--bg)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            {parsedTables.length > 0 && (
              <span style={{ fontSize: "var(--text-base)", fontWeight: 600, color: '#334155' }}>
                Summary: <strong>{parsedTables.length}</strong> Table(s),{' '}
                <strong>{parsedTables.reduce((acc, t) => acc + (t.fields?.length || 0), 0)}</strong> Columns ready for import.
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: "var(--space-4)" }}>
            <button
              type="button"
              style={{
                padding: '8px 18px',
                borderRadius: "var(--radius-sm)",
                border: '1px solid var(--border-strong)',
                background: 'var(--card)',
                color: '#334155',
                fontWeight: 600,
                fontSize: "var(--text-base)",
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
                borderRadius: "var(--radius-sm)",
                border: 'none',
                background: parsedTables.length === 0 || importing ? 'var(--faint)' : 'var(--green-550)',
                color: 'var(--card)',
                fontWeight: 700,
                fontSize: "var(--text-base)",
                cursor: parsedTables.length === 0 || importing ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: "var(--space-3)",
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
