import { Wallet, Shield, Key } from 'lucide-react';

export function WalletHeader() {
  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Wallet className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Verifiable Credentials Wallet
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Secure storage for your W3C JSON-LD credentials
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center space-x-1">
              <Shield className="h-4 w-4" />
              <span>Encrypted</span>
            </div>
            <div className="flex items-center space-x-1">
              <Key className="h-4 w-4" />
              <span>Local Storage</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
