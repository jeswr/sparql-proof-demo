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
