'use client';

import { useState, useEffect } from 'react';
import { Database, Play, Plus, Code, AlertCircle, CheckCircle, Copy, Hash } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { VerifiableCredential } from '@/types/credential';
import { 
  executeSPARQLQuery, 
  createDerivedCredential, 
  getSampleSPARQLQueries,
  combinedRDFFromCredentials 
} from '@/utils/credentialUtils';

interface SPARQLQueryInterfaceProps {
  credentials: VerifiableCredential[];
  onDerivedCredentialCreated: (credential: VerifiableCredential) => void;
}

export function SPARQLQueryInterface({ credentials, onDerivedCredentialCreated }: SPARQLQueryInterfaceProps) {
  const [query, setQuery] = useState('');
  const [queryResults, setQueryResults] = useState<Record<string, { type: string; value: string }>[]>([]);
  const [rdfData, setRdfData] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRDF, setShowRDF] = useState(false);
  const [showCreateDerived, setShowCreateDerived] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [derivedCredentialForm, setDerivedCredentialForm] = useState({
    id: '',
    type: 'DerivedCredential',
    issuer: 'did:example:derived-issuer',
    name: '',
    description: ''
  });

  const sampleQueries = getSampleSPARQLQueries();

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

  // Load combined RDF data when credentials change
  useEffect(() => {
    if (credentials.length > 0) {
      const loadRDF = async () => {
        try {
          const combined = await combinedRDFFromCredentials(credentials);
          setRdfData(combined);
        } catch (error) {
          console.error('Failed to load RDF data:', error);
        }
      };
      loadRDF();
    }
  }, [credentials]);

  const executeQuery = async () => {
    if (!query.trim()) {
      setError('Please enter a SPARQL query');
      return;
    }

    if (credentials.length === 0) {
      setError('No credentials available to query');
      return;
    }

    setIsExecuting(true);
    setError(null);

    try {
      const results = await executeSPARQLQuery(query, credentials);
      setQueryResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query execution failed');
    } finally {
      setIsExecuting(false);
    }
  };

  const loadSampleQuery = (sampleQuery: string) => {
    setQuery(sampleQuery);
    setQueryResults([]);
    setError(null);
  };

  const createDerived = async () => {
    if (!derivedCredentialForm.id || !derivedCredentialForm.name) {
      setError('Please fill in required fields for derived credential');
      return;
    }

    if (queryResults.length === 0) {
      setError('Please execute a query first to create a derived credential');
      return;
    }

    setIsExecuting(true);
    setError(null);

    try {
      const derivedCredential = await createDerivedCredential(
        query,
        credentials,
        {
          ...derivedCredentialForm,
          id: derivedCredentialForm.id || `https://example.com/derived/${Date.now()}`,
          type: [derivedCredentialForm.type]
        }
      );

      onDerivedCredentialCreated(derivedCredential);
      setShowCreateDerived(false);
      setDerivedCredentialForm({
        id: '',
        type: 'DerivedCredential',
        issuer: 'did:example:derived-issuer',
        name: '',
        description: ''
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create derived credential');
    } finally {
      setIsExecuting(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (credentials.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8">
        <div className="text-center">
          <Database className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No credentials to query
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Add some credentials first to start creating SPARQL queries and derived credentials.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Database className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              SPARQL Query Interface
            </h2>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowRDF(!showRDF)}
              className={`px-3 py-1 text-sm rounded ${
                showRDF 
                  ? 'bg-blue-600 text-white' 
                  : 'text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300'
              }`}
            >
              <Code className="h-3 w-3 inline mr-1" />
              View RDF
            </button>
          </div>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Query {credentials.length} credential{credentials.length !== 1 ? 's' : ''} using SPARQL to create derived credentials with ZKP-ready proofs.
        </p>

        {/* Sample Queries */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Sample Queries
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {sampleQueries.map((sample, index) => (
              <button
                key={index}
                onClick={() => loadSampleQuery(sample.query)}
                className="text-left p-3 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="font-medium text-sm text-gray-900 dark:text-white">
                  {sample.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {sample.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Query Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            SPARQL Query
          </label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter your SPARQL query here..."
            className="w-full h-32 p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
          />
        </div>

        {/* Execute Button */}
        <button
          onClick={executeQuery}
          disabled={isExecuting || !query.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          <Play className="h-4 w-4" />
          <span>{isExecuting ? 'Executing...' : 'Execute Query'}</span>
        </button>

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
            <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
          </div>
        )}
      </div>

      {/* RDF Data Display */}
      {showRDF && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Combined RDF Data
            </h3>
            <button
              onClick={() => copyToClipboard(rdfData)}
              className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 flex items-center space-x-1"
            >
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </button>
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
                maxHeight: '20rem',
                overflow: 'auto'
              }}
              wrapLongLines={true}
            >
              {rdfData || 'Loading RDF data...'}
            </SyntaxHighlighter>
          </div>
        </div>
      )}

      {/* Query Results */}
      {queryResults.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Query Results ({queryResults.length} results)
              </h3>
            </div>
            <button
              onClick={() => setShowCreateDerived(!showCreateDerived)}
              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 flex items-center space-x-1"
            >
              <Plus className="h-3 w-3" />
              <span>Create Derived Credential</span>
            </button>
          </div>

          {/* Results Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {queryResults.length > 0 && Object.keys(queryResults[0]).map(key => (
                    <th
                      key={key}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                    >
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {queryResults.map((result, index) => (
                  <tr key={index}>
                    {Object.values(result).map((value: { type: string; value: string }, cellIndex) => (
                      <td
                        key={cellIndex}
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white"
                      >
                        {typeof value === 'object' && value !== null ? (
                          <span className="font-mono text-xs">
                            {value.value || JSON.stringify(value)}
                          </span>
                        ) : (
                          String(value)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Derived Credential Form */}
      {showCreateDerived && queryResults.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Hash className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Create Derived Credential
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Credential ID *
              </label>
              <input
                type="text"
                value={derivedCredentialForm.id}
                onChange={(e) => setDerivedCredentialForm(prev => ({ ...prev, id: e.target.value }))}
                placeholder="https://example.com/derived/credential/1"
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Credential Type
              </label>
              <input
                type="text"
                value={derivedCredentialForm.type}
                onChange={(e) => setDerivedCredentialForm(prev => ({ ...prev, type: e.target.value }))}
                placeholder="DerivedCredential"
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Name *
              </label>
              <input
                type="text"
                value={derivedCredentialForm.name}
                onChange={(e) => setDerivedCredentialForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Age Verification Credential"
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Issuer
              </label>
              <input
                type="text"
                value={derivedCredentialForm.issuer}
                onChange={(e) => setDerivedCredentialForm(prev => ({ ...prev, issuer: e.target.value }))}
                placeholder="did:example:derived-issuer"
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={derivedCredentialForm.description}
              onChange={(e) => setDerivedCredentialForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="A derived credential proving age verification without revealing exact birth date"
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              rows={3}
            />
          </div>

          <div className="flex space-x-2">
            <button
              onClick={createDerived}
              disabled={isExecuting}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>{isExecuting ? 'Creating...' : 'Create Derived Credential'}</span>
            </button>
            <button
              onClick={() => setShowCreateDerived(false)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>

          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Note:</strong> This credential will include a mock signature. Once your ZKP proof engine is ready, 
              replace the mock proof with a real zero-knowledge proof that validates the SPARQL query results 
              without revealing the underlying credential data.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
