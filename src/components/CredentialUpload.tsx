'use client';

import { useState, useRef } from 'react';
import { Upload, Plus, AlertCircle } from 'lucide-react';
import { VerifiableCredential } from '@/types/credential';
import { parseCredentialFile, CredentialError } from '@/utils/credentialUtils';

interface CredentialUploadProps {
  onCredentialAdded: (credential: VerifiableCredential) => void;
}

export function CredentialUpload({ onCredentialAdded }: CredentialUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showJsonInput, setShowJsonInput] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const jsonFiles = files.filter(file => 
      file.type === 'application/json' || file.name.endsWith('.json')
    );
    
    if (jsonFiles.length === 0) {
      setError('Please drop a valid JSON file');
      return;
    }
    
    for (const file of jsonFiles) {
      await processFile(file);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    for (const file of Array.from(files)) {
      await processFile(file);
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processFile = async (file: File) => {
    setIsUploading(true);
    setError(null);
    
    try {
      const credential = await parseCredentialFile(file);
      onCredentialAdded(credential);
    } catch (err) {
      if (err instanceof CredentialError) {
        setError(`Invalid credential: ${err.message}`);
      } else {
        setError('Failed to process file');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleJsonSubmit = async () => {
    if (!jsonInput.trim()) return;
    
    setIsUploading(true);
    setError(null);
    
    try {
      const parsed = JSON.parse(jsonInput);
      const { validateCredential } = await import('@/utils/credentialUtils');
      const credential = await validateCredential(parsed);
      onCredentialAdded(credential);
      setJsonInput('');
      setShowJsonInput(false);
    } catch (err) {
      if (err instanceof CredentialError) {
        setError(`Invalid credential: ${err.message}`);
      } else if (err instanceof SyntaxError) {
        setError('Invalid JSON format');
      } else {
        setError('Failed to process credential');
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Add Credential
        </h2>
        <button
          onClick={() => setShowJsonInput(!showJsonInput)}
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {showJsonInput ? 'Upload File' : 'Paste JSON'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md flex items-center space-x-2">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
          <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
        </div>
      )}

      {showJsonInput ? (
        <div className="space-y-4">
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder="Paste your W3C JSON-LD verifiable credential here..."
            className="w-full h-48 p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="flex space-x-2">
            <button
              onClick={handleJsonSubmit}
              disabled={!jsonInput.trim() || isUploading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>{isUploading ? 'Adding...' : 'Add Credential'}</span>
            </button>
            <button
              onClick={() => {
                setJsonInput('');
                setShowJsonInput(false);
                setError(null);
              }}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragOver
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
          >
            <Upload className={`mx-auto h-12 w-12 mb-4 ${
              isDragOver ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'
            }`} />
            <div className="space-y-2">
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                {isDragOver ? 'Drop your credential file here' : 'Upload credential file'}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Drag and drop a JSON file or click to browse
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Supports W3C JSON-LD Verifiable Credentials
              </p>
            </div>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileSelect}
            multiple
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}
