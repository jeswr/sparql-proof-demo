'use client';

import { useState } from 'react';
import { Eye, Code, Download, Copy, Check, Shield, Calendar, User, Hash } from 'lucide-react';
import { VerifiableCredential } from '@/types/credential';
import { formatCredentialForDisplay, downloadCredential } from '@/utils/credentialUtils';

interface CredentialViewerProps {
  credential: VerifiableCredential | null;
}

export function CredentialViewer({ credential }: CredentialViewerProps) {
  const [viewMode, setViewMode] = useState<'formatted' | 'raw'>('formatted');
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!credential) return;
    
    try {
      await navigator.clipboard.writeText(JSON.stringify(credential, null, 2));
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
                className={`px-3 py-1 text-sm font-medium border-t border-r border-b rounded-r-md ${
                  viewMode === 'raw'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                <Code className="h-3 w-3 inline mr-1" />
                Raw JSON
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
              <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-4">
                <pre className="text-xs text-gray-900 dark:text-white font-mono whitespace-pre-wrap break-all">
                  {JSON.stringify(credential.credentialSubject, null, 2)}
                </pre>
              </div>
            </div>

            {/* Proof */}
            {credential.proof && (
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                  <Shield className="h-4 w-4 mr-2" />
                  Cryptographic Proof
                </h3>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-4">
                  <pre className="text-xs text-gray-900 dark:text-white font-mono whitespace-pre-wrap break-all">
                    {JSON.stringify(credential.proof, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-4">
            <pre className="text-xs text-gray-900 dark:text-white font-mono whitespace-pre-wrap break-all max-h-96 overflow-y-auto">
              {JSON.stringify(credential, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
