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
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'webp':
    case 'gif':
    case 'bmp':
    case 'svg':
      return {
        category: 'image',
        label: ext === 'jpeg' ? 'JPG' : ext.toUpperCase(),
        color: '#ec4899',
        bgColor: 'rgba(236, 72, 153, 0.15)',
        icon: 'image',
      };
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
        bgColor: 'rgba(168, 185, 129, 0.15)',
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
    case 'mp4':
    case 'webm':
    case 'mov':
    case 'mkv':
    case 'avi':
    case 'wmv':
    case 'flv':
      return {
        category: 'video',
        label: ext.toUpperCase(),
        color: '#f59e0b',
        bgColor: 'rgba(245, 158, 11, 0.15)',
        icon: 'video',
      };
    case 'mp3':
    case 'wav':
    case 'ogg':
    case 'm4a':
    case 'aac':
    case 'flac':
    case 'wma':
      return {
        category: 'audio',
        label: ext.toUpperCase(),
        color: '#8b5cf6',
        bgColor: 'rgba(139, 92, 246, 0.15)',
        icon: 'audio',
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
 * Resize and compress image using HTML Canvas for optimal LLM Vision processing
 * Prevents "Payload Too Large" and "Rate Limit (7000 ITPM)" errors on Groq Cloud
 */
function parseImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let { width, height } = img;

          // Ensure minimum dimensions (Groq requires >= 32px)
          if (width < 64 || height < 64) {
            const minScale = Math.max(64 / (width || 1), 64 / (height || 1));
            width = Math.round(width * minScale);
            height = Math.round(height * minScale);
          }

          // Scale down to max 960px to preserve low token consumption on Groq Vision models
          const MAX_DIM = 960;
          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');

          // White background for transparency support
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          // Compress to optimal 0.80 JPEG for fast streaming and low token cost
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.80);
          resolve({
            text: `[Attached Image: ${file.name}]`,
            dataUrl: compressedDataUrl,
            isImage: true,
          });
        } catch (err) {
          console.warn('Canvas compression fallback to raw image:', err);
          resolve({
            text: `[Attached Image: ${file.name}]`,
            dataUrl: e.target.result,
            isImage: true,
          });
        }
      };

      img.onerror = () => {
        reject(new Error(`Failed to load image: ${file.name}`));
      };

      img.src = e.target.result;
    };


    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
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

  return { text: fullText.trim(), dataUrl: null, isImage: false };
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
    const csvContent = XLSX.utils.sheet_to_csv(sheet);
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

  return { text: extractedContent.trim(), dataUrl: null, isImage: false };
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

  return { text: `[Word Document: ${file.name}]\n\n${text.trim()}`, dataUrl: null, isImage: false };
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
      resolve({ text: `[File: ${file.name}]\n\n${content.trim()}`, dataUrl: null, isImage: false });
    };
    reader.onerror = () => reject(new Error('Failed to read file contents'));
    reader.readAsText(file);
  });
}

/**
 * Extract keyframe snapshot and metadata from Video using HTML5 Video + Canvas
 */
function parseVideo(file) {
  return new Promise((resolve) => {
    try {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;

      const videoUrl = URL.createObjectURL(file);
      video.src = videoUrl;

      video.onloadedmetadata = () => {
        // Seek to ~25% timestamp to capture a good representative frame
        const seekTime = Math.min(Math.max((video.duration || 1) * 0.25, 0.5), 10);
        video.currentTime = seekTime;
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = video.videoWidth || 640;
          let height = video.videoHeight || 360;

          // Scale down if larger than 1280px
          const MAX_DIM = 1280;
          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, width, height);

          const frameDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          const durationStr = video.duration ? `${Math.round(video.duration)}s` : 'Unknown duration';

          URL.revokeObjectURL(videoUrl);

          resolve({
            text: `[Attached Video File: ${file.name} | Duration: ${durationStr} | Resolution: ${video.videoWidth}x${video.videoHeight} | Format: ${file.type || 'video'}]\n(Key visual snapshot from the video is attached for AI analysis. Please describe what is happening in this video.)`,
            dataUrl: frameDataUrl,
            isImage: true,
            isVideo: true,
            duration: durationStr,
          });
        } catch (err) {
          console.warn('Canvas video frame extraction fallback:', err);
          URL.revokeObjectURL(videoUrl);
          resolve({
            text: `[Attached Video File: ${file.name} | Size: ${formatFileSize(file.size)} | Format: ${file.type || 'video'}]`,
            dataUrl: null,
            isImage: false,
            isVideo: true,
          });
        }
      };

      video.onerror = () => {
        URL.revokeObjectURL(videoUrl);
        resolve({
          text: `[Attached Video File: ${file.name} | Size: ${formatFileSize(file.size)}]`,
          dataUrl: null,
          isImage: false,
          isVideo: true,
        });
      };
    } catch (e) {
      resolve({
        text: `[Attached Video File: ${file.name} | Size: ${formatFileSize(file.size)}]`,
        dataUrl: null,
        isImage: false,
        isVideo: true,
      });
    }
  });
}

/**
 * Process Audio file and transcribe spoken audio via Whisper backend
 */
async function parseAudio(file) {
  let audioDuration = '';

  // Get duration via HTML5 Audio element
  try {
    const audio = new Audio();
    const objectUrl = URL.createObjectURL(file);
    audio.src = objectUrl;
    await new Promise((res) => {
      audio.onloadedmetadata = () => {
        audioDuration = `${Math.round(audio.duration || 0)}s`;
        URL.revokeObjectURL(objectUrl);
        res();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        res();
      };
      setTimeout(res, 800); // 800ms timeout safeguard
    });
  } catch {}

  // Convert audio to Base64 to transcribe via Whisper API
  try {
    const base64Data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const BACKEND_BASE = import.meta.env.VITE_BACKEND_API_URL
      ? import.meta.env.VITE_BACKEND_API_URL.replace(/\/api\/chat\/?$/, '')
      : '';
    const TRANSCRIBE_URL =
      import.meta.env.VITE_TRANSCRIBE_API_URL ||
      (BACKEND_BASE ? `${BACKEND_BASE}/api/transcribe` : '/api/transcribe');

    const response = await fetch(TRANSCRIBE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioBase64: base64Data,
        mimeType: file.type || 'audio/mpeg',
        fileName: file.name,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.text && data.text.trim()) {
        return {
          text: `[Attached Audio File: ${file.name} | Duration: ${audioDuration || 'N/A'}]\n[Spoken Audio Transcription]: "${data.text.trim()}"\n\n(Note: The user attached an audio file. The above is its transcribed speech/content. Please analyze and answer the user's questions about this audio in detail.)`,
          dataUrl: null,
          isImage: false,
          isAudio: true,
          transcript: data.text.trim(),
        };
      } else {
        return {
          text: `[Attached Audio File: ${file.name} | Duration: ${audioDuration || 'N/A'} | Size: ${formatFileSize(file.size)}]\n[Audio Content]: (Audio track/music file. No spoken dialogue detected.)\n\n(Note: The user attached an audio track. Please describe and answer the user's questions about this audio.)`,
          dataUrl: null,
          isImage: false,
          isAudio: true,
        };
      }
    }
  } catch (err) {
    console.warn('Whisper transcription fallback to metadata:', err);
  }

  return {
    text: `[Attached Audio File: ${file.name} | Duration: ${audioDuration || 'N/A'} | Size: ${formatFileSize(file.size)}]\n\n(Note: The user attached this audio file. Please answer the user's questions about this audio.)`,
    dataUrl: null,
    isImage: false,
    isAudio: true,
  };
}

/**
 * Main dispatcher to parse any supported file, image, video or audio
 */
export async function extractTextFromFile(file) {
  if (!file) {
    throw new Error('No file provided');
  }

  const ext = file.name.slice(((file.name.lastIndexOf('.') - 1) >>> 0) + 2).toLowerCase();

  try {
    switch (ext) {
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'webp':
      case 'gif':
      case 'bmp':
      case 'svg':
        return await parseImage(file);

      case 'mp4':
      case 'webm':
      case 'mov':
      case 'mkv':
      case 'avi':
      case 'wmv':
      case 'flv':
        return await parseVideo(file);

      case 'mp3':
      case 'wav':
      case 'ogg':
      case 'm4a':
      case 'aac':
      case 'flac':
      case 'wma':
        return await parseAudio(file);

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

