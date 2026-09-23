import { toast } from "../../../components/feedback/feedbackBus";
import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { importFullSchema } from './formStudioApi';

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
  if (!text) return 'key_' + Math.floor(Math.random() * 10000);
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

  // Attachment / Proof / Document
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

// Extracts multiple tables from raw 2D sheet rows, ensuring globally unique table keys
const parseTablesFromWorksheetRows = (rawData, defaultTitlePrefix = 'Table', sectionKey = '', seenTableKeys = new Set()) => {
  if (!rawData || rawData.length === 0) return [];

  const foundTables = [];
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
    const nonEmptyCells = row
      .map((c, idx) => ({ val: String(c != null ? c : '').trim(), idx }))
      .filter((cell) => cell.val.length > 0);

    if (nonEmptyCells.length === 0) {
      i++;
      continue;
    }

    // Check if this row is a Table Title (single cell, followed by a row with multiple column headers)
    if (nonEmptyCells.length === 1 && i + 1 < rawData.length) {
      const nextRow = rawData[i + 1];
      const nextNonEmpty = nextRow
        .map((c) => String(c != null ? c : '').trim())
        .filter((val) => val.length > 0);

      if (nextNonEmpty.length >= 2) {
        pendingTitle = nonEmptyCells[0].val;
        i++;
        continue;
      }
    }

    // If this row has 2 or more column headers, treat as Table Headers row
    if (nonEmptyCells.length >= 2) {
      const tableTitle =
        pendingTitle || `${defaultTitlePrefix} ${foundTables.length + 1}`;
      pendingTitle = null;

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
          id: `temp_col_${foundTables.length}_${colIdx}`,
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
          id: `temp_tbl_${foundTables.length}`,
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
          i++;
          break;
        }

        if (nextNonEmpty.length === 1 && i + 1 < rawData.length) {
          const lookaheadRow = rawData[i + 1];
          const lookaheadNonEmpty = lookaheadRow
            .map((c) => String(c != null ? c : '').trim())
            .filter((val) => val.length > 0);
          if (lookaheadNonEmpty.length >= 2) {
            break;
          }
        }
        i++;
      }
      continue;
    }

    i++;
  }

  // Fallback if no multi-block was found
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
        id: `temp_col_${colIdx}`,
        label: rawLabel,
        fieldKey: colKey,
        fieldType: detectedType,
        isRequired: !isSrNo && !/optional|proof|remark|upload|attach/i.test(rawLabel),
        placeholder: `Enter ${rawLabel}`,
        optionsString: detectedType === 'SELECT' ? 'Option 1, Option 2, Option 3' : '',
      });
    });

    if (fields.length > 0) {
      const fallbackTitle = `${defaultTitlePrefix} 1`;
      const uniqueKey = generateUniqueTableKey(fallbackTitle);
      foundTables.push({
        id: `temp_tbl_0`,
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

export const ExcelFullSchemaImportModal = ({
  show,
  versionId,
  isAdministrative,
  universityPosts = [],
  onClose,
  onImportSuccess,
}) => {
  const [file, setFile] = useState(null);
  const [parsedSections, setParsedSections] = useState([]);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [activeTableIndex, setActiveTableIndex] = useState(0);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);
  const [showFormatGuide, setShowFormatGuide] = useState(false);
  const fileInputRef = useRef(null);

  if (!show || !versionId) return null;

  // Generate Sample Multi-Part Template
  const handleDownloadFullSchemaTemplate = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Part A - General Info
      const wsAData = [
        ['Part A: General Information & Institute Profile'],
        ['1. Basic School Details'],
        ['Sr No', 'School Name', 'Dean / Director Name', 'Total Approved Intake', 'Academic Year'],
        ['1', 'School of Engineering', 'Dr. John Doe', '240', '2025-26'],
        [''],
        ['2. Accreditation Status'],
        ['Sr No', 'Program Name', 'NAAC Grade', 'NBA Status', 'Upload Certificate Document'],
        ['1', 'B.Tech CSE', 'A+', 'Accredited', ''],
      ];
      const wsA = XLSX.utils.aoa_to_sheet(wsAData);
      XLSX.utils.book_append_sheet(wb, wsA, 'Part A - General Info');

      // Sheet 2: Part B - Academic & Teaching
      const wsBData = [
        ['Part B: Academic & Teaching Performance'],
        ['1. Curriculum & Board of Studies (BOS)'],
        ['Sr No', 'Course Title', 'BOS Meeting Date', 'Key Revisions Made', 'BOS Minutes Document'],
        ['1', 'Advanced AI & Data Science', '2025-04-10', 'Included GenAI modules', ''],
        [''],
        ['2. Student Results & Progression'],
        ['Sr No', 'Batch / Year', 'Total Appeared', 'Passed Count', 'Pass Percentage (%)'],
        ['1', '2024-25 Final Year', '120', '115', '95.8'],
      ];
      const wsB = XLSX.utils.aoa_to_sheet(wsBData);
      XLSX.utils.book_append_sheet(wb, wsB, 'Part B - Academic & Teaching');

      // Sheet 3: Part C - Research & Innovation
      const wsCData = [
        ['Part C: Research & Development'],
        ['1. Research Publications (Journals & Conferences)'],
        ['Sr No', 'Paper Title', 'Journal Name', 'ISSN / ISBN', 'Publication Date', 'Impact Factor', 'Upload Paper PDF'],
        ['1', 'Microservices Optimization', 'IEEE Software', '0740-7459', '2025-05-20', '4.2', ''],
        [''],
        ['2. Sponsored Research Projects & Grants'],
        ['Sr No', 'Project Title', 'Funding Agency', 'Sanctioned Amount (INR)', 'Sanction Date', 'Status', 'Sanction Letter Attachment'],
        ['1', 'IoT Sensor Network for Agriculture', 'DST - SERB', '2500000', '2025-02-15', 'Ongoing', ''],
      ];
      const wsC = XLSX.utils.aoa_to_sheet(wsCData);
      XLSX.utils.book_append_sheet(wb, wsC, 'Part C - Research');

      XLSX.writeFile(wb, `Appraisal_Full_Form_Multi_Part_Template.xlsx`);
    } catch (err) {
      console.error('Failed to generate full template:', err);
      toast.error('Failed to generate template: ' + err.message);
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setError(null);
    parseWorkbook(selected);
  };

  const parseWorkbook = (fileObj) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });

        const sections = [];
        const seenTableKeys = new Set();
        const seenSectionKeys = new Set();

        wb.SheetNames.forEach((sheetName, sheetIdx) => {
          const ws = wb.Sheets[sheetName];
          const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          if (!rawData || rawData.length === 0) return;

          let sectionTitle = sheetName.trim();
          let sectionNumber = String.valueOf(String.fromCharCode(65 + sheetIdx)); // 'A', 'B', 'C'
          let startRow = 0;

          // Check if Row 1 has an explicit Section / Part title (e.g. "Part A: General Information")
          const firstRowNonEmpty = rawData[0]?.filter((c) => String(c != null ? c : '').trim().length > 0) || [];
          if (firstRowNonEmpty.length === 1 && rawData.length > 1) {
            const rawFirst = firstRowNonEmpty[0];
            const partMatch = rawFirst.match(/^(Part|Section)\s*([A-Z0-9]+)[:\s\-]*(.*)$/i);
            if (partMatch) {
              sectionNumber = partMatch[2].toUpperCase();
              sectionTitle = rawFirst;
              startRow = 1;
            } else if (/Part|Section|Profile|Criteria/i.test(rawFirst)) {
              sectionTitle = rawFirst;
              startRow = 1;
            }
          }

          let secKey = slugify(sectionTitle);
          let secSuffix = 1;
          while (seenSectionKeys.has(secKey)) {
            secKey = `${slugify(sectionTitle)}_${++secSuffix}`;
          }
          seenSectionKeys.add(secKey);

          const remainingData = rawData.slice(startRow);
          const tables = parseTablesFromWorksheetRows(remainingData, 'Table', secKey, seenTableKeys);

          if (tables.length > 0) {
            const defaultOwner = isAdministrative
              ? (universityPosts[0]?.code?.toLowerCase() || '')
              : 'director-schools';

            sections.push({
              id: `sec_${sheetIdx}`,
              title: sectionTitle,
              sectionNumber: sectionNumber,
              sectionKey: secKey,
              ownerRole: defaultOwner,
              description: '',
              tables: tables,
            });
          }
        });

        if (sections.length === 0) {
          setError('No valid sections or tables found in the Excel workbook. Please check the template.');
        } else {
          setParsedSections(sections);
          setActiveSectionIndex(0);
          setActiveTableIndex(0);
        }
      } catch (err) {
        console.error('Error parsing Excel:', err);
        setError('Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file.');
      }
    };
    reader.readAsBinaryString(fileObj);
  };

  // Section Handlers
  const handleUpdateSectionTitle = (sIdx, title) => {
    const updated = [...parsedSections];
    updated[sIdx].title = title;
    updated[sIdx].sectionKey = slugify(title);
    setParsedSections(updated);
  };

  const handleUpdateSectionOwner = (sIdx, role) => {
    const updated = [...parsedSections];
    updated[sIdx].ownerRole = role;
    setParsedSections(updated);
  };

  const handleDeleteSection = (sIdx) => {
    if (parsedSections.length <= 1) {
      toast.warning('You must have at least one section.');
      return;
    }
    const updated = parsedSections.filter((_, idx) => idx !== sIdx);
    setParsedSections(updated);
    setActiveSectionIndex(Math.max(0, activeSectionIndex - 1));
    setActiveTableIndex(0);
  };

  // Table & Field Handlers
  const activeSection = parsedSections[activeSectionIndex];
  const activeTable = activeSection?.tables?.[activeTableIndex];

  const handleUpdateTableTitle = (tIdx, title) => {
    const updated = [...parsedSections];
    const sec = updated[activeSectionIndex];
    const otherKeys = new Set();
    updated.forEach((s, sI) => {
      s.tables?.forEach((t, tI) => {
        if (sI !== activeSectionIndex || tI !== tIdx) {
          if (t.tableKey) otherKeys.add(t.tableKey);
        }
      });
    });

    const baseKey = slugify(title);
    let candidate = baseKey;
    if (otherKeys.has(candidate)) {
      candidate = `${slugify(sec.sectionKey || sec.title)}_${baseKey}`;
    }
    let suffix = 1;
    while (otherKeys.has(candidate)) {
      candidate = `${baseKey}_${++suffix}`;
    }

    updated[activeSectionIndex].tables[tIdx].title = title;
    updated[activeSectionIndex].tables[tIdx].tableKey = candidate;
    setParsedSections(updated);
  };

  const handleToggleTableRepeatable = (tIdx) => {
    const updated = [...parsedSections];
    updated[activeSectionIndex].tables[tIdx].isRepeatable = !updated[activeSectionIndex].tables[tIdx].isRepeatable;
    setParsedSections(updated);
  };

  const handleDeleteTable = (tIdx) => {
    const updated = [...parsedSections];
    if (updated[activeSectionIndex].tables.length <= 1) {
      toast.warning('Each section must have at least one table.');
      return;
    }
    updated[activeSectionIndex].tables = updated[activeSectionIndex].tables.filter((_, idx) => idx !== tIdx);
    setParsedSections(updated);
    setActiveTableIndex(Math.max(0, activeTableIndex - 1));
  };

  const handleUpdateField = (fIdx, prop, value) => {
    const updated = [...parsedSections];
    updated[activeSectionIndex].tables[activeTableIndex].fields[fIdx][prop] = value;
    if (prop === 'label') {
      updated[activeSectionIndex].tables[activeTableIndex].fields[fIdx].fieldKey = slugify(value);
    }
    setParsedSections(updated);
  };

  const handleDeleteField = (fIdx) => {
    const updated = [...parsedSections];
    const fields = updated[activeSectionIndex].tables[activeTableIndex].fields;
    if (fields.length <= 1) {
      toast.warning('Each table must have at least one column.');
      return;
    }
    updated[activeSectionIndex].tables[activeTableIndex].fields = fields.filter((_, idx) => idx !== fIdx);
    setParsedSections(updated);
  };

  const handleAddColumn = () => {
    const updated = [...parsedSections];
    const fields = updated[activeSectionIndex].tables[activeTableIndex].fields;
    const newIdx = fields.length + 1;
    fields.push({
      id: 'temp_new_' + Date.now(),
      label: `New Column ${newIdx}`,
      fieldKey: `new_col_${newIdx}`,
      fieldType: 'TEXT',
      isRequired: false,
      placeholder: '',
      optionsString: '',
    });
    setParsedSections(updated);
  };

  // Submit full schema
  const handleExecuteImport = async () => {
    if (parsedSections.length === 0) {
      toast.warning('No sections to import.');
      return;
    }

    setImporting(true);
    setError(null);

    try {
      // Final pass to guarantee 100% unique table keys across all sections
      const finalUsedTableKeys = new Set();
      const sanitizedSections = parsedSections.map((s) => {
        const secSlug = slugify(s.sectionKey || s.title || 'sec');
        return {
          title: s.title,
          sectionNumber: s.sectionNumber,
          sectionKey: s.sectionKey,
          ownerRole: s.ownerRole,
          description: s.description || '',
          tables: (s.tables || []).map((t) => {
            const baseTblKey = slugify(t.tableKey || t.title || 'tbl');
            let uniqueTblKey = baseTblKey;
            if (finalUsedTableKeys.has(uniqueTblKey)) {
              uniqueTblKey = `${secSlug}_${baseTblKey}`;
            }
            let suffix = 1;
            while (finalUsedTableKeys.has(uniqueTblKey)) {
              uniqueTblKey = `${baseTblKey}_${++suffix}`;
            }
            finalUsedTableKeys.add(uniqueTblKey);

            return {
              title: t.title,
              tableKey: uniqueTblKey,
              isRepeatable: t.isRepeatable,
              showTitle: t.showTitle,
              fields: (t.fields || []).map((f, idx) => ({
                label: f.label,
                fieldKey: f.fieldKey,
                fieldType: f.fieldType,
                isRequired: f.isRequired,
                placeholder: f.placeholder,
                optionsString: f.fieldType === 'SELECT' ? f.optionsString : null,
                displayOrder: idx + 1,
              })),
            };
          }),
        };
      });

      const payload = {
        sections: sanitizedSections,
      };

      await importFullSchema(versionId, payload);
      if (onImportSuccess) {
        onImportSuccess();
      }
      onClose();
    } catch (err) {
      console.error('Full schema import failed:', err);
      setError(err.response?.data?.message || err.message || 'Failed to import schema.');
    } finally {
      setImporting(false);
    }
  };

  const totalTables = parsedSections.reduce((acc, s) => acc + (s.tables?.length || 0), 0);
  const totalColumns = parsedSections.reduce(
    (acc, s) => acc + s.tables.reduce((tAcc, t) => tAcc + (t.fields?.length || 0), 0),
    0
  );

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1060,
        padding: "var(--space-8)",
      }}
    >
      <div
        style={{
          background: 'var(--card)',
          borderRadius: "var(--radius-xl)",
          width: '100%',
          maxWidth: '1150px',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
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
                  padding: '3px 8px',
                  borderRadius: "var(--radius-sm)",
                  background: 'var(--amber-100)',
                  color: 'var(--amber-700)',
                  border: '1px solid #fcd34d',
                }}
              >
                Entire Form Schema
              </span>
              <h3 style={{ margin: 0, fontSize: "var(--text-xl)", fontWeight: 800, color: 'var(--ink)' }}>
                📥 Import Entire Form Schema from Excel (Multi-Part)
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: "var(--text-base)", color: 'var(--muted)' }}>
              Upload a multi-sheet Excel workbook where <strong>each Sheet = 1 Section / Part</strong>, and each sheet contains its tables and column headers.
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

          {/* Upload Bar */}
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
                  boxShadow: '0 2px 4px rgba(37,99,235,0.25)',
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                📁 {file ? 'Change Workbook' : 'Upload Full Form Excel (.xlsx)'}
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
                {showFormatGuide ? 'Hide Format Guide ▲' : '📖 View Multi-Part Format Guide ▼'}
              </button>
              <button
                type="button"
                style={{
                  padding: '8px 14px',
                  borderRadius: "var(--radius-sm)",
                  border: '1px solid var(--accent-border)',
                  background: 'var(--accent-soft)',
                  color: 'var(--primary-dark)',
                  fontWeight: 700,
                  fontSize: "var(--text-base)",
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: "var(--space-2)",
                }}
                onClick={handleDownloadFullSchemaTemplate}
                title="Download template with Part A, Part B, Part C sheets and sample tables"
              >
                📥 Download Full Multi-Part Template
              </button>
            </div>
          </div>

          {/* Guide Card */}
          {(showFormatGuide || parsedSections.length === 0) && (
            <div
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: "var(--radius-lg)",
                padding: '18px 20px',
                marginBottom: "var(--space-9)",
              }}
            >
              <h4 style={{ margin: '0 0 10px', fontSize: "var(--text-md)", fontWeight: 800, color: 'var(--ink)' }}>
                📋 Multi-Part Excel Workbook Structure
              </h4>
              <p style={{ margin: '0 0 12px', fontSize: "var(--text-base)", color: 'var(--muted)' }}>
                In this mode, <strong>each sheet in Excel becomes an entire Part / Section</strong> in the appraisal schema. Inside each sheet, you can place all tables belonging to that part:
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: "var(--space-6)" }}>
                <div style={{ background: 'var(--card)', border: '1px solid var(--border-strong)', borderRadius: "var(--radius-sm)", padding: "var(--space-5)" }}>
                  <span style={{ fontSize: "var(--text-xs)", fontWeight: 800, padding: '2px 6px', background: '#dbeafe', color: '#1e40af', borderRadius: "var(--radius-2xs)" }}>
                    Sheet Tab: "Part A - General Info"
                  </span>
                  <div style={{ marginTop: "var(--space-3)", fontSize: "var(--text-sm)", fontFamily: 'monospace', color: '#334155' }}>
                    <div><strong>Row 1:</strong> Part A: General Information</div>
                    <div><strong>Row 2:</strong> 1. Institute Details</div>
                    <div><strong>Row 3:</strong> Sr No | Name | Intake | ...</div>
                    <div><strong>Row 4:</strong> [blank row]</div>
                    <div><strong>Row 5:</strong> 2. Accreditation</div>
                    <div><strong>Row 6:</strong> Sr No | Program | Grade | Doc</div>
                  </div>
                </div>

                <div style={{ background: 'var(--card)', border: '1px solid var(--border-strong)', borderRadius: "var(--radius-sm)", padding: "var(--space-5)" }}>
                  <span style={{ fontSize: "var(--text-xs)", fontWeight: 800, padding: '2px 6px', background: 'var(--green-100)', color: 'var(--green-600)', borderRadius: "var(--radius-2xs)" }}>
                    Sheet Tab: "Part B - Academic"
                  </span>
                  <div style={{ marginTop: "var(--space-3)", fontSize: "var(--text-sm)", fontFamily: 'monospace', color: '#334155' }}>
                    <div><strong>Row 1:</strong> Part B: Academic Performance</div>
                    <div><strong>Row 2:</strong> 1. BOS Meetings</div>
                    <div><strong>Row 3:</strong> Sr No | Course | BOS Date | ...</div>
                    <div><strong>Row 4:</strong> [blank row]</div>
                    <div><strong>Row 5:</strong> 2. Results & Progression</div>
                    <div><strong>Row 6:</strong> Sr No | Batch | Pass % | ...</div>
                  </div>
                </div>

                <div style={{ background: 'var(--card)', border: '1px solid var(--border-strong)', borderRadius: "var(--radius-sm)", padding: "var(--space-5)" }}>
                  <span style={{ fontSize: "var(--text-xs)", fontWeight: 800, padding: '2px 6px', background: 'var(--amber-100)', color: 'var(--amber-700)', borderRadius: "var(--radius-2xs)" }}>
                    Sheet Tab: "Part C - Research"
                  </span>
                  <div style={{ marginTop: "var(--space-3)", fontSize: "var(--text-sm)", fontFamily: 'monospace', color: '#334155' }}>
                    <div><strong>Row 1:</strong> Part C: Research & Development</div>
                    <div><strong>Row 2:</strong> 1. Publications</div>
                    <div><strong>Row 3:</strong> Sr No | Title | Journal | Proof</div>
                    <div><strong>Row 4:</strong> [blank row]</div>
                    <div><strong>Row 5:</strong> 2. Sponsored Grants</div>
                    <div><strong>Row 6:</strong> Sr No | Project | Amount | ...</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Configurator Layout (Sections & Tables) */}
          {parsedSections.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: "var(--space-8)" }}>
              {/* Left Sidebar: Section List */}
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: "var(--radius-lg)", padding: "var(--space-6)", height: 'fit-content' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: "var(--text-base)", fontWeight: 800, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  📑 Sections / Parts ({parsedSections.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: "var(--space-2)" }}>
                  {parsedSections.map((sec, sIdx) => (
                    <button
                      key={sec.id || sIdx}
                      type="button"
                      style={{
                        padding: '10px 12px',
                        borderRadius: "var(--radius-sm)",
                        border: activeSectionIndex === sIdx ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                        background: activeSectionIndex === sIdx ? 'var(--accent-soft)' : 'var(--card)',
                        color: activeSectionIndex === sIdx ? 'var(--primary-dark)' : '#1e293b',
                        fontWeight: 700,
                        fontSize: "var(--text-base)",
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                      onClick={() => {
                        setActiveSectionIndex(sIdx);
                        setActiveTableIndex(0);
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {sec.title}
                      </span>
                      <span
                        style={{
                          fontSize: "var(--text-2xs)",
                          padding: '2px 6px',
                          borderRadius: "var(--radius-md)",
                          background: activeSectionIndex === sIdx ? 'var(--accent-border)' : 'var(--bg-alt)',
                          color: activeSectionIndex === sIdx ? '#312e81' : 'var(--muted)',
                          fontWeight: 700,
                        }}
                      >
                        {sec.tables?.length || 0} tbls
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Right Content: Active Section & Tables */}
              {activeSection && (
                <div>
                  {/* Section Settings Header */}
                  <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: "var(--radius-lg)", padding: "var(--space-7)", marginBottom: "var(--space-7)" }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: "var(--space-5)", alignItems: 'center' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: "var(--text-sm)", fontWeight: 700, color: '#475569', marginBottom: "var(--space-1)" }}>
                          Section Title:
                        </label>
                        <input
                          type="text"
                          value={activeSection.title}
                          onChange={(e) => handleUpdateSectionTitle(activeSectionIndex, e.target.value)}
                          style={{ width: '100%', padding: '6px 10px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', fontSize: "var(--text-base)", fontWeight: 600 }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: "var(--text-sm)", fontWeight: 700, color: '#475569', marginBottom: "var(--space-1)" }}>
                          Assigned Owner Role:
                        </label>
                        <select
                          value={activeSection.ownerRole}
                          onChange={(e) => handleUpdateSectionOwner(activeSectionIndex, e.target.value)}
                          style={{ width: '100%', padding: '6px 10px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', fontSize: "var(--text-base)", fontWeight: 600 }}
                        >
                          {isAdministrative ? (
                            universityPosts.map((p) => (
                              <option key={p.code} value={p.code.toLowerCase()}>
                                {p.name} ({p.code})
                              </option>
                            ))
                          ) : (
                            <>
                              <option value="director-schools">Director / Dean</option>
                              <option value="auditor">Auditor (Exclusive)</option>
                            </>
                          )}
                        </select>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: "var(--space-7)" }}>
                        {parsedSections.length > 1 && (
                          <button
                            type="button"
                            style={{ padding: '6px 12px', borderRadius: "var(--radius-sm)", border: '1px solid var(--red-200)', background: 'var(--card)', color: 'var(--red-700)', fontSize: "var(--text-base)", fontWeight: 600, cursor: 'pointer' }}
                            onClick={() => handleDeleteSection(activeSectionIndex)}
                          >
                            🗑️ Delete Section
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Table Selector Tabs for Active Section */}
                  <div style={{ display: 'flex', gap: "var(--space-3)", borderBottom: '2px solid var(--border)', paddingBottom: '2px', marginBottom: "var(--space-7)", overflowX: 'auto' }}>
                    {activeSection.tables.map((tbl, tIdx) => (
                      <button
                        key={tbl.id || tIdx}
                        type="button"
                        style={{
                          padding: '7px 14px',
                          borderRadius: '8px 8px 0 0',
                          border: 'none',
                          background: activeTableIndex === tIdx ? 'var(--primary)' : 'var(--bg)',
                          color: activeTableIndex === tIdx ? 'var(--card)' : '#475569',
                          fontWeight: 700,
                          fontSize: "var(--text-base)",
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: "var(--space-2)",
                          whiteSpace: 'nowrap',
                        }}
                        onClick={() => setActiveTableIndex(tIdx)}
                      >
                        <span>📊 {tbl.title || `Table ${tIdx + 1}`}</span>
                        <span style={{ fontSize: "var(--text-2xs)", padding: '1px 5px', borderRadius: "var(--radius-sm)", background: activeTableIndex === tIdx ? 'rgba(255,255,255,0.25)' : 'var(--border)' }}>
                          {tbl.fields?.length || 0}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Active Table Columns Grid */}
                  {activeTable && (
                    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: "var(--radius-lg)", padding: "var(--space-7)" }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "var(--space-5)", flexWrap: 'wrap', gap: "var(--space-4)" }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: "var(--space-4)" }}>
                          <input
                            type="text"
                            value={activeTable.title}
                            onChange={(e) => handleUpdateTableTitle(activeTableIndex, e.target.value)}
                            style={{ padding: '5px 10px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', fontSize: "var(--text-base)", fontWeight: 700 }}
                          />
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: "var(--space-2)", fontSize: "var(--text-base)", color: '#475569', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={activeTable.isRepeatable}
                              onChange={() => handleToggleTableRepeatable(activeTableIndex)}
                            />
                            <span>Dynamic Rows</span>
                          </label>
                        </div>

                        <div style={{ display: 'flex', gap: "var(--space-2)" }}>
                          <button
                            type="button"
                            style={{ padding: '5px 11px', borderRadius: "var(--radius-sm)", border: '1px solid #93c5fd', background: 'var(--accent-soft)', color: 'var(--primary-dark)', fontWeight: 700, fontSize: "var(--text-base)", cursor: 'pointer' }}
                            onClick={handleAddColumn}
                          >
                            + Add Column
                          </button>
                          {activeSection.tables.length > 1 && (
                            <button
                              type="button"
                              style={{ padding: '5px 10px', borderRadius: "var(--radius-sm)", border: '1px solid var(--red-200)', background: 'var(--card)', color: 'var(--red-700)', fontSize: "var(--text-base)", cursor: 'pointer' }}
                              onClick={() => handleDeleteTable(activeTableIndex)}
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>

                      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: "var(--radius-sm)" }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: "var(--text-base)" }}>
                          <thead>
                            <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                              <th style={{ padding: '8px 10px', width: '35px', color: 'var(--muted)' }}>#</th>
                              <th style={{ padding: '8px 10px', width: '30%', color: '#334155', fontWeight: 700 }}>Column Label</th>
                              <th style={{ padding: '8px 10px', width: '28%', color: '#334155', fontWeight: 700 }}>Field Type</th>
                              <th style={{ padding: '8px 10px', width: '26%', color: '#334155', fontWeight: 700 }}>Options / Notes</th>
                              <th style={{ padding: '8px 10px', width: '60px', textAlign: 'center', color: '#334155', fontWeight: 700 }}>Req?</th>
                              <th style={{ padding: '8px 10px', width: '40px', textAlign: 'center' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeTable.fields?.map((field, fIdx) => (
                              <tr key={field.id || fIdx} style={{ borderBottom: '1px solid var(--bg-alt)' }}>
                                <td style={{ padding: '8px 10px', color: 'var(--muted)', fontWeight: 600 }}>{fIdx + 1}</td>
                                <td style={{ padding: '8px 10px' }}>
                                  <input
                                    type="text"
                                    value={field.label}
                                    onChange={(e) => handleUpdateField(fIdx, 'label', e.target.value)}
                                    style={{ width: '100%', padding: '5px 8px', borderRadius: "var(--radius-2xs)", border: '1px solid var(--border-strong)', fontSize: "var(--text-base)", fontWeight: 600 }}
                                  />
                                </td>
                                <td style={{ padding: '8px 10px' }}>
                                  <select
                                    value={field.fieldType}
                                    onChange={(e) => handleUpdateField(fIdx, 'fieldType', e.target.value)}
                                    style={{ width: '100%', padding: '5px 8px', borderRadius: "var(--radius-2xs)", border: '1px solid var(--border-strong)', fontSize: "var(--text-base)", fontWeight: 650 }}
                                  >
                                    {FIELD_TYPES.map((ft) => (
                                      <option key={ft.value} value={ft.value}>
                                        {ft.label}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td style={{ padding: '8px 10px' }}>
                                  {field.fieldType === 'SELECT' ? (
                                    <input
                                      type="text"
                                      placeholder="Options (comma separated)"
                                      value={field.optionsString || ''}
                                      onChange={(e) => handleUpdateField(fIdx, 'optionsString', e.target.value)}
                                      style={{ width: '100%', padding: '5px 8px', borderRadius: "var(--radius-2xs)", border: '1px solid var(--border-strong)', fontSize: "var(--text-sm)" }}
                                    />
                                  ) : (
                                    <span style={{ fontSize: "var(--text-xs)", color: 'var(--muted)' }}>{field.fieldType}</span>
                                  )}
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                  <input
                                    type="checkbox"
                                    checked={field.isRequired}
                                    onChange={(e) => handleUpdateField(fIdx, 'isRequired', e.target.checked)}
                                    style={{ cursor: 'pointer' }}
                                  />
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                  <button
                                    type="button"
                                    style={{ border: 'none', background: 'transparent', color: 'var(--red-500)', cursor: 'pointer' }}
                                    onClick={() => handleDeleteField(fIdx)}
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
              )}
            </div>
          ) : (
            <div
              style={{
                border: '2px dashed var(--border-strong)',
                borderRadius: "var(--radius-lg)",
                padding: '40px 20px',
                textAlign: 'center',
                background: '#fafafa',
              }}
            >
              <div style={{ fontSize: "var(--text-5xl)", marginBottom: "var(--space-4)" }}>📑</div>
              <h4 style={{ margin: '0 0 6px', color: 'var(--ink)', fontWeight: 700 }}>No Full Schema Workbook Loaded</h4>
              <p style={{ margin: '0 0 16px', color: 'var(--muted)', fontSize: "var(--text-base)" }}>
                Upload an Excel file with multiple sheet tabs (Part A, Part B, etc.) or download the multi-part template below.
              </p>
              <button
                type="button"
                style={{
                  padding: '8px 18px',
                  borderRadius: "var(--radius-sm)",
                  border: '1px solid var(--accent-border)',
                  background: 'var(--accent-soft)',
                  color: 'var(--primary-dark)',
                  fontWeight: 700,
                  fontSize: "var(--text-base)",
                  cursor: 'pointer',
                }}
                onClick={handleDownloadFullSchemaTemplate}
              >
                📥 Download Full Multi-Part Template (.xlsx)
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
            {parsedSections.length > 0 && (
              <span style={{ fontSize: "var(--text-base)", fontWeight: 600, color: '#334155' }}>
                Summary: <strong>{parsedSections.length}</strong> Section(s), <strong>{totalTables}</strong> Tables, <strong>{totalColumns}</strong> Columns.
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
                background: parsedSections.length === 0 || importing ? 'var(--faint)' : 'var(--primary)',
                color: 'var(--card)',
                fontWeight: 700,
                fontSize: "var(--text-base)",
                cursor: parsedSections.length === 0 || importing ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: "var(--space-3)",
                boxShadow: parsedSections.length > 0 && !importing ? '0 2px 4px rgba(37,99,235,0.25)' : 'none',
              }}
              onClick={handleExecuteImport}
              disabled={parsedSections.length === 0 || importing}
            >
              {importing ? (
                <>
                  <div className="spinner-border spinner-border-sm" role="status"></div>
                  <span>Importing Full Form...</span>
                </>
              ) : (
                <>
                  <span>🚀 Import Entire Form ({parsedSections.length} Parts)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
