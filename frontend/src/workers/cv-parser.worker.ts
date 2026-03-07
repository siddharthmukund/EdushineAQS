import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Tell PDF.js where to find the worker script
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

self.onmessage = async (e: MessageEvent) => {
    const { cvFile, jobId } = e.data;

    try {
        if (!cvFile || cvFile.type !== 'application/pdf') {
            throw new Error('Invalid file type. Only PDF is supported.');
        }

        const arrayBuffer = await cvFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
                // @ts-ignore
                .map((item) => item.str)
                .join(' ');

            fullText += pageText + '\\n\\n';
        }

        self.postMessage({
            success: true,
            jobId,
            text: fullText.trim(),
            filename: cvFile.name
        });

    } catch (error: any) {
        self.postMessage({
            success: false,
            jobId,
            error: error.message || 'Failed to parse CV PDF'
        });
    }
};
