import { PDFParse } from 'pdf-parse';
import * as XLSX from 'xlsx';

/**
 * Extracts page-by-page text with page number metadata from a PDF buffer.
 * @param {Buffer} buffer - Raw PDF buffer
 * @returns {Promise<{ fileType: 'pdf', totalPages: number, pages: Array<{ pageNumber: number, text: string }> }>}
 */
export async function parsePdf(buffer) {
  let parser = null;
  try {
    parser = new PDFParse({ data: buffer });
    const textResult = await parser.getText();
    const infoResult = await parser.getInfo();
    const totalPages = textResult.total || infoResult.total || (textResult.pages ? textResult.pages.length : 1);

    const pages = [];

    if (Array.isArray(textResult.pages) && textResult.pages.length > 0) {
      for (const p of textResult.pages) {
        const cleanedText = (p.text || '').trim();
        if (cleanedText) {
          pages.push({
            pageNumber: p.num || pages.length + 1,
            text: cleanedText,
          });
        }
      }
    } else if (textResult.text && textResult.text.trim()) {
      pages.push({
        pageNumber: 1,
        text: textResult.text.trim(),
      });
    }

    return {
      fileType: 'pdf',
      totalPages,
      pages,
    };
  } catch (error) {
    console.error('❌ [Parser Service] PDF parsing error:', error.message);
    throw new Error(`Failed to parse PDF: ${error.message}`);
  } finally {
    if (parser && typeof parser.destroy === 'function') {
      try {
        await parser.destroy();
      } catch {
        // Safe cleanup
      }
    }
  }
}

/**
 * Extracts sheets, headers, and row data from Excel (.xlsx, .xls) or CSV buffer.
 * @param {Buffer} buffer - Raw spreadsheet buffer
 * @returns {Promise<{ fileType: 'excel'|'csv', sheetNames: string[], sheets: Array<{ sheetName: string, headers: string[], rows: any[][], totalRows: number }> }>}
 */
export async function parseExcel(buffer) {
  try {
    const workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: true,
      raw: false,
    });

    const sheets = [];

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) continue;

      // Extract 2D array of row values (header: 1)
      const rawMatrix = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
        blankrows: false,
      });

      if (!rawMatrix || rawMatrix.length === 0) continue;

      // Clean rows and extract header row
      const cleanRows = rawMatrix
        .map((row) => (Array.isArray(row) ? row.map((c) => (c !== null && c !== undefined ? String(c).trim() : '')) : []))
        .filter((row) => row.some((c) => c !== ''));

      if (cleanRows.length === 0) continue;

      const headers = cleanRows[0].map((h, i) => (h && h.trim().length > 0 ? h.trim() : `Column_${i + 1}`));
      const dataRows = cleanRows.slice(1);

      sheets.push({
        sheetName,
        headers,
        rows: dataRows,
        totalRows: dataRows.length,
      });
    }

    return {
      fileType: 'excel',
      sheetNames: workbook.SheetNames,
      sheets,
    };
  } catch (error) {
    console.error('❌ [Parser Service] Excel/CSV parsing error:', error.message);
    throw new Error(`Failed to parse spreadsheet: ${error.message}`);
  }
}

/**
 * Universal document parser dispatcher based on filename and mimetype.
 * @param {Object} params
 * @param {Buffer} params.buffer - Uploaded file buffer
 * @param {string} params.originalname - Original filename
 * @param {string} [params.mimetype] - File MIME type
 * @returns {Promise<Object>}
 */
export async function parseDocument({ buffer, originalname = '', mimetype = '' }) {
  const ext = originalname.toLowerCase().split('.').pop() || '';

  if (ext === 'pdf' || mimetype.includes('pdf')) {
    const parsed = await parsePdf(buffer);
    return {
      fileName: originalname,
      ...parsed,
    };
  }

  if (['xlsx', 'xls', 'csv'].includes(ext) || mimetype.includes('spreadsheet') || mimetype.includes('csv')) {
    const parsed = await parseExcel(buffer);
    return {
      fileName: originalname,
      ...parsed,
      fileType: ext === 'csv' ? 'csv' : 'excel',
    };
  }

  // Plain text, markdown, or code fallback
  const rawText = buffer.toString('utf-8').trim();
  return {
    fileName: originalname,
    fileType: ext || 'text',
    totalPages: 1,
    pages: [
      {
        pageNumber: 1,
        text: rawText,
      },
    ],
  };
}

export default {
  parsePdf,
  parseExcel,
  parseDocument,
};
