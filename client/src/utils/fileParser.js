import * as pdfjsLib from 'pdfjs-dist';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';

// Configure PDF.js worker
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
} catch (e) {
  console.warn('PDF.js worker initialization notice:', e);
}

// Maximum characters to extract before truncating for LLM context preservation
const MAX_EXTRACTED_CHARS = 60000;

/**
 * Format bytes to readable string (e.g., 2.4 MB)
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Get file categorization and badge metadata
 */
export function getFileTypeInfo(fileName = '') {
  const ext = fileName.slice(((fileName.lastIndexOf('.') - 1) >>> 0) + 2).toLowerCase();

  switch (ext) {
    case 'pdf':
      return {
        category: 'pdf',
        label: 'PDF',
        color: '#ef4444',
        bgColor: 'rgba(239, 68, 68, 0.15)',
        icon: 'pdf',
      };
    case 'xlsx':
    case 'xls':
    case 'csv':
      return {
        category: 'excel',
        label: ext.toUpperCase(),
        color: '#10b981',
        bgColor: 'rgba(16, 185, 129, 0.15)',
        icon: 'excel',
      };
    case 'docx':
    case 'doc':
      return {
        category: 'word',
        label: 'DOCX',
        color: '#3b82f6',
        bgColor: 'rgba(59, 130, 246, 0.15)',
        icon: 'word',
      };
    case 'json':
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
    case 'py':
    case 'html':
    case 'css':
    case 'sql':
    case 'xml':
    case 'yaml':
    case 'yml':
    case 'sh':
      return {
        category: 'code',
        label: ext.toUpperCase(),
        color: '#a855f7',
        bgColor: 'rgba(168, 85, 247, 0.15)',
        icon: 'code',
      };
    case 'txt':
    case 'md':
    case 'log':
      return {
        category: 'text',
        label: ext.toUpperCase(),
        color: '#06b6d4',
        bgColor: 'rgba(6, 182, 212, 0.15)',
        icon: 'text',
      };
    default:
      return {
        category: 'file',
        label: ext ? ext.toUpperCase() : 'FILE',
        color: '#94a3b8',
        bgColor: 'rgba(148, 163, 184, 0.15)',
        icon: 'file',
      };
  }
}

/**
 * Extract text from PDF using PDF.js
 */
async function parsePdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  let fullText = `[PDF Document: ${file.name} | Total Pages: ${numPages}]\n\n`;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(' ');
    
    fullText += `--- Page ${pageNum} ---\n${pageText}\n\n`;

    if (fullText.length > MAX_EXTRACTED_CHARS) {
      fullText += `\n[Note: Document truncated at Page ${pageNum} due to context length limit]\n`;
      break;
    }
  }

  return fullText.trim();
}

/**
 * Extract data from Excel / CSV files using SheetJS
 */
async function parseExcel(file) {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  let extractedContent = `[Spreadsheet: ${file.name} | Total Sheets: ${workbook.SheetNames.length}]\n\n`;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    // Convert sheet to CSV format for clear tabular representation
    const csvContent = XLSX.utils.sheet_to_csv(sheet);
    
    // Also extract row count
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const rowCount = rows.length;
    const colCount = rows[0]?.length || 0;

    extractedContent += `### Sheet: "${sheetName}" (${rowCount} rows, ${colCount} columns)\n`;
    extractedContent += '```csv\n';
    extractedContent += csvContent || '(Empty Sheet)';
    extractedContent += '\n```\n\n';

    if (extractedContent.length > MAX_EXTRACTED_CHARS) {
      extractedContent += `\n[Note: Spreadsheet truncated due to large data size]\n`;
      break;
    }
  }

  return extractedContent.trim();
}

/**
 * Extract text from Word (.docx) files using Mammoth
 */
async function parseWord(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  let text = result.value || '';

  if (text.length > MAX_EXTRACTED_CHARS) {
    text = text.substring(0, MAX_EXTRACTED_CHARS) + '\n\n[Note: Document truncated due to length]';
  }

  return `[Word Document: ${file.name}]\n\n${text.trim()}`;
}

/**
 * Extract text from plain text, code, JSON, markdown, etc.
 */
function parseText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      let content = reader.result || '';
      if (content.length > MAX_EXTRACTED_CHARS) {
        content = content.substring(0, MAX_EXTRACTED_CHARS) + '\n\n[Note: File truncated due to length]';
      }
      resolve(`[File: ${file.name}]\n\n${content.trim()}`);
    };
    reader.onerror = () => reject(new Error('Failed to read file contents'));
    reader.readAsText(file);
  });
}

/**
 * Main dispatcher to parse any supported file
 */
export async function extractTextFromFile(file) {
  if (!file) {
    throw new Error('No file provided');
  }

  const ext = file.name.slice(((file.name.lastIndexOf('.') - 1) >>> 0) + 2).toLowerCase();

  try {
    switch (ext) {
      case 'pdf':
        return await parsePdf(file);

      case 'xlsx':
      case 'xls':
      case 'csv':
        return await parseExcel(file);

      case 'docx':
        return await parseWord(file);

      case 'txt':
      case 'md':
      case 'json':
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
      case 'py':
      case 'html':
      case 'css':
      case 'sql':
      case 'xml':
      case 'yaml':
      case 'yml':
      case 'sh':
      case 'log':
      default:
        return await parseText(file);
    }
  } catch (err) {
    console.error(`Error parsing file ${file.name}:`, err);
    throw new Error(`Could not parse ${file.name}: ${err.message}`);
  }
}
