'use client';

import { useState, useEffect } from 'react';
import { Database, Play, Plus, Code, AlertCircle, CheckCircle, Copy, Hash, MessageCircle, Send, Bot, User, Minimize2, Maximize2, Trash2 } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { VerifiableCredential } from '@/types/credential';
import { 
  executeSPARQLQuery, 
  createDerivedCredential, 
  getSampleSPARQLQueries
} from '@/utils/credentialUtils';
import { translate } from 'sparqlalgebrajs';
import * as jsonld from 'jsonld';
import { Parser, Store } from 'n3';
import { write as prettyTurtle } from '@jeswr/pretty-turtle';

interface SPARQLQueryInterfaceProps {
  credentials: VerifiableCredential[];
  onDerivedCredentialCreated: (credential: VerifiableCredential) => void;
}

export function SPARQLQueryInterface({ credentials, onDerivedCredentialCreated }: SPARQLQueryInterfaceProps) {
  const [query, setQuery] = useState('');
  const [queryResults, setQueryResults] = useState<Record<string, { type: string; value: string }>[]>([]);
  const [queryVariables, setQueryVariables] = useState<string[]>([]);
  const [rdfData, setRdfData] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRDF, setShowRDF] = useState(false);
  const [showCreateDerived, setShowCreateDerived] = useState(false);
  const [showCopilotChat, setShowCopilotChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'assistant'; content: string; timestamp: Date}>>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [availableSampleQueries, setAvailableSampleQueries] = useState<Array<{name: string; description: string; query: string}>>([]);
  const [derivedCredentialForm, setDerivedCredentialForm] = useState({
    id: '',
    type: 'DerivedCredential',
    issuer: 'did:example:derived-issuer',
    name: '',
    description: ''
  });

  // Filter sample queries to only show those that are valid SELECT queries and return results
  useEffect(() => {
    const filterSampleQueries = async () => {
      if (credentials.length === 0) {
        setAvailableSampleQueries([]);
        return;
      }

      const allSampleQueries = getSampleSPARQLQueries();
      const validQueries = [];
      
      for (const sampleQuery of allSampleQueries) {
        try {
          // Test that the query can be parsed and returns results
          const results = await executeSPARQLQuery(sampleQuery.query, credentials);
          // If it doesn't throw an error and returns results, it's valid
          if (results.length > 0) {
            validQueries.push(sampleQuery);
          }
        } catch (error) {
          // Skip queries that fail to parse or execute
          console.warn(`Sample query "${sampleQuery.name}" failed:`, error);
        }
      }
      
      setAvailableSampleQueries(validQueries);
    };

    filterSampleQueries();
  }, [credentials]);

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
          // Create a combined RDF store from all credentials using JSON-LD and pretty-turtle
          const store = new Store();
          
          // Convert each credential to RDF and add to the store
          for (const credential of credentials) {
            try {
              // Convert credential to N-Quads using jsonld
              const nquads = await jsonld.toRDF(credential, { format: 'application/n-quads' });
              
              // Parse N-Quads and add to store
              const parser = new Parser({ format: 'N-Quads' });
              
              await new Promise<void>((resolve, reject) => {
                parser.parse(nquads as string, (error, quad) => {
                  if (error) {
                    reject(new Error(`Failed to parse RDF for credential ${credential.id}: ${error.message}`));
                    return;
                  }
                  
                  if (quad) {
                    store.addQuad(quad);
                  } else {
                    // Parsing complete
                    resolve();
                  }
                });
              });
            } catch (error) {
              console.warn(`Failed to convert credential ${credential.id} to RDF:`, error);
              // Continue with other credentials even if one fails
            }
          }
          
          // Get all quads from the store, but filter to only include default graph quads
          const allQuads = store.getQuads(null, null, null, null);
          // Filter to only include quads in the default graph (where graph is undefined/null)
          const defaultGraphQuads = allQuads.filter(quad => !quad.graph || quad.graph.value === '');
          
          console.log(`Total quads: ${allQuads.length}, Default graph quads: ${defaultGraphQuads.length}`);
          
          // Define comprehensive prefix map
          const prefixMap = {
            'cred': 'https://www.w3.org/2018/credentials#',
            'credex': 'https://www.w3.org/2018/credentials/examples#',
            'sec': 'https://w3id.org/security#',
            'citizenship': 'https://w3id.org/citizenship#',
            'vaccination': 'https://w3id.org/vaccination#',
            'xsd': 'http://www.w3.org/2001/XMLSchema#',
            'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
            'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
            'schema': 'http://schema.org/',
            'foaf': 'http://xmlns.com/foaf/0.1/',
            'dc': 'http://purl.org/dc/terms/',
            'example': 'https://example.org/',
            'exampleEdu': 'http://example.edu/',
            'exampleCred': 'https://example.org/credentials/',
            'exampleEx': 'https://example.org/examples#',
            'health': 'https://healthauthority.example.org',
            'did': 'did:example:',
            'hl7': 'http://hl7.org/fhir/sid/',
            'cvx': 'http://hl7.org/fhir/sid/cvx'
          };
          
          // Use pretty-turtle to format the output with only default graph quads
          const prettyTurtleOutput = await prettyTurtle(defaultGraphQuads, { 
            prefixes: prefixMap
          });
          
          setRdfData(prettyTurtleOutput);
        } catch (error) {
          console.error('Failed to load RDF data:', error);
          setRdfData('# Error loading RDF data\n# Please check the console for details');
        }
      };
      loadRDF();
    } else {
      setRdfData('# No credentials available\n# Please add some credentials to see RDF data');
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
      // Extract variables from the query for consistent table headers
      const algebra = translate(query);
      if (algebra.type === 'project') {
        const selectVariables = (algebra as { variables: Array<{ value: string }> }).variables.map((variable) => variable.value);
        setQueryVariables(selectVariables);
      }
      
      const results = await executeSPARQLQuery(query, credentials);
      setQueryResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query execution failed');
      setQueryVariables([]);
    } finally {
      setIsExecuting(false);
    }
  };

  const loadSampleQuery = (sampleQuery: string) => {
    setQuery(sampleQuery);
    setQueryResults([]);
    setQueryVariables([]);
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

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage = {
      role: 'user' as const,
      content: chatInput.trim(),
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      // Simulate AI response - in a real implementation, this would call an AI service
      const response = await generateSPARQLAssistance(userMessage.content, credentials);
      
      const assistantMessage = {
        role: 'assistant' as const,
        content: response,
        timestamp: new Date()
      };

      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage = {
        role: 'assistant' as const,
        content: "I'm sorry, I encountered an error while processing your request. Please try again or refer to the sample queries for guidance.",
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const generateSPARQLAssistance = async (userInput: string, credentials: VerifiableCredential[]): Promise<string> => {
    // Mock AI assistant responses based on user input patterns
    const input = userInput.toLowerCase();
    
    // Define common prefixes that should be included in all queries
    const commonPrefixes = `PREFIX cred: <https://www.w3.org/2018/credentials#>
PREFIX schema: <http://schema.org/>
PREFIX vaccination: <https://w3id.org/vaccination#>
PREFIX exampleEx: <https://example.org/examples#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX sec: <https://w3id.org/security#>

`;

    // Include current RDF data context for better suggestions
    const rdfContext = rdfData ? `\n\n**Current RDF Data Context:**
Based on your current credentials, I can see the following data structure:
\`\`\`turtle
${rdfData.slice(0, 800)}${rdfData.length > 800 ? '...' : ''}
\`\`\`

This helps me provide more relevant query suggestions based on your actual data.` : '';
    
    if (input.includes('help') || input.includes('how') || input.includes('what')) {
      return `I can help you write SPARQL queries for your ${credentials.length} credential${credentials.length !== 1 ? 's' : ''}! Here are some tips:

**Basic Query Structure with Prefixes:**
\`\`\`sparql
${commonPrefixes}SELECT ?variable1 ?variable2
WHERE {
  ?subject ?predicate ?object .
}
\`\`\`

**Common Prefixes in your data:**
- \`cred:\` for credential properties (https://www.w3.org/2018/credentials#)
- \`schema:\` for schema.org properties (http://schema.org/)
- \`vaccination:\` for vaccination data (https://w3id.org/vaccination#)
- \`exampleEx:\` for degree/education data (https://example.org/examples#)

**What would you like to query? For example:**
- "Show me all names"
- "Find vaccination records" 
- "Get degree information"
- "Age verification queries"${rdfContext}`;
    }

    if (input.includes('name') || input.includes('person')) {
      return `To query names from your credentials, try:

\`\`\`sparql
${commonPrefixes}SELECT ?name ?person
WHERE {
  ?person schema:name ?name .
}
\`\`\`

Or for more specific queries:
\`\`\`sparql
${commonPrefixes}SELECT ?givenName ?familyName
WHERE {
  ?person schema:givenName ?givenName ;
          schema:familyName ?familyName .
}
\`\`\`${rdfContext}`;
    }

    if (input.includes('vaccination') || input.includes('vaccine') || input.includes('covid')) {
      return `For vaccination data, try these queries:

**Basic vaccination info:**
\`\`\`sparql
${commonPrefixes}SELECT ?person ?vaccine
WHERE {
  ?person a vaccination:VaccinationEvent ;
          vaccination:VaccineEventVaccine ?vaccineInfo .
  ?vaccineInfo schema:displayName ?vaccine .
}
\`\`\`

**Patient details:**
\`\`\`sparql
${commonPrefixes}SELECT ?givenName ?familyName ?birthDate
WHERE {
  ?event vaccination:recipient ?recipient .
  ?recipient schema:givenName ?givenName ;
            schema:familyName ?familyName ;
            schema:birthDate ?birthDate .
}
\`\`\`${rdfContext}`;
    }

    if (input.includes('degree') || input.includes('education') || input.includes('university')) {
      return `For educational credentials, try:

**Degree information:**
\`\`\`sparql
${commonPrefixes}SELECT ?name ?degreeName ?school
WHERE {
  ?person schema:name ?name ;
          exampleEx:degree ?degree .
  ?degree schema:name ?degreeName ;
          exampleEx:degreeSchool ?school .
}
\`\`\`

**University credentials:**
\`\`\`sparql
${commonPrefixes}SELECT ?credential ?issuer ?subject
WHERE {
  ?credential a exampleEx:UniversityDegreeCredential ;
             cred:issuer ?issuer ;
             cred:credentialSubject ?subject .
}
\`\`\`${rdfContext}`;
    }

    if (input.includes('age') || input.includes('birth') || input.includes('over') || input.includes('under')) {
      return `For age-related queries:

**Birth dates:**
\`\`\`sparql
${commonPrefixes}SELECT ?name ?birthDate
WHERE {
  ?person schema:name ?name ;
          schema:birthDate ?birthDate .
}
\`\`\`

**Age verification (filtering for people born before 2000):**
\`\`\`sparql
${commonPrefixes}SELECT ?name ?birthDate
WHERE {
  ?person schema:name ?name ;
          schema:birthDate ?birthDate .
  FILTER(?birthDate < "2000-01-01"^^xsd:date)
}
\`\`\`${rdfContext}`;
    }

    // Default response
    return `I can help you write SPARQL queries! Try asking me about:

🔍 **Query examples:** "How do I query names?" or "Show vaccination data"
📋 **Specific data:** "Find degree information" or "Get birth dates"  
🎯 **Filtering:** "Age verification queries" or "Filter by date"

Your credentials contain:
${credentials.map(c => `- ${c.type ? (Array.isArray(c.type) ? c.type.join(', ') : c.type) : 'Unknown type'}`).join('\n')}

**Sample query with proper prefixes:**
\`\`\`sparql
${commonPrefixes}SELECT ?name ?type
WHERE {
  ?credential a ?type ;
             cred:credentialSubject ?subject .
  ?subject schema:name ?name .
}
\`\`\`

What would you like to query?${rdfContext}`;
  };

  const applySuggestedQuery = (content: string) => {
    // Extract SPARQL code blocks from the assistant's response
    const codeBlockRegex = /```sparql\n([\s\S]*?)\n```/g;
    const matches = [...content.matchAll(codeBlockRegex)];
    
    if (matches.length > 0) {
      // Use the first SPARQL query found
      const suggestedQuery = matches[0][1].trim();
      setQuery(suggestedQuery);
      setQueryResults([]);
      setQueryVariables([]);
      setError(null);
    }
  };

  const validateSPARQLQuery = (queryText: string): { isValid: boolean; error?: string } => {
    try {
      // Use sparqlalgebrajs to parse and validate the query
      const algebra = translate(queryText);
      
      // Check if it's a SELECT query (we only support SELECT for now)
      if (algebra.type !== 'project') {
        return {
          isValid: false,
          error: 'Only SELECT queries are currently supported'
        };
      }
      
      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Invalid SPARQL syntax'
      };
    }
  };

  const autoFixQuery = async (content: string, errorMessage: string) => {
    // Extract the query that failed
    const codeBlockRegex = /```sparql\n([\s\S]*?)\n```/g;
    const matches = [...content.matchAll(codeBlockRegex)];
    
    if (matches.length > 0) {
      const failedQuery = matches[0][1].trim();
      
      // Generate an autofix message
      const autofixMessage = {
        role: 'assistant' as const,
        content: `I detected an issue with that query: ${errorMessage}

Let me provide a corrected version with proper prefixes:

\`\`\`sparql
PREFIX cred: <https://www.w3.org/2018/credentials#>
PREFIX schema: <http://schema.org/>
PREFIX vaccination: <https://w3id.org/vaccination#>
PREFIX exampleEx: <https://example.org/examples#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX sec: <https://w3id.org/security#>

SELECT ?name
WHERE {
  ?subject schema:name ?name .
}
\`\`\`

**Common fixes:**
- Added missing PREFIX declarations
- Ensured proper SPARQL syntax
- Used only SELECT queries (supported format)

The corrected query should now work properly!`,
        timestamp: new Date()
      };

      setChatMessages(prev => [...prev, autofixMessage]);
    }
  };

  const generateSuggestedPrompts = (): string[] => {
    // Generate dynamic prompts based on available credential types
    const prompts = ['How do I write SPARQL queries?'];
    
    // Check for specific credential types and add relevant prompts
    const hasVaccination = credentials.some(c => {
      if (!c.type) return false;
      return c.type.some(t => t.toLowerCase().includes('vaccination'));
    });
    
    const hasDegree = credentials.some(c => {
      if (!c.type) return false;
      return c.type.some(t => t.toLowerCase().includes('degree'));
    });
    
    const hasNames = rdfData.includes('schema:name') || rdfData.includes('schema:givenName');
    const hasBirthDates = rdfData.includes('schema:birthDate');
    
    if (hasNames) {
      prompts.push('Show me all names in my credentials');
    }
    
    if (hasVaccination) {
      prompts.push('Find vaccination records');
      prompts.push('Show patient vaccination details');
    }
    
    if (hasDegree) {
      prompts.push('Get degree information');
      prompts.push('Find university credentials');
    }
    
    if (hasBirthDates) {
      prompts.push('Query birth dates for age verification');
    }
    
    // Add some general prompts
    prompts.push('Show all credential types');
    prompts.push('List all issuers');
    
    return prompts.slice(0, 6); // Limit to 6 prompts
  };

  const handleSuggestedPromptClick = async (prompt: string) => {
    setChatInput(prompt);
    // Simulate the message sending process
    const userMessage = {
      role: 'user' as const,
      content: prompt,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setIsChatLoading(true);

    try {
      const response = await generateSPARQLAssistance(prompt, credentials);
      
      const assistantMessage = {
        role: 'assistant' as const,
        content: response,
        timestamp: new Date()
      };

      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage = {
        role: 'assistant' as const,
        content: "I'm sorry, I encountered an error while processing your request. Please try again or refer to the sample queries for guidance.",
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const clearChatConversation = () => {
    setChatMessages([]);
    setChatInput('');
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
              onClick={() => setShowCopilotChat(!showCopilotChat)}
              className={`px-3 py-1 text-sm rounded ${
                showCopilotChat 
                  ? 'bg-purple-600 text-white' 
                  : 'text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300'
              }`}
            >
              <MessageCircle className="h-3 w-3 inline mr-1" />
              SPARQL Assistant
            </button>
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
          {availableSampleQueries.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {availableSampleQueries.map((sample: {name: string; description: string; query: string}, index: number) => (
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
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400 italic">
              {credentials.length === 0 
                ? 'Add some credentials to see sample queries'
                : 'No sample queries available for your current credentials. Try adding different types of credentials or write your own SPARQL query below.'
              }
            </div>
          )}
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

      {/* Copilot Chat Assistant */}
      {showCopilotChat && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Bot className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                SPARQL Query Assistant
              </h3>
            </div>
            <div className="flex items-center space-x-2">
              {chatMessages.length > 0 && (
                <button
                  onClick={clearChatConversation}
                  className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600"
                  title="Clear conversation"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setShowCopilotChat(false)}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600"
                title="Close assistant"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Ask me anything about writing SPARQL queries for your credentials! I can help with syntax, examples, and specific queries.
          </p>

          {/* Chat Messages */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 h-64 overflow-y-auto mb-4 space-y-3">
            {chatMessages.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 text-sm mt-4">
                <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Hi! I'm your SPARQL assistant. Ask me anything about querying your credentials!</p>
                
                {/* Suggested Prompts */}
                <div className="mt-4">
                  <p className="text-xs mb-3 font-medium">Try these suggestions:</p>
                  <div className="grid grid-cols-1 gap-2 max-w-md mx-auto">
                    {generateSuggestedPrompts().map((prompt, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestedPromptClick(prompt)}
                        className="text-xs px-3 py-2 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors text-left"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              chatMessages.map((message, index) => (
                <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex items-start space-x-2 max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                      message.role === 'user' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-purple-600 text-white'
                    }`}>
                      {message.role === 'user' ? (
                        <User className="h-3 w-3" />
                      ) : (
                        <Bot className="h-3 w-3" />
                      )}
                    </div>
                    <div className={`rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-500'
                    }`}>
                      <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                      {message.role === 'assistant' && message.content.includes('```sparql') && (() => {
                        // Extract and validate the query
                        const codeBlockRegex = /```sparql\n([\s\S]*?)\n```/g;
                        const matches = [...message.content.matchAll(codeBlockRegex)];
                        
                        if (matches.length > 0) {
                          const queryText = matches[0][1].trim();
                          const validation = validateSPARQLQuery(queryText);
                          
                          if (validation.isValid) {
                            return (
                              <button
                                onClick={() => applySuggestedQuery(message.content)}
                                className="mt-2 px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-800 flex items-center space-x-1"
                              >
                                <CheckCircle className="h-3 w-3" />
                                <span>Apply Query</span>
                              </button>
                            );
                          } else {
                            return (
                              <button
                                onClick={() => autoFixQuery(message.content, validation.error || 'Query validation failed')}
                                className="mt-2 px-2 py-1 text-xs bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded hover:bg-orange-200 dark:hover:bg-orange-800 flex items-center space-x-1"
                              >
                                <AlertCircle className="h-3 w-3" />
                                <span>Auto-fix Query</span>
                              </button>
                            );
                          }
                        }
                        return null;
                      })()}
                      <div className="text-xs opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
            {isChatLoading && (
              <div className="flex justify-start">
                <div className="flex items-start space-x-2">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center">
                    <Bot className="h-3 w-3" />
                  </div>
                  <div className="bg-white dark:bg-gray-600 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-500 rounded-lg p-3">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Chat Input */}
          <div className="flex space-x-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
              placeholder="Ask me about SPARQL queries..."
              className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
            />
            <button
              onClick={sendChatMessage}
              disabled={!chatInput.trim() || isChatLoading}
              className="px-4 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

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
      {(queryResults.length > 0 || queryVariables.length > 0) && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Query Results ({queryResults.length} results)
              </h3>
            </div>
            {queryResults.length > 0 && (
              <button
                onClick={() => setShowCreateDerived(!showCreateDerived)}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 flex items-center space-x-1"
              >
                <Plus className="h-3 w-3" />
                <span>Create Derived Credential</span>
              </button>
            )}
          </div>

          {/* Results Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {queryVariables.map(variable => (
                    <th
                      key={variable}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                    >
                      {variable}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {queryResults.length > 0 ? (
                  queryResults.map((result, index) => (
                    <tr key={index}>
                      {queryVariables.map((variable, cellIndex) => {
                        const value = result[variable];
                        return (
                          <td
                            key={cellIndex}
                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white"
                          >
                            {value && typeof value === 'object' && value !== null ? (
                              <span className="font-mono text-xs">
                                {value.value || JSON.stringify(value)}
                              </span>
                            ) : (
                              <span className="text-gray-400 italic">-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td 
                      colSpan={queryVariables.length} 
                      className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400 italic"
                    >
                      No results found
                    </td>
                  </tr>
                )}
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
