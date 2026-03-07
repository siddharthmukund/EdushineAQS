import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure worker src
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

import mammoth from 'mammoth';
import { extractJDStructure } from '../utils/jdParser';

self.addEventListener('message', async (e: MessageEvent) => {
    const { file, fileType, fileName } = e.data;

    try {
        let text = '';

        if (fileType === 'application/pdf') {
            text = await parsePDF(file);
        } else if (
            fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            fileType === 'application/msword' ||
            fileName.endsWith('.docx')
        ) {
            text = await parseDOCX(file);
        } else {
            throw new Error(`Unsupported file type: ${fileType}`);
        }

        // Extract structured data
        const structured = extractJDStructure(text);

        self.postMessage({
            success: true,
            rawText: text,
            structured: structured,
            fileName
        });
    } catch (error: any) {
        self.postMessage({
            success: false,
            error: error.message || 'Unknown parsing error'
        });
    }
});

async function parsePDF(arrayBuffer: ArrayBuffer): Promise<string> {
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';
    const numPages = pdf.numPages;
    // Limit to 15 pages as per spec
    const maxPages = Math.min(numPages, 15);

    for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n\n';
    }

    return fullText;
}

async function parseDOCX(arrayBuffer: ArrayBuffer): Promise<string> {
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
}
