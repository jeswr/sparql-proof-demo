'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, Plus, AlertCircle, Link, Globe } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
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
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      const isDark = document.documentElement.classList.contains('dark') ||
                    window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(isDark);
    };

    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  // Live test endpoints for demonstration
  const testEndpoints = [
    {
      name: 'Local Vaccination Credential',
      url: '/sample-vaccination.json',
      description: 'COVID-19 vaccination certificate example'
    },
    {
      name: 'Local Degree Credential', 
      url: '/sample-credential.json',
      description: 'University degree credential example'
    },
    {
      name: 'Local Resident Card',
      url: '/sample-permanent-resident.jsonld',
      description: 'Permanent resident card credential'
    }
  ];

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
    const credentialFiles = files.filter(file => 
      file.type === 'application/json' || 
      file.type === 'application/ld+json' ||
      file.name.endsWith('.json') || 
      file.name.endsWith('.jsonld')
    );
    
    if (credentialFiles.length === 0) {
      setError('Please drop a valid JSON or JSON-LD file');
      return;
    }
    
    for (const file of credentialFiles) {
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

  const fetchCredentialFromUrl = async (url: string) => {
    setIsUploading(true);
    setError(null);

    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json, application/ld+json, */*'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const { validateCredential } = await import('@/utils/credentialUtils');
      const credential = await validateCredential(data);
      onCredentialAdded(credential);
      setUrlInput('');
      setShowUrlInput(false);
    } catch (err) {
      if (err instanceof CredentialError) {
        setError(`Invalid credential: ${err.message}`);
      } else if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Network error: Unable to fetch from URL. Check CORS settings.');
      } else {
        setError(`Failed to fetch credential: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return;
    await fetchCredentialFromUrl(urlInput.trim());
  };

  const handleTestEndpoint = async (url: string) => {
    await fetchCredentialFromUrl(url);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Add Credential
        </h2>
        <div className="flex space-x-2 text-sm">
          <button
            onClick={() => {
              setShowJsonInput(false);
              setShowUrlInput(!showUrlInput);
              setError(null);
            }}
            className={`px-3 py-1 rounded ${
              showUrlInput 
                ? 'bg-blue-600 text-white' 
                : 'text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300'
            }`}
          >
            <Link className="h-3 w-3 inline mr-1" />
            From URL
          </button>
          <button
            onClick={() => {
              setShowUrlInput(false);
              setShowJsonInput(!showJsonInput);
              setError(null);
            }}
            className={`px-3 py-1 rounded ${
              showJsonInput 
                ? 'bg-blue-600 text-white' 
                : 'text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300'
            }`}
          >
            Paste JSON
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md flex items-center space-x-2">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
          <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
        </div>
      )}

      {showUrlInput ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Credential URL
            </label>
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/credential.json"
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={handleUrlSubmit}
              disabled={!urlInput.trim() || isUploading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>{isUploading ? 'Fetching...' : 'Fetch Credential'}</span>
            </button>
            <button
              onClick={() => {
                setUrlInput('');
                setShowUrlInput(false);
                setError(null);
              }}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>

          {/* Test Endpoints */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
              <Globe className="h-4 w-4 mr-1" />
              Quick Test Endpoints
            </h4>
            <div className="space-y-2">
              {testEndpoints.map((endpoint, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded border"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {endpoint.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {endpoint.description}
                    </p>
                  </div>
                  <button
                    onClick={() => handleTestEndpoint(endpoint.url)}
                    disabled={isUploading}
                    className="ml-2 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploading ? 'Loading...' : 'Load'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : showJsonInput ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Input Area */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                JSON Input
              </label>
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder="Paste your W3C JSON-LD verifiable credential here..."
                className="w-full h-48 p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              />
            </div>
            
            {/* Preview Area */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Preview (with syntax highlighting)
              </label>
              <div className="h-48 border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden bg-gray-50 dark:bg-gray-700">
                {jsonInput.trim() ? (
                  <SyntaxHighlighter
                    language="json"
                    style={isDarkMode ? vscDarkPlus : vs}
                    customStyle={{
                      margin: 0,
                      padding: '0.75rem',
                      background: 'transparent',
                      fontSize: '0.875rem',
                      height: '100%',
                      overflow: 'auto'
                    }}
                    wrapLongLines={true}
                  >
                    {jsonInput}
                  </SyntaxHighlighter>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400 text-sm">
                    JSON preview will appear here as you type
                  </div>
                )}
              </div>
            </div>
          </div>
          
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
                setShowUrlInput(false);
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
                Drag and drop a JSON or JSON-LD file or click to browse
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Supports .json and .jsonld files with W3C Verifiable Credentials
              </p>
            </div>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.jsonld,application/json,application/ld+json"
            onChange={handleFileSelect}
            multiple
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}
