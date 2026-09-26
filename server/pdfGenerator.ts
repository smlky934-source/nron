import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import Reshaper from 'arabic-persian-reshaper';

export interface GeneratePdfOptions {
  title: string;
  subtitle?: string;
  content: string;
  author?: string;
  dateStr?: string;
}

// Remove emojis or unsupported astral plane unicode symbols that crash standard PDF TTF engines
function sanitizeText(str: string): string {
  if (!str) return '';
  return str
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '') // Remove surrogate pairs (emojis)
    .replace(/[\u2600-\u27BF]/g, '') // Miscellaneous Symbols & Dingbats
    .replace(/[\uFE00-\uFE0F]/g, ''); // Variation Selectors
}

// Clean inline Markdown syntax (bold, italic, code, links)
function cleanMarkdownInline(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*{3,}/g, '') // Remove ***
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove **bold**
    .replace(/\*(.*?)\*/g, '$1') // Remove *italic*
    .replace(/__(.*?)__/g, '$1') // Remove __bold__
    .replace(/_(.*?)_/g, '$1') // Remove _italic_
    .replace(/`([^`]+)`/g, '$1') // Remove `code`
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Clean links [Text](url) -> Text
    .trim();
}

// Normalize spacing between Persian and English, and fix glued prepositions/ZWNJs
function normalizeText(text: string): string {
  if (!text) return '';
  return text
    // Space between English letters/numbers and Persian characters
    .replace(/([A-Za-z0-9])([\u0600-\u06FF])/g, '$1 $2')
    .replace(/([\u0600-\u06FF])([A-Za-z0-9])/g, '$1 $2')
    // Space between parentheses/brackets and Persian characters
    .replace(/([A-Za-z0-9\)])([\u0600-\u06FF])/g, '$1 $2')
    .replace(/([\u0600-\u06FF])([\(\[])/g, '$1 $2')
    .replace(/([\u0600-\u06FF])([\)\]])/g, '$1 $2')
    // Fix prepositions glued with ZWNJ or lacking space
    .replace(/\b(در|با|از|به|برای|که|یک|این|آن|تا|بر)\u200c/g, '$1 ')
    .replace(/\u200c(با|در|از|به|برای|که|یک|این|آن)(?=[^\u0600-\u06FF]|$|\s)/g, ' $1')
    .replace(/(یک|تعریف|آشنایی|راهنمای|درباره|اجزای|کاربردهای|انواع|معرفی|مفاهیم|ویژگی‌های|مزایای)\u200c/g, '$1 ')
    .replace(/های\u200c(?=[\u0600-\u06FF])/g, 'های ')
    .replace(/(?:^|\s)در(هوش|علم|واقع|حال|سراسر|دسترس|برابر|کنار|طول|میان)(?=\s|[.:،؛!؟]|$)/g, ' در $1')
    // Fix bullets like "-محیط" -> "- محیط"
    .replace(/^-([^\s])/gm, '- $1');
}

// Tokenize text keeping English phrases, pure Latin parentheses, and acronyms atomic so LTR order is preserved
function tokenizeRTLText(text: string): string[] {
  const norm = normalizeText(cleanMarkdownInline(text));
  // 1. Pure Latin parenthesized/bracketed expressions: e.g. "(AI Agents)", "(Perception)", "(Planning & Reasoning)", "(Tool Use)"
  //    MUST NOT contain any Persian/Arabic characters.
  // 2. Multi-word Latin phrases / versions / tools: e.g. "Claude 3.5", "ChatGPT", "Vector Databases", "GPT-4"
  // 3. Standalone parentheses and brackets: ( ) [ ] { }
  // 4. Any other non-whitespace token (Persian words, punctuation, etc.)
  const regex = /\([A-Za-z0-9\s&.,:;_\-\/+#]+\)[:.]?|\[[A-Za-z0-9\s&.,:;_\-\/+#]+\][:.]?|[A-Za-z0-9]+(?:[\s.\-_/][A-Za-z0-9]+)*[:.]?|[()\[\]{}]|[^\s()\[\]{}]+/g;
  return norm.match(regex) || [];
}

// Reshape a single Persian token while preserving English phrases, parentheses, and numbers
function reshapeToken(token: string): string {
  if (!token) return '';
  const sanitized = sanitizeText(token);

  // Pure Latin parenthesized expression (e.g. "(AI Agents)", "(Perception)") or Latin phrase (e.g. "ChatGPT")
  if (/^[\(\[]?[A-Za-z0-9\s&.,:;_\-\/+#]+[\)\]]?[:.]?$/.test(sanitized)) {
    return sanitized;
  }

  // Bullet or dash
  if (sanitized === '•' || sanitized === '-') return sanitized;

  // Single brackets or punctuation
  if (/^[()\[\]{}«»"':;,.!؟،؛]+$/.test(sanitized)) {
    return sanitized;
  }

  // Persian/Arabic word (may contain punctuation like "هستند." or "کرده،")
  if (/[\u0600-\u06FF]/.test(sanitized)) {
    try {
      return Reshaper.PersianShaper.convertArabic(sanitized);
    } catch {
      return sanitized;
    }
  }

  // Fallback as-is
  return sanitized;
}

// Renders RTL text with word-wrap calculation and token-reversal for PDFKit's LTR engine
function renderRTLBlock(
  doc: PDFKit.PDFDocument,
  rawText: string,
  opts: {
    width?: number;
    align?: 'right' | 'center' | 'left';
    lineGap?: number;
    font?: string;
    fontSize?: number;
    color?: string;
  } = {}
) {
  const width = opts.width ?? 495;
  const align = opts.align ?? 'right';
  const lineGap = opts.lineGap ?? 4;

  if (opts.font) {
    try {
      doc.font(opts.font);
    } catch {}
  }
  if (opts.fontSize) doc.fontSize(opts.fontSize);
  if (opts.color) doc.fillColor(opts.color);

  const lines = rawText.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      doc.moveDown(0.3);
      continue;
    }

    const tokens = tokenizeRTLText(trimmed);
    const reshapedTokens = tokens.map(reshapeToken).filter(Boolean);

    let currentLineTokens: string[] = [];
    let currentWidth = 0;

    for (let i = 0; i < reshapedTokens.length; i++) {
      const rToken = reshapedTokens[i];
      let tokenWidth = 10;
      try {
        tokenWidth = doc.widthOfString(rToken + ' ');
      } catch {
        tokenWidth = rToken.length * (opts.fontSize ? opts.fontSize * 0.55 : 6);
      }

      if (currentLineTokens.length > 0 && currentWidth + tokenWidth > width) {
        // Output current line: reverse reshaped tokens so the first Persian token goes to the right
        const lineStr = currentLineTokens.reverse().join(' ');
        try {
          doc.text(lineStr, { align, width, lineGap });
        } catch {
          doc.text(lineStr, { align });
        }
        currentLineTokens = [rToken];
        currentWidth = tokenWidth;
      } else {
        currentLineTokens.push(rToken);
        currentWidth += tokenWidth;
      }
    }

    if (currentLineTokens.length > 0) {
      const lineStr = currentLineTokens.reverse().join(' ');
      try {
        doc.text(lineStr, { align, width, lineGap });
      } catch {
        doc.text(lineStr, { align });
      }
    }
  }
}

// Fixed-position line rendering (e.g., for footers)
function renderRTLLineAt(
  doc: PDFKit.PDFDocument,
  rawText: string,
  x: number,
  y: number,
  width: number,
  align: 'right' | 'center' | 'left' = 'center'
) {
  const tokens = tokenizeRTLText(rawText.trim());
  const reshapedTokens = tokens.map(reshapeToken).filter(Boolean);
  const lineStr = reshapedTokens.reverse().join(' ');
  const oldBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  try {
    doc.text(lineStr, x, y, { width, align, lineBreak: false });
  } catch {}
  doc.page.margins.bottom = oldBottom;
}

function parseAndRenderTable(
  doc: PDFKit.PDFDocument,
  tableText: string,
  fontReg: string,
  hasPersianFont: boolean
) {
  const lines = tableText.split('\n').map((l) => l.trim()).filter(Boolean);
  const rows = lines
    .filter((l) => !l.match(/^\|?\s*[-:]+[-| :]*$/))
    .map((l) =>
      l
        .split('|')
        .map((cell) => cleanMarkdownInline(cell.trim()))
        .filter((cell, idx, arr) => !(idx === 0 && cell === '') && !(idx === arr.length - 1 && cell === ''))
    )
    .filter((row) => row.length > 0);

  if (rows.length <= 1) return;

  const header = rows[0];
  const dataRows = rows.slice(1);

  doc.moveDown(0.3);
  for (const row of dataRows) {
    if (row.length >= 2) {
      const label = row[0];
      const details = row
        .slice(1)
        .map((val, idx) => {
          const colTitle = header[idx + 1] ? `${header[idx + 1]}: ` : '';
          return `${colTitle}${val}`;
        })
        .join('  |  ');

      const formattedLine = `• ${label} ◄ ${details}`;
      if (hasPersianFont) {
        renderRTLBlock(doc, formattedLine, {
          font: fontReg,
          fontSize: 10,
          color: '#334155',
          lineGap: 3,
        });
      } else {
        doc.font(fontReg).fontSize(10).fillColor('#334155').text(sanitizeText(formattedLine), { align: 'right', lineGap: 3 });
      }
    }
  }
  doc.moveDown(0.4);
}

function findFontPath(filename: string): string | null {
  const candidates = [
    path.join(process.cwd(), 'server', 'fonts', filename),
    path.join(process.cwd(), 'dist', 'server', 'fonts', filename),
    path.join(__dirname, 'fonts', filename),
    path.join(__dirname, '..', 'server', 'fonts', filename),
    path.join(process.cwd(), 'fonts', filename),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export async function createPdfBuffer(options: GeneratePdfOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 50,
        size: 'A4',
        bufferPages: true,
        info: {
          Title: sanitizeText(options.title),
          Author: options.author || 'Telegram AI Bot',
          CreationDate: new Date(),
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Font Registration with Vazirmatn
      const vazirReg = findFontPath('Vazirmatn-Regular.ttf');
      const vazirBold = findFontPath('Vazirmatn-Bold.ttf');

      let fontReg = 'Helvetica';
      let fontBold = 'Helvetica-Bold';
      let hasPersianFont = false;

      if (vazirReg && vazirBold) {
        try {
          doc.registerFont('PersianFont', vazirReg);
          doc.registerFont('PersianFont-Bold', vazirBold);
          fontReg = 'PersianFont';
          fontBold = 'PersianFont-Bold';
          hasPersianFont = true;
        } catch (e) {
          console.warn('[PDF] Failed to register Persian font, falling back:', e);
        }
      }

      // Header Banner Accent Line
      doc.rect(50, 45, 495, 4).fill('#4f46e5');
      doc.moveDown(1.2);

      // Title
      if (hasPersianFont) {
        renderRTLBlock(doc, options.title, {
          font: fontBold,
          fontSize: 17,
          color: '#1e293b',
          align: 'right',
        });
      } else {
        doc.font(fontBold).fontSize(17).fillColor('#1e293b').text(sanitizeText(options.title), { align: 'right' });
      }

      // Subtitle
      if (options.subtitle) {
        doc.moveDown(0.3);
        if (hasPersianFont) {
          renderRTLBlock(doc, options.subtitle, {
            font: fontReg,
            fontSize: 11.5,
            color: '#64748b',
            align: 'right',
          });
        } else {
          doc.font(fontReg).fontSize(11.5).fillColor('#64748b').text(sanitizeText(options.subtitle), { align: 'right' });
        }
      }

      // Metadata line
      doc.moveDown(0.5);
      const rawMeta = `تولید شده توسط هوش مصنوعی | تاریخ: ${options.dateStr || new Date().toISOString().split('T')[0]}`;
      if (hasPersianFont) {
        renderRTLBlock(doc, rawMeta, {
          font: fontReg,
          fontSize: 9,
          color: '#94a3b8',
          align: 'right',
        });
      } else {
        doc.font(fontReg).fontSize(9).fillColor('#94a3b8').text(sanitizeText(rawMeta), { align: 'right' });
      }

      // Horizontal separator
      doc.moveDown(0.8);
      doc
        .strokeColor('#e2e8f0')
        .lineWidth(1)
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke();

      doc.moveDown(1.2);

      // Content Body
      const paragraphs = options.content.split(/\n\s*\n/);
      const cleanTitleKey = cleanMarkdownInline(options.title).replace(/[^\u0600-\u06FF\w]/g, '').trim();

      let isFirstBlock = true;
      for (const para of paragraphs) {
        const trimmed = para.trim();
        if (!trimmed) continue;

        // 1. Check for duplicate title at the start
        if (isFirstBlock) {
          isFirstBlock = false;
          const candidateTitle = cleanMarkdownInline(trimmed.replace(/^#+\s*/, '')).replace(/[^\u0600-\u06FF\w]/g, '').trim();
          if (cleanTitleKey.length > 5 && candidateTitle.includes(cleanTitleKey.substring(0, 10))) {
            continue;
          }
        }

        // 2. Filter out redundant trailing signatures
        if (/(تهیه\s*شده\s*توسط|تولید\s*شده\s*توسط|دستیار\s*هوشمند|صفحه\s*\d+\s*از)/i.test(trimmed)) {
          continue;
        }

        // 3. Check for Markdown divider lines (--- or *** or ___)
        if (/^[-*_]{3,}$/.test(trimmed)) {
          doc.moveDown(0.3);
          doc.strokeColor('#e2e8f0').lineWidth(0.8).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
          doc.moveDown(0.4);
          continue;
        }

        // 4. Check for Markdown tables
        if (trimmed.includes('|') && trimmed.split('\n').filter((l) => l.includes('|')).length >= 2) {
          parseAndRenderTable(doc, trimmed, fontReg, hasPersianFont);
          continue;
        }

        // 5. Headings (#, ##, ###)
        if (trimmed.startsWith('# ') || trimmed.startsWith('## ') || trimmed.startsWith('### ')) {
          const rawHeading = cleanMarkdownInline(trimmed.replace(/^#+\s*/, ''));
          doc.moveDown(0.5);
          if (hasPersianFont) {
            renderRTLBlock(doc, rawHeading, {
              font: fontBold,
              fontSize: 12.5,
              color: '#0f172a',
              align: 'right',
            });
          } else {
            doc.font(fontBold).fontSize(12.5).fillColor('#0f172a').text(sanitizeText(rawHeading), { align: 'right' });
          }
          doc.moveDown(0.3);
        } else if (/^[-*•]/.test(trimmed) || /^[\d\u06F0-\u06F9]+[.)]/.test(trimmed)) {
          // 6. Bullet lists or numbered lists
          const items = trimmed.split('\n');
          for (const item of items) {
            let rawItem = item.trim();
            if (!rawItem) continue;
            if (/^[-*•]/.test(rawItem)) {
              rawItem = `• ${rawItem.replace(/^[-*•]\s*/, '').trim()}`;
            } else if (/^([\d\u06F0-\u06F9]+)[.)]\s*/.test(rawItem)) {
              rawItem = rawItem.replace(/^([\d\u06F0-\u06F9]+)[.)]\s*/, '$1. ');
            }
            rawItem = cleanMarkdownInline(rawItem);
            if (!rawItem) continue;

            if (hasPersianFont) {
              renderRTLBlock(doc, rawItem, {
                font: fontReg,
                fontSize: 10.5,
                color: '#334155',
                align: 'right',
                lineGap: 3,
              });
            } else {
              doc.font(fontReg).fontSize(10.5).fillColor('#334155').text(sanitizeText(rawItem), { align: 'right', lineGap: 3 });
            }
          }
          doc.moveDown(0.4);
        } else {
          // 7. Regular paragraph
          const cleanedText = cleanMarkdownInline(trimmed);
          if (hasPersianFont) {
            renderRTLBlock(doc, cleanedText, {
              font: fontReg,
              fontSize: 10.5,
              color: '#334155',
              align: 'right',
              lineGap: 4,
            });
          } else {
            doc.font(fontReg).fontSize(10.5).fillColor('#334155').text(sanitizeText(cleanedText), { lineGap: 4, align: 'right' });
          }
          doc.moveDown(0.5);
        }
      }

      // Footer
      try {
        const range = doc.bufferedPageRange();
        const totalPages = range.count || 1;
        for (let i = 0; i < totalPages; i++) {
          doc.switchToPage(range.start + i);
          const footerRaw = `صفحه ${i + 1} از ${totalPages} - ربات هوش مصنوعی تلگرام`;
          doc.fontSize(8);
          if (hasPersianFont) {
            doc.font(fontReg).fillColor('#94a3b8');
            renderRTLLineAt(doc, footerRaw, 50, 780, 495, 'center');
          } else {
            doc.font(fontReg).fillColor('#94a3b8');
            const oldBottom = doc.page.margins.bottom;
            doc.page.margins.bottom = 0;
            doc.text(sanitizeText(footerRaw), 50, 780, { align: 'center', width: 495, lineBreak: false });
            doc.page.margins.bottom = oldBottom;
          }
        }
      } catch (footerErr) {
        console.warn('[PDF] Error writing footer:', footerErr);
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

