import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

/**
 * Splits document pages (PDF / Text) into chunks with character overlap.
 * Preserves pageNumber metadata across chunks.
 *
 * @param {Array<{ pageNumber: number, text: string }>} pages - Parsed document pages
 * @param {Object} [options]
 * @param {number} [options.chunkSize=800] - Target characters per chunk
 * @param {number} [options.chunkOverlap=150] - Character overlap between chunks
 * @returns {Promise<Array<{ text: string, pageNumber: number, chunkIndex: number }>>}
 */
export async function chunkTextPages(pages, options = {}) {
  const chunkSize = options.chunkSize || 800;
  const chunkOverlap = options.chunkOverlap || 150;

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
    separators: ['\n\n', '\n', '. ', '? ', '! ', ' ', ''],
  });

  const chunks = [];

  for (const page of pages) {
    if (!page.text || !page.text.trim()) continue;

    const pageChunks = await splitter.splitText(page.text);

    for (let i = 0; i < pageChunks.length; i++) {
      const text = pageChunks[i].trim();
      if (!text) continue;

      chunks.push({
        text,
        pageNumber: page.pageNumber || 1,
        sheetName: null,
        chunkIndex: chunks.length,
      });
    }
  }

  return chunks;
}

/**
 * Splits Excel/CSV sheets into row-group based chunks with table headers included in every chunk.
 * Preserves row-level context and includes row overlap.
 *
 * @param {Array<{ sheetName: string, headers: string[], rows: any[][], totalRows: number }>} sheets
 * @param {Object} [options]
 * @param {number} [options.rowsPerChunk=15] - Number of data rows per chunk
 * @param {number} [options.rowOverlap=2] - Number of rows overlapping between consecutive chunks
 * @returns {Array<{ text: string, sheetName: string, pageNumber: null, startRow: number, endRow: number, chunkIndex: number }>}
 */
export function chunkExcelSheets(sheets, options = {}) {
  const rowsPerChunk = options.rowsPerChunk || 15;
  const rowOverlap = options.rowOverlap || 2;
  const chunks = [];

  for (const sheet of sheets) {
    const { sheetName, headers, rows } = sheet;

    if (!rows || rows.length === 0) {
      // If sheet has only headers or empty rows
      if (headers && headers.length > 0) {
        chunks.push({
          text: `[Sheet: ${sheetName}]\nHeaders: ${headers.join(' | ')}\n(No data rows available)`,
          sheetName,
          pageNumber: null,
          startRow: 0,
          endRow: 0,
          chunkIndex: chunks.length,
        });
      }
      continue;
    }

    // Step size ensures rowOverlap between chunks
    const step = Math.max(1, rowsPerChunk - rowOverlap);

    for (let start = 0; start < rows.length; start += step) {
      const end = Math.min(rows.length, start + rowsPerChunk);
      const rowSlice = rows.slice(start, end);

      // Build tabular representation with headers repeated in every chunk
      const tableLines = [];
      tableLines.push(`[Sheet: ${sheetName} | Rows ${start + 1} to ${end} of ${rows.length}]`);

      // Markdown Table format:
      // | Col1 | Col2 | Col3 |
      // | --- | --- | --- |
      // | Val1 | Val2 | Val3 |
      const headerRow = `| ${headers.join(' | ')} |`;
      const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;

      tableLines.push(headerRow);
      tableLines.push(separatorRow);

      for (let r = 0; r < rowSlice.length; r++) {
        const rowData = rowSlice[r];
        // Ensure every cell has corresponding header value
        const formattedCells = headers.map((_, colIdx) => {
          const val = rowData[colIdx];
          return val !== null && val !== undefined ? String(val).replace(/\|/g, '/') : '-';
        });
        tableLines.push(`| ${formattedCells.join(' | ')} |`);
      }

      chunks.push({
        text: tableLines.join('\n'),
        sheetName,
        pageNumber: null,
        startRow: start + 1,
        endRow: end,
        chunkIndex: chunks.length,
      });

      // Break if we reached the end of rows
      if (end >= rows.length) break;
    }
  }

  return chunks;
}

/**
 * Universal chunking dispatcher for parsed documents.
 * Automatically delegates to text page chunking or Excel row-group chunking.
 *
 * @param {Object} parsedDoc - Result of parser.service.js
 * @param {Object} [options]
 * @returns {Promise<Array<{ text: string, pageNumber?: number, sheetName?: string, chunkIndex: number, totalChunks: number }>>}
 */
export async function chunkDocument(parsedDoc, options = {}) {
  let chunks = [];

  if (parsedDoc.fileType === 'excel' || parsedDoc.fileType === 'csv') {
    chunks = chunkExcelSheets(parsedDoc.sheets || [], options);
  } else {
    chunks = await chunkTextPages(parsedDoc.pages || [], options);
  }

  // Assign totalChunks count to all generated chunks
  const totalChunks = chunks.length;
  return chunks.map((c, idx) => ({
    ...c,
    chunkIndex: idx,
    totalChunks,
  }));
}

export default {
  chunkTextPages,
  chunkExcelSheets,
  chunkDocument,
};
