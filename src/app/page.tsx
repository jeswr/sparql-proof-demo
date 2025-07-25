'use client';

import { useState, useEffect } from 'react';
import { WalletHeader } from '@/components/WalletHeader';
import { CredentialList } from '@/components/CredentialList';
import { CredentialUpload } from '@/components/CredentialUpload';
import { CredentialViewer } from '@/components/CredentialViewer';
import { SPARQLQueryInterface } from '@/components/SPARQLQueryInterface';
import { VerifiableCredential } from '@/types/credential';

export default function Home() {
  const [credentials, setCredentials] = useState<VerifiableCredential[]>([]);
  const [selectedCredential, setSelectedCredential] = useState<VerifiableCredential | null>(null);
  const [activeTab, setActiveTab] = useState<'wallet' | 'sparql'>('wallet');
  const [showWarningBanner, setShowWarningBanner] = useState(true);

  useEffect(() => {
    // Load credentials from localStorage on component mount
    const savedCredentials = localStorage.getItem('wallet-credentials');
    if (savedCredentials) {
      try {
        setCredentials(JSON.parse(savedCredentials));
      } catch (error) {
        console.error('Error loading credentials:', error);
      }
    }
  }, []);

  const saveCredentials = (newCredentials: VerifiableCredential[]) => {
    setCredentials(newCredentials);
    localStorage.setItem('wallet-credentials', JSON.stringify(newCredentials));
  };

  const handleAddCredential = (credential: VerifiableCredential) => {
    const newCredentials = [...credentials, credential];
    saveCredentials(newCredentials);
  };

  const handleDeleteCredential = (id: string) => {
    const newCredentials = credentials.filter(cred => cred.id !== id);
    saveCredentials(newCredentials);
    if (selectedCredential?.id === id) {
      setSelectedCredential(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* GenAI Warning Banner */}
      {showWarningBanner && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-sm text-yellow-800 dark:text-yellow-200">
                <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">GenAI Generated Application</span>
                <span className="hidden sm:inline">•</span>
                <span className="hidden sm:inline">This is a proof of concept demonstration only - not for production use</span>
              </div>
              <button
                onClick={() => setShowWarningBanner(false)}
                className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200 p-1"
                aria-label="Close warning banner"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
      
      <WalletHeader />
      
      <main className="container mx-auto px-4 py-8">
        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="flex space-x-1 bg-white dark:bg-gray-800 p-1 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('wallet')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'wallet'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Wallet
            </button>
            <button
              onClick={() => setActiveTab('sparql')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'sparql'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              SPARQL Query & Derived Credentials
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'wallet' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Credential Management */}
            <div className="space-y-6">
              <CredentialUpload onCredentialAdded={handleAddCredential} />
              <CredentialList 
                credentials={credentials}
                selectedCredential={selectedCredential}
                onSelectCredential={setSelectedCredential}
                onDeleteCredential={handleDeleteCredential}
              />
            </div>

            {/* Right Column - Credential Viewer */}
            <div>
              <CredentialViewer credential={selectedCredential} />
            </div>
          </div>
        ) : (
          <SPARQLQueryInterface 
            credentials={credentials}
            onDerivedCredentialCreated={handleAddCredential}
          />
        )}
      </main>
    </div>
  );
}
