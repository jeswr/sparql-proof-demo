'use client';

import { useState, useEffect } from 'react';
import { Eye, Code, Download, Copy, Check, Shield, Calendar, User, Hash, Database } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { VerifiableCredential } from '@/types/credential';
import { formatCredentialForDisplay, downloadCredential, convertToTurtle } from '@/utils/credentialUtils';

interface CredentialViewerProps {
  credential: VerifiableCredential | null;
}

export function CredentialViewer({ credential }: CredentialViewerProps) {
  const [viewMode, setViewMode] = useState<'formatted' | 'raw' | 'turtle'>('formatted');
  const [copied, setCopied] = useState(false);
  const [turtleData, setTurtleData] = useState<string>('');
  const [turtleLoading, setTurtleLoading] = useState(false);
  const [turtleError, setTurtleError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

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

  // Generate Turtle data when credential changes or turtle mode is selected
  useEffect(() => {
    if (credential && viewMode === 'turtle' && !turtleData) {
      setTurtleLoading(true);
      setTurtleError(null);
      
      convertToTurtle(credential)
        .then(setTurtleData)
        .catch((error) => {
          console.error('Failed to convert to Turtle:', error);
          setTurtleError('Failed to convert credential to Turtle format');
        })
        .finally(() => setTurtleLoading(false));
    }
  }, [credential, viewMode, turtleData]);

  // Reset turtle data when credential changes
  useEffect(() => {
    setTurtleData('');
    setTurtleError(null);
  }, [credential]);

  const handleCopy = async () => {
    if (!credential) return;
    
    try {
      let contentToCopy = '';
      if (viewMode === 'turtle') {
        contentToCopy = turtleData;
      } else if (viewMode === 'raw') {
        contentToCopy = JSON.stringify(credential, null, 2);
      } else {
        contentToCopy = JSON.stringify(credential, null, 2);
      }
      
      await navigator.clipboard.writeText(contentToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  if (!credential) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8">
        <div className="text-center">
          <Eye className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Select a credential
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Choose a credential from the list to view its details.
          </p>
        </div>
      </div>
    );
  }

  const display = formatCredentialForDisplay(credential);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Credential Details
          </h2>
          <div className="flex items-center space-x-2">
            <div className="flex rounded-md shadow-sm">
              <button
                onClick={() => setViewMode('formatted')}
                className={`px-3 py-1 text-sm font-medium border rounded-l-md ${
                  viewMode === 'formatted'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                <Eye className="h-3 w-3 inline mr-1" />
                Formatted
              </button>
              <button
                onClick={() => setViewMode('raw')}
                className={`px-3 py-1 text-sm font-medium border-t border-b ${
                  viewMode === 'raw'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                <Code className="h-3 w-3 inline mr-1" />
                Raw JSON
              </button>
              <button
                onClick={() => setViewMode('turtle')}
                className={`px-3 py-1 text-sm font-medium border rounded-r-md ${
                  viewMode === 'turtle'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                <Database className="h-3 w-3 inline mr-1" />
                Turtle RDF
              </button>
            </div>
            
            <button
              onClick={handleCopy}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="Copy to clipboard"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
            
            <button
              onClick={() => downloadCredential(credential)}
              className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              title="Download credential"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {viewMode === 'formatted' ? (
          <div className="space-y-6">
            {/* Basic Information */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                <Shield className="h-4 w-4 mr-2" />
                Basic Information
              </h3>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Title
                  </label>
                  <p className="text-sm text-gray-900 dark:text-white mt-1">{display.title}</p>
                </div>
                
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    ID
                  </label>
                  <p className="text-sm text-gray-900 dark:text-white mt-1 font-mono break-all">
                    {credential.id}
                  </p>
                </div>
                
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Types
                  </label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {credential.type.map((type) => (
                      <span
                        key={type}
                        className="inline-block px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded"
                      >
                        {type}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Issuer Information */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                <User className="h-4 w-4 mr-2" />
                Issuer Information
              </h3>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Issuer
                  </label>
                  <p className="text-sm text-gray-900 dark:text-white mt-1 font-mono break-all">
                    {typeof credential.issuer === 'string' ? credential.issuer : credential.issuer.id}
                  </p>
                </div>
              </div>
            </div>

            {/* Dates */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                <Calendar className="h-4 w-4 mr-2" />
                Validity Period
              </h3>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Issued
                  </label>
                  <p className="text-sm text-gray-900 dark:text-white mt-1">{display.issuanceDate}</p>
                </div>
                
                {display.expirationDate && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Expires
                    </label>
                    <p className={`text-sm mt-1 ${
                      display.isExpired 
                        ? 'text-red-600 dark:text-red-400' 
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {display.expirationDate}
                      {display.isExpired && ' (Expired)'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Credential Subject */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                <Hash className="h-4 w-4 mr-2" />
                Subject
              </h3>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-md overflow-hidden">
                <SyntaxHighlighter
                  language="json"
                  style={isDarkMode ? vscDarkPlus : vs}
                  customStyle={{
                    margin: 0,
                    padding: '1rem',
                    background: 'transparent',
                    fontSize: '0.75rem'
                  }}
                  wrapLongLines={true}
                >
                  {JSON.stringify(credential.credentialSubject, null, 2)}
                </SyntaxHighlighter>
              </div>
            </div>

            {/* Proof */}
            {credential.proof && (
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                  <Shield className="h-4 w-4 mr-2" />
                  Cryptographic Proof
                </h3>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-md overflow-hidden">
                  <SyntaxHighlighter
                    language="json"
                    style={isDarkMode ? vscDarkPlus : vs}
                    customStyle={{
                      margin: 0,
                      padding: '1rem',
                      background: 'transparent',
                      fontSize: '0.75rem'
                    }}
                    wrapLongLines={true}
                  >
                    {JSON.stringify(credential.proof, null, 2)}
                  </SyntaxHighlighter>
                </div>
              </div>
            )}
          </div>
        ) : viewMode === 'turtle' ? (
          <div className="space-y-4">
            {turtleLoading && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-sm text-blue-700 dark:text-blue-300">
                    Converting to RDF/Turtle format...
                  </span>
                </div>
              </div>
            )}
            
            {turtleError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
                <p className="text-sm text-red-700 dark:text-red-300">{turtleError}</p>
              </div>
            )}
            
            {turtleData && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white flex items-center">
                    <Database className="h-4 w-4 mr-2" />
                    RDF/Turtle Serialization
                  </h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    W3C compliant RDF representation
                  </span>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-md overflow-hidden">
                  <SyntaxHighlighter
                    language="turtle"
                    style={isDarkMode ? vscDarkPlus : vs}
                    customStyle={{
                      margin: 0,
                      padding: '1rem',
                      background: 'transparent',
                      fontSize: '0.75rem',
                      maxHeight: '24rem',
                      overflow: 'auto'
                    }}
                    wrapLongLines={true}
                  >
                    {turtleData}
                  </SyntaxHighlighter>
                </div>
              </div>
            )}
            
            {!turtleLoading && !turtleError && !turtleData && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-8 text-center">
                <Database className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  RDF/Turtle conversion not available
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-700 rounded-md overflow-hidden">
            <SyntaxHighlighter
              language="json"
              style={isDarkMode ? vscDarkPlus : vs}
              customStyle={{
                margin: 0,
                padding: '1rem',
                background: 'transparent',
                fontSize: '0.75rem',
                maxHeight: '24rem',
                overflow: 'auto'
              }}
              wrapLongLines={true}
            >
              {JSON.stringify(credential, null, 2)}
            </SyntaxHighlighter>
          </div>
        )}
      </div>
    </div>
  );
}
