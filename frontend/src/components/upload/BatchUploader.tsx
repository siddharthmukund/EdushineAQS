import React, { useState, useRef } from 'react';
import { Upload, X, FileText, Loader2 } from 'lucide-react';

interface BatchUploaderProps {
  onBatchSubmit: (files: File[], model: string) => void;
  isProcessing: boolean;
  parsingProgress?: { current: number; total: number } | null;
  disabledToolTip?: string;
}

export const BatchUploader: React.FC<BatchUploaderProps> = ({ onBatchSubmit, isProcessing, parsingProgress, disabledToolTip }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [llmProvider, setLLMProvider] = useState<string>('claude-3-5-sonnet-20241022');
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (file) => file.type === 'application/pdf'
    );

    if (droppedFiles.length > 0) {
      setFiles((prev) => [...prev, ...droppedFiles].slice(0, 50));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(
        (file) => file.type === 'application/pdf'
      );
      setFiles((prev) => [...prev, ...selectedFiles].slice(0, 50));
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (files.length === 0) {
      alert('Please upload CVs.');
      return;
    }

    onBatchSubmit(files, llmProvider);
  };

  const getCostPerCV = (provider: string): number => {
    const costs: Record<string, number> = {
      'claude-3-5-sonnet-20241022': 0.05,
      'gpt-4o': 0.08,
      'gemini-2.0-flash-exp': 0.03,
    };
    return costs[provider] || 0.05;
  };

  const isDisabled = files.length === 0 || !!disabledToolTip || isProcessing;

  return (
    <div className="space-y-6 bg-white rounded-xl shadow-lg p-8">
      <h3 className="text-xl font-bold mb-6 border-b pb-3">
        📄 Upload Candidates (Max 50)
      </h3>
      {/* File Upload Area */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${files.length >= 50 ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          disabled={files.length >= 50}
        />
        <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p className="text-lg font-medium text-gray-700">
          {isDragActive ? 'Drop CVs here' : 'Drag & drop CVs or click to browse'}
        </p>
        <p className="text-sm text-gray-500 mt-2">
          {files.length}/50 CVs uploaded • PDF files only
        </p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between bg-gray-50 rounded p-3"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="font-medium text-sm">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <button
                onClick={() => removeFile(index)}
                className="text-red-500 hover:text-red-700"
              >
                <X size={20} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* LLM Provider Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          AI Model
        </label>
        <select
          value={llmProvider}
          onChange={(e) => setLLMProvider(e.target.value)}
          className="w-full border rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet ($0.05/CV)</option>
          <option value="gpt-4o">GPT-4o ($0.08/CV)</option>
          <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash ($0.03/CV)</option>
        </select>
      </div>

      {/* Submit Button */}
      {disabledToolTip && (
        <p className="text-amber-600 text-sm font-medium">{disabledToolTip}</p>
      )}
      <button
        onClick={handleSubmit}
        disabled={isDisabled}
        className="w-full relative flex items-center justify-center bg-blue-600 text-white rounded-lg py-3 font-medium
          hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed
          transition-colors shadow-sm overflow-hidden"
      >
        {parsingProgress && (
          <div
            className="absolute left-0 top-0 bottom-0 bg-blue-800 opacity-20"
            style={{ width: `${(parsingProgress.current / parsingProgress.total) * 100}%` }}
          />
        )}
        {parsingProgress ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Parsing CVs locally ({parsingProgress.current}/{parsingProgress.total})...
          </span>
        ) : isProcessing ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Uploading to Batch...
          </span>
        ) : (
          `Analyze ${files.length} CV${files.length !== 1 ? 's' : ''}`
        )}
      </button>

      {/* Cost Estimate */}
      {files.length > 0 && (
        <div className="bg-blue-50 rounded-lg p-4 text-sm mt-3 border border-blue-100">
          <p className="font-medium text-blue-900">Estimated Cost</p>
          <p className="text-blue-700 mt-1">
            ${(files.length * getCostPerCV(llmProvider)).toFixed(2)}
            <span className="text-xs ml-2">(with 65% caching savings after 1st CV)</span>
          </p>
          <p className="text-blue-600 text-xs mt-1">
            Processing time: ~{Math.ceil(files.length * 18 / 60)} minutes
          </p>
        </div>
      )}
    </div>
  );
};
