import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure worker src — tells pdfjs where to find its own decode worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

// @ts-ignore
import mammoth from 'mammoth/mammoth.browser.js';
import { extractJDStructure } from '../utils/jdParser';

// Track whether a parse is currently active so we can report errors
let parseActive = false;

// Catch any unhandled promise rejections that escape the try/catch
// (e.g., from pdfjs internal async operations)
self.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    e.preventDefault();
    if (parseActive) {
        parseActive = false;
        self.postMessage({
            success: false,
            error: (e.reason?.message || String(e.reason)) || 'Unhandled async error in JD parser'
        });
    }
});

// Catch synchronous global errors
self.addEventListener('error', (e: ErrorEvent) => {
    if (parseActive) {
        parseActive = false;
        self.postMessage({
            success: false,
            error: e.message || 'Global error in JD parser worker'
        });
    }
});

self.addEventListener('message', async (e: MessageEvent) => {
    const { file, fileType, fileName } = e.data;

    parseActive = true;

    try {
        let text = '';

        if (fileType === 'application/pdf') {
            text = await parsePDF(file);
        } else if (
            fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            fileName.endsWith('.docx')
        ) {
            if (fileName.endsWith('.doc') && !fileName.endsWith('.docx')) {
                throw new Error('Unsupported file type: .doc files are not supported. Please convert to .docx or .pdf.');
            }
            text = await parseDOCX(file);
        } else {
            throw new Error(`Unsupported file type: ${fileType}. Please upload a .pdf or .docx file.`);
        }

        // Extract structured data
        const structured = extractJDStructure(text);

        parseActive = false;
        self.postMessage({
            success: true,
            rawText: text,
            structured: structured,
            fileName
        });
    } catch (error: any) {
        parseActive = false;
        self.postMessage({
            success: false,
            error: error.message || 'Unknown parsing error'
        });
    }
});

async function parsePDF(arrayBuffer: ArrayBuffer): Promise<string> {
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    let fullText = '';
    const numPages = pdf.numPages;
    // Limit to 15 pages as per spec
    const maxPages = Math.min(numPages, 15);

    for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
            .filter((item: any) => typeof item.str === 'string')
            .map((item: any) => item.str)
            .join(' ');
        fullText += pageText + '\n\n';
    }

    await pdf.destroy();
    return fullText.trim();
}

async function parseDOCX(arrayBuffer: ArrayBuffer): Promise<string> {
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
}
