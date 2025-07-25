'use client';

import { FileText, Trash2, Download, Calendar, User, AlertTriangle } from 'lucide-react';
import { VerifiableCredential } from '@/types/credential';
import { formatCredentialForDisplay, downloadCredential } from '@/utils/credentialUtils';

interface CredentialListProps {
  credentials: VerifiableCredential[];
  selectedCredential: VerifiableCredential | null;
  onSelectCredential: (credential: VerifiableCredential) => void;
  onDeleteCredential: (id: string) => void;
}

export function CredentialList({ 
  credentials, 
  selectedCredential, 
  onSelectCredential, 
  onDeleteCredential 
}: CredentialListProps) {

  const handleDelete = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    onDeleteCredential(id);
  };

  const handleDownload = (credential: VerifiableCredential, event: React.MouseEvent) => {
    event.stopPropagation();
    downloadCredential(credential);
  };

  if (credentials.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8">
        <div className="text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No credentials yet
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Upload your first W3C JSON-LD verifiable credential to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Credentials ({credentials.length})
        </h2>
      </div>
      
      <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
        {credentials.map((credential) => {
          const display = formatCredentialForDisplay(credential);
          const isSelected = selectedCredential?.id === credential.id;
          
          return (
            <div
              key={credential.id}
              onClick={() => onSelectCredential(credential)}
              className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${
                isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-2">
                    <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {display.title}
                    </h3>
                    {display.isExpired && (
                      <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center space-x-1 text-xs text-gray-600 dark:text-gray-400">
                      <User className="h-3 w-3" />
                      <span>Issuer: {display.issuer}</span>
                    </div>
                    
                    <div className="flex items-center space-x-1 text-xs text-gray-600 dark:text-gray-400">
                      <Calendar className="h-3 w-3" />
                      <span>Issued: {display.issuanceDate}</span>
                      {display.expirationDate && (
                        <span className={display.isExpired ? 'text-red-600 dark:text-red-400' : ''}>
                          • Expires: {display.expirationDate}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-1 mt-2">
                      {display.types.filter(type => type !== 'VerifiableCredential').map((type) => (
                        <span
                          key={type}
                          className="inline-block px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-1 ml-2">
                  <button
                    onClick={(e) => handleDownload(credential, e)}
                    className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    title="Download credential"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  
                  <button
                    onClick={(e) => handleDelete(credential.id, e)}
                    className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    title="Delete credential"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
