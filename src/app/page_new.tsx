'use client';

import { useState, useEffect } from 'react';
import { WalletHeader } from '@/components/WalletHeader';
import { CredentialList } from '@/components/CredentialList';
import { CredentialUpload } from '@/components/CredentialUpload';
import { CredentialViewer } from '@/components/CredentialViewer';
import { VerifiableCredential } from '@/types/credential';

export default function Home() {
  const [credentials, setCredentials] = useState<VerifiableCredential[]>([]);
  const [selectedCredential, setSelectedCredential] = useState<VerifiableCredential | null>(null);

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
      </main>
    </div>
  );
}
