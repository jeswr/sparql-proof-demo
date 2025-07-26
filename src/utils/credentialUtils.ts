import { VerifiableCredential, CredentialDisplay } from '@/types/credential';
import * as jsonld from 'jsonld';
import { Parser, Writer, Store } from 'n3';
import { write as prettyTurtle } from '@jeswr/pretty-turtle';
import { translate } from 'sparqlalgebrajs';
import { QueryEngine } from '@comunica/query-sparql-rdfjs';
import * as RDF from '@rdfjs/types';
import { termToString } from 'rdf-string-ttl';
import { canonize } from 'rdf-canonize';

export class CredentialError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'CredentialError';
  }
}

export const validateCredential = async (credential: unknown): Promise<VerifiableCredential> => {
  // Basic structure validation
  if (!credential || typeof credential !== 'object') {
    throw new CredentialError('Invalid credential format', 'INVALID_FORMAT');
  }

  const credentialObj = credential as Record<string, unknown>;

  // Check required fields
  const requiredFields = ['@context', 'id', 'type', 'issuer', 'issuanceDate', 'credentialSubject'];
  for (const field of requiredFields) {
    if (!(field in credentialObj)) {
      throw new CredentialError(`Missing required field: ${field}`, 'MISSING_FIELD');
    }
  }

  // Validate @context
  const context = credentialObj['@context'];
  if (!context || 
      (!Array.isArray(context) && typeof context !== 'string')) {
    throw new CredentialError('Invalid @context format', 'INVALID_CONTEXT');
  }

  // Validate type array
  const type = credentialObj.type;
  if (!Array.isArray(type) || !type.includes('VerifiableCredential')) {
    throw new CredentialError('Invalid type format or missing VerifiableCredential type', 'INVALID_TYPE');
  }

  // Validate dates
  try {
    new Date(credentialObj.issuanceDate as string);
    if (credentialObj.expirationDate) {
      new Date(credentialObj.expirationDate as string);
    }
  } catch {
    throw new CredentialError('Invalid date format', 'INVALID_DATE');
  }

  // Test JSON-LD processing to catch context issues early
  try {
    await jsonld.expand(credential as jsonld.JsonLdDocument);
  } catch (error) {
    if (error instanceof Error && error.message.includes('tried to redefine a protected term')) {
      throw new CredentialError(
        'Invalid JSON-LD context: attempt to redefine protected terms. Please check your @context definition.',
        'INVALID_JSONLD_CONTEXT'
      );
    } else if (error instanceof Error) {
      console.warn('JSON-LD expansion warning:', error.message);
      // Continue despite expansion issues for now
    }
  }

  return credential as VerifiableCredential;
};

export const expandCredential = async (credential: VerifiableCredential): Promise<unknown> => {
  try {
    return await jsonld.expand(credential);
  } catch (error) {
    console.warn('Failed to expand credential with JSON-LD:', error);
    return credential;
  }
};

export const compactCredential = async (expanded: unknown, context?: unknown): Promise<VerifiableCredential> => {
  try {
    const defaultContext = (context as jsonld.ContextDefinition) || [
      'https://www.w3.org/2018/credentials/v1'
    ];
    
    const compacted = await jsonld.compact(expanded as jsonld.JsonLdDocument, defaultContext);
    return compacted as VerifiableCredential;
  } catch (error) {
    console.warn('Failed to compact credential with JSON-LD:', error);
    return expanded as VerifiableCredential;
  }
};

export const formatCredentialForDisplay = (credential: VerifiableCredential): CredentialDisplay => {
  const issuer = typeof credential.issuer === 'string' 
    ? credential.issuer 
    : credential.issuer.id;

  const issuanceDate = new Date(credential.issuanceDate);
  const expirationDate = credential.expirationDate ? new Date(credential.expirationDate) : undefined;
  const isExpired = expirationDate ? expirationDate < new Date() : false;

  // Extract a meaningful title from the credential
  let title = 'Verifiable Credential';
  if (credential.name && typeof credential.name === 'string') {
    title = credential.name;
  } else if (credential.credentialSubject.name && typeof credential.credentialSubject.name === 'string') {
    title = credential.credentialSubject.name;
  } else if (credential.type.length > 1) {
    title = credential.type.filter(t => t !== 'VerifiableCredential')[0] || title;
  }

  return {
    id: credential.id,
    title,
    issuer: issuer.replace(/^https?:\/\//, '').replace(/^www\./, ''),
    issuanceDate: issuanceDate.toLocaleDateString(),
    expirationDate: expirationDate?.toLocaleDateString(),
    isExpired,
    types: credential.type
  };
};

export const downloadCredential = (credential: VerifiableCredential, filename?: string) => {
  const jsonString = JSON.stringify(credential, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `credential-${credential.id.replace(/[^a-zA-Z0-9]/g, '-')}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
};

export const parseCredentialFile = async (file: File): Promise<VerifiableCredential> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        const validated = await validateCredential(parsed);
        resolve(validated);
      } catch (error) {
        if (error instanceof CredentialError) {
          reject(error);
        } else if (error instanceof SyntaxError) {
          reject(new CredentialError('Invalid JSON format', 'INVALID_JSON'));
        } else {
          reject(new CredentialError('Failed to parse credential file', 'PARSE_ERROR'));
        }
      }
    };
    
    reader.onerror = () => {
      reject(new CredentialError('Failed to read file', 'FILE_READ_ERROR'));
    };
    
    reader.readAsText(file);
  });
};

export const convertToTurtle = async (credential: VerifiableCredential): Promise<string> => {
  try {
    // First convert JSON-LD to RDF using jsonld library
    const nquads = await jsonld.toRDF(credential, { format: 'application/n-quads' });
    
    // Parse the N-Quads into N3 store
    const parser = new Parser({ format: 'N-Quads' });
    const store = new Store();
    
    return new Promise((resolve, reject) => {
      parser.parse(nquads as string, async (error, quad, prefixes) => {
        if (error) {
          reject(new Error(`Failed to parse RDF: ${error.message}`));
          return;
        }
        
        if (quad) {
          store.addQuad(quad);
        } else {
          // Parsing complete, now serialize to Turtle using pretty-turtle
          try {
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
              ...prefixes
            };
            
            // Get all quads from the store
            const quads = store.getQuads(null, null, null, null);
            
            // Use pretty-turtle to format the output
            const prettyTurtleOutput = await prettyTurtle(quads, { 
              prefixes: prefixMap
            });
            
            resolve(prettyTurtleOutput);
          } catch (prettyError) {
            console.warn('Pretty-turtle formatting failed, falling back to standard N3 writer:', prettyError);
            
            // Fallback to standard N3 writer
            const writer = new Writer({ 
              format: 'Turtle',
              prefixes: {
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
                ...prefixes
              }
            });
            
            // Add all quads to the writer
            store.getQuads(null, null, null, null).forEach(q => writer.addQuad(q));
            
            writer.end((writeError, result) => {
              if (writeError) {
                reject(new Error(`Failed to serialize to Turtle: ${writeError.message}`));
              } else {
                resolve(result);
              }
            });
          }
        }
      });
    });
  } catch (error) {
    // Fallback: create a more comprehensive Turtle representation
    console.warn('Advanced RDF conversion failed, using enhanced fallback conversion:', error);
    return createEnhancedTurtle(credential);
  }
};

const createEnhancedTurtle = (credential: VerifiableCredential): string => {
  const issuer = typeof credential.issuer === 'string' ? credential.issuer : credential.issuer.id;
  const issuerName = typeof credential.issuer === 'object' && credential.issuer.name ? credential.issuer.name : null;
  
  // Determine context-specific prefixes based on credential types and contexts
  let contextPrefixes = '';
  const contextMappings: { [key: string]: string } = {};
  
  if (Array.isArray(credential['@context'])) {
    credential['@context'].forEach(ctx => {
      if (typeof ctx === 'string') {
        if (ctx.includes('credentials/examples')) {
          contextPrefixes += '@prefix credex: <https://www.w3.org/2018/credentials/examples#> .\n';
          contextMappings['degree'] = 'credex:degree';
          contextMappings['graduationDate'] = 'credex:graduationDate';
        } else if (ctx.includes('citizenship')) {
          contextPrefixes += '@prefix citizenship: <https://w3id.org/citizenship#> .\n';
          contextMappings['givenName'] = 'citizenship:givenName';
          contextMappings['familyName'] = 'citizenship:familyName';
          contextMappings['birthDate'] = 'citizenship:birthDate';
          contextMappings['gender'] = 'citizenship:gender';
          contextMappings['residentSince'] = 'citizenship:residentSince';
          contextMappings['lprCategory'] = 'citizenship:lprCategory';
          contextMappings['lprNumber'] = 'citizenship:lprNumber';
          contextMappings['commuterClassification'] = 'citizenship:commuterClassification';
          contextMappings['birthCountry'] = 'citizenship:birthCountry';
        } else if (ctx.includes('vaccination')) {
          contextPrefixes += '@prefix vaccination: <https://w3id.org/vaccination#> .\n';
          contextMappings['recipient'] = 'vaccination:recipient';
          contextMappings['vaccine'] = 'vaccination:vaccine';
          contextMappings['occurrence'] = 'vaccination:occurrence';
          contextMappings['location'] = 'vaccination:location';
          contextMappings['lotNumber'] = 'vaccination:lotNumber';
          contextMappings['doseSequence'] = 'vaccination:doseSequence';
        }
      }
    });
  }

  // Helper function to convert property names to appropriate RDF properties
  const mapProperty = (key: string): string => {
    if (contextMappings[key]) return contextMappings[key];
    
    // Default mappings
    const defaultMappings: { [key: string]: string } = {
      'name': 'schema:name',
      'type': 'rdf:type',
      'id': '@id',
      'givenName': 'schema:givenName',
      'familyName': 'schema:familyName',
      'birthDate': 'schema:birthDate',
      'gender': 'schema:gender',
      'image': 'schema:image',
      'address': 'schema:address',
      'code': 'schema:code',
      'codeSystem': 'schema:codeSystem',
      'displayName': 'schema:displayName'
    };
    
    return defaultMappings[key] || `schema:${key}`;
  };

  // Helper function to serialize complex objects
  const serializeObject = (obj: unknown, indent: string = '  '): string => {
    if (obj === null || obj === undefined) return '';
    
    if (typeof obj === 'string') {
      // Check if it's a URI
      if (obj.startsWith('http://') || obj.startsWith('https://') || obj.startsWith('did:')) {
        return `<${obj}>`;
      }
      return `"${obj.replace(/"/g, '\\"')}"`;
    }
    
    if (typeof obj === 'number') {
      return `"${obj}"^^xsd:integer`;
    }
    
    if (typeof obj === 'boolean') {
      return `"${obj}"^^xsd:boolean`;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => serializeObject(item, indent)).join(', ');
    }
    
    if (typeof obj === 'object') {
      const entries = Object.entries(obj as Record<string, unknown>).filter(([key]) => key !== 'id' && key !== '@id');
      if (entries.length === 0) return '';
      
      let result = '[\n';
      entries.forEach(([key, value], index) => {
        const property = mapProperty(key);
        const serializedValue = serializeObject(value, indent + '  ');
        if (serializedValue) {
          result += `${indent}  ${property} ${serializedValue}`;
          if (index < entries.length - 1) result += ' ;';
          result += '\n';
        }
      });
      result += `${indent}]`;
      return result;
    }
    
    return `"${String(obj).replace(/"/g, '\\"')}"`;
  };

  // Generate the Turtle content
  let turtle = `@prefix cred: <https://www.w3.org/2018/credentials#> .
@prefix sec: <https://w3id.org/security#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix schema: <http://schema.org/> .
${contextPrefixes}

# Credential
<${credential.id}> a ${credential.type.map(t => t === 'VerifiableCredential' ? 'cred:VerifiableCredential' : `schema:${t}`).join(', ')} ;
    cred:issuer <${issuer}> ;
    cred:issuanceDate "${credential.issuanceDate}"^^xsd:dateTime ;
    ${credential.expirationDate ? `cred:expirationDate "${credential.expirationDate}"^^xsd:dateTime ;` : ''}
    cred:credentialSubject <${credential.credentialSubject.id || '_:subject'}> .

`;

  // Add issuer information if it's an object with additional properties
  if (issuerName) {
    turtle += `# Issuer
<${issuer}> schema:name "${issuerName}" .

`;
  }

  // Add credential subject details
  turtle += `# Credential Subject
<${credential.credentialSubject.id || '_:subject'}> `;

  const subjectEntries = Object.entries(credential.credentialSubject).filter(([key]) => key !== 'id');
  subjectEntries.forEach(([key, value], index) => {
    const property = mapProperty(key);
    const serializedValue = serializeObject(value);
    if (serializedValue) {
      turtle += `${property} ${serializedValue}`;
      if (index < subjectEntries.length - 1) turtle += ' ;';
      turtle += '\n    ';
    }
  });
  turtle = turtle.trim() + ' .\n\n';

  // Add proof information
  if (credential.proof) {
    turtle += `# Cryptographic Proof
<${credential.id}> sec:proof [
    a sec:${credential.proof.type} ;
    sec:created "${credential.proof.created}"^^xsd:dateTime ;
    sec:verificationMethod <${credential.proof.verificationMethod}> ;
    sec:proofPurpose sec:${credential.proof.proofPurpose}`;

    if (credential.proof.jws) {
      turtle += ` ;
    sec:jws "${credential.proof.jws}"`;
    }
    
    if (credential.proof.proofValue) {
      turtle += ` ;
    sec:proofValue "${credential.proof.proofValue}"`;
    }
    
    turtle += `
] .`;
  }

  return turtle;
};

// SPARQL Querying and Derived Credentials

export const combinedRDFFromCredentials = async (credentials: VerifiableCredential[]): Promise<string> => {
  const turtleStrings = await Promise.all(
    credentials.map(cred => convertToTurtle(cred))
  );
  
  // Combine all turtle strings with proper prefixes
  const prefixes = `@prefix cred: <https://www.w3.org/2018/credentials#> .
@prefix credex: <https://www.w3.org/2018/credentials/examples#> .
@prefix sec: <https://w3id.org/security#> .
@prefix citizenship: <https://w3id.org/citizenship#> .
@prefix vaccination: <https://w3id.org/vaccination#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix schema: <http://schema.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix dc: <http://purl.org/dc/terms/> .

`;

  const combinedData = turtleStrings
    .map(turtle => {
      // Remove prefix declarations from individual turtle strings
      return turtle.replace(/@prefix\s+[^:]+:\s+<[^>]+>\s+\.\s*/g, '');
    })
    .join('\n\n');

  return prefixes + combinedData;
};

export const executeSPARQLQuery = async (
  sparqlQuery: string, 
  credentials: VerifiableCredential[]
): Promise<RDF.Bindings[]> => {
  try {
    console.log('SPARQL Query:', sparqlQuery);
    console.log('Credentials to query:', credentials.length);
    
    // Parse the SPARQL query using sparqlalgebrajs to validate it's a SELECT query
    const algebra = translate(sparqlQuery);
    
    // Check if this is a SELECT query
    if (algebra.type !== 'project') {
      throw new CredentialError('Only SELECT queries are supported in executeSPARQLQuery', 'UNSUPPORTED_QUERY_TYPE');
    }
    
    // Extract the variables from the SELECT clause
    const selectVariables = (algebra as { variables: Array<{ value: string }> }).variables.map((variable) => variable.value);
    console.log('SELECT variables:', selectVariables);
    
    if (credentials.length === 0) {
      console.log('No credentials available for querying');
      return [];
    }
    
    // Create a combined RDF store from all credentials
    const store = new Store();
    
    // Convert each credential to RDF and add to the store
    for (const credential of credentials) {
      try {
        // Convert credential to N-Quads using jsonld
        const rdfDataset = await jsonld.toRDF(credential);
        store.addAll(rdfDataset as RDF.Dataset);
      } catch (error) {
        console.warn(`Failed to convert credential ${credential.id} to RDF:`, error);
        if (error instanceof Error) {
          console.warn(`Error details: ${error.message}`);
          if (error.message.includes('tried to redefine a protected term')) {
            console.warn(`Credential ${credential.id} has context issues - skipping RDF conversion`);
          }
        }
        // Continue with other credentials even if one fails
      }
    }
    
    console.log(`Created RDF store with ${store.size} quads`);
    
    // If no credentials could be converted to RDF, return empty results
    if (store.size === 0) {
      console.warn('No credentials could be converted to RDF - returning empty results');
      return [];
    }
    
    // Execute SPARQL query using Comunica
    const queryEngine = new QueryEngine();
    
    const bindingsStream = await queryEngine.queryBindings(sparqlQuery, {
      sources: [store],
    });
    
    // Collect all bindings
    const bindings = await bindingsStream.toArray();
    return bindings;
    
  } catch (error) {
    console.error('SPARQL query execution failed:', error);
    if (error instanceof CredentialError) {
      throw error;
    }
    throw new CredentialError(`SPARQL query failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'SPARQL_ERROR');
  }
};

export const createDerivedCredential = async (
  sparqlQuery: string,
  sourceCredentials: VerifiableCredential[],
  derivedCredentialTemplate: {
    id: string;
    type: string[];
    issuer: string;
    name?: string;
    description?: string;
  }
): Promise<VerifiableCredential> => {
  try {
    // Execute the SPARQL query to get derived data
    const queryResults = await executeSPARQLQuery(sparqlQuery, sourceCredentials);
    
    // Create the base derived credential structure
    const now = new Date().toISOString();
    const derivedCredential: VerifiableCredential = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://w3id.org/credentials/derived/v1'
      ],
      id: derivedCredentialTemplate.id,
      type: ['VerifiableCredential', ...derivedCredentialTemplate.type.filter(t => t !== 'VerifiableCredential')],
      issuer: derivedCredentialTemplate.issuer,
      issuanceDate: now,
      name: derivedCredentialTemplate.name,
      description: derivedCredentialTemplate.description,
      credentialSubject: {
        id: 'did:derived:' + Date.now(),
        type: 'DerivedCredentialSubject',
        derivedFrom: sourceCredentials.map(cred => cred.id),
        sparqlQuery: sparqlQuery,
        queryResults: queryResults
      },
      // Mock signature for now - to be replaced with ZKP proof
      proof: {
        type: 'DerivedCredentialProof2024',
        created: now,
        verificationMethod: derivedCredentialTemplate.issuer + '#keys-1',
        proofPurpose: 'assertionMethod',
        proofValue: 'mock-derived-proof-' + Date.now() + '-will-be-replaced-with-zkp',
        // Add metadata about the derivation
        derivationMetadata: {
          sourceCredentials: sourceCredentials.length,
          queryHash: await hashString(sparqlQuery),
          derivationTimestamp: now
        }
      }
    };

    return derivedCredential;
  } catch (error) {
    console.error('Failed to create derived credential:', error);
    throw new CredentialError(
      `Failed to create derived credential: ${error instanceof Error ? error.message : 'Unknown error'}`, 
      'DERIVATION_ERROR'
    );
  }
};

// Helper function to get the validity period intersection of multiple credentials
const getValidityPeriodIntersection = (credentials: VerifiableCredential[]): { validFrom: string; validUntil?: string } => {
  // Find the latest issuanceDate (validFrom)
  const validFrom = credentials
    .map(cred => new Date(cred.issuanceDate))
    .reduce((latest, current) => current > latest ? current : latest)
    .toISOString();

  // Find the earliest expirationDate (validUntil)
  const expirationDates = credentials
    .map(cred => cred.expirationDate)
    .filter((date): date is string => date !== undefined)
    .map(date => new Date(date));

  const validUntil = expirationDates.length > 0 
    ? expirationDates.reduce((earliest, current) => current < earliest ? current : earliest).toISOString()
    : undefined;

  return { validFrom, validUntil };
};

// Helper function to canonicalize RDF data and generate hash
const canonicalizeAndHash = async (quads: RDF.Quad[]): Promise<string> => {
  try {
    // Convert quads to N-Triples format for canonicalization
    const writer = new Writer({ format: 'N-Triples' });
    
    // Add all quads to the writer
    for (const quad of quads) {
      writer.addQuad(quad);
    }
    
    // Get the N-Triples string
    const ntriples = await new Promise<string>((resolve, reject) => {
      writer.end((error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });

    // Canonicalize the RDF dataset
    const canonicalized = await canonize(ntriples, {
      algorithm: 'URDNA2015',
      format: 'application/n-quads'
    });

    // Generate SHA-256 hash of the canonicalized dataset
    const encoder = new TextEncoder();
    const data = encoder.encode(canonicalized);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.error('Failed to canonicalize and hash RDF data:', error);
    // Fallback to simple timestamp-based hash
    return await hashString(Date.now().toString() + Math.random().toString());
  }
};

// Create multiple derived credentials from CONSTRUCT query results
export const createDerivedCredentialsFromConstruct = async (
  constructQuads: RDF.Quad[],
  selectedBindings: RDF.Bindings[],
  sourceCredentials: VerifiableCredential[],
  derivedCredentialTemplate: {
    type?: string[];
    name?: string;
    description?: string;
  } = {}
): Promise<VerifiableCredential[]> => {
  try {
    const validityPeriod = getValidityPeriodIntersection(sourceCredentials);
    const derivedCredentials: VerifiableCredential[] = [];

    // Group quads by subject (from ?subject variable in bindings)
    const subjectToQuads = new Map<string, RDF.Quad[]>();
    const subjectToBindings = new Map<string, RDF.Bindings>();

    // Build mappings from selected bindings
    selectedBindings.forEach((bindings, index) => {
      const subjectTerm = bindings.get('subject');
      if (subjectTerm) {
        const subjectValue = subjectTerm.value;
        
        // Find quads related to this subject
        const relatedQuads = constructQuads.filter(quad => 
          quad.subject.value === subjectValue
        );

        if (relatedQuads.length > 0) {
          subjectToQuads.set(subjectValue, relatedQuads);
          subjectToBindings.set(subjectValue, bindings);
        }
      }
    });

    // If no subject variables found, create one credential for all data
    if (subjectToQuads.size === 0) {
      console.warn('No ?subject variable found in bindings, creating single credential with all CONSTRUCT data');
      
      // Generate hash for the entire dataset
      const datasetHash = await canonicalizeAndHash(constructQuads);
      
      const now = new Date().toISOString();
      const derivedCredential: VerifiableCredential = {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          'https://w3id.org/credentials/derived/v1'
        ],
        id: `did:example:derived:${datasetHash}`,
        type: ['VerifiableCredential', 'Derived', ...(derivedCredentialTemplate.type || [])],
        issuer: 'did:example:derived',
        issuanceDate: validityPeriod.validFrom,
        ...(validityPeriod.validUntil && { expirationDate: validityPeriod.validUntil }),
        name: derivedCredentialTemplate.name || 'Derived Credential from CONSTRUCT Query',
        description: derivedCredentialTemplate.description || 'Credential derived from SPARQL CONSTRUCT query results',
        credentialSubject: {
          id: 'did:derived:' + datasetHash,
          type: 'DerivedCredentialSubject',
          derivedFrom: sourceCredentials.map(cred => cred.id),
          constructResult: await prettyTurtle(constructQuads, {
            prefixes: {
              'cred': 'https://www.w3.org/2018/credentials#',
              'schema': 'http://schema.org/',
              'vaccination': 'https://w3id.org/vaccination#',
              'derived': 'https://example.org/derived/',
              'xsd': 'http://www.w3.org/2001/XMLSchema#'
            }
          })
        },
        proof: {
          type: 'DerivedCredentialProof2024',
          created: now,
          verificationMethod: 'did:example:derived#keys-1',
          proofPurpose: 'assertionMethod',
          proofValue: 'mock-derived-proof-' + datasetHash,
          derivationMetadata: {
            sourceCredentials: sourceCredentials.length,
            datasetHash: datasetHash,
            derivationTimestamp: now
          }
        }
      };

      derivedCredentials.push(derivedCredential);
    } else {
      // Create one credential per subject
      for (const [subjectValue, quads] of subjectToQuads) {
        const bindings = subjectToBindings.get(subjectValue);
        
        // Generate hash for this subject's data
        const datasetHash = await canonicalizeAndHash(quads);
        
        const now = new Date().toISOString();
        const derivedCredential: VerifiableCredential = {
          '@context': [
            'https://www.w3.org/2018/credentials/v1',
            'https://w3id.org/credentials/derived/v1'
          ],
          id: `did:example:derived:${datasetHash}`,
          type: ['VerifiableCredential', 'Derived', ...(derivedCredentialTemplate.type || [])],
          issuer: 'did:example:derived',
          issuanceDate: validityPeriod.validFrom,
          ...(validityPeriod.validUntil && { expirationDate: validityPeriod.validUntil }),
          name: derivedCredentialTemplate.name || `Derived Credential for ${subjectValue}`,
          description: derivedCredentialTemplate.description || `Credential derived from SPARQL CONSTRUCT query for subject ${subjectValue}`,
          credentialSubject: {
            id: subjectValue,
            type: 'DerivedCredentialSubject',
            derivedFrom: sourceCredentials.map(cred => cred.id),
            constructResult: await prettyTurtle(quads, {
              prefixes: {
                'cred': 'https://www.w3.org/2018/credentials#',
                'schema': 'http://schema.org/',
                'vaccination': 'https://w3id.org/vaccination#',
                'derived': 'https://example.org/derived/',
                'xsd': 'http://www.w3.org/2001/XMLSchema#'
              }
            })
          },
          proof: {
            type: 'DerivedCredentialProof2024',
            created: now,
            verificationMethod: 'did:example:derived#keys-1',
            proofPurpose: 'assertionMethod',
            proofValue: 'mock-derived-proof-' + datasetHash,
            derivationMetadata: {
              sourceCredentials: sourceCredentials.length,
              datasetHash: datasetHash,
              subjectBinding: subjectValue,
              derivationTimestamp: now
            }
          }
        };

        derivedCredentials.push(derivedCredential);
      }
    }

    return derivedCredentials;
  } catch (error) {
    console.error('Failed to create derived credentials from CONSTRUCT:', error);
    throw new CredentialError(
      `Failed to create derived credentials: ${error instanceof Error ? error.message : 'Unknown error'}`, 
      'CONSTRUCT_DERIVATION_ERROR'
    );
  }
};

// Helper function to hash a string (simple implementation)
const hashString = async (str: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Sample SPARQL queries for common use cases
export const getSampleSPARQLQueries = () => [
  {
    name: 'Get All Names',
    description: 'Extract all names from credentials',
    query: `PREFIX schema: <http://schema.org/>
PREFIX citizenship: <https://w3id.org/citizenship#>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>

SELECT ?givenName ?familyName ?fullName WHERE {
  {
    ?subject schema:givenName ?givenName .
    ?subject schema:familyName ?familyName .
  } UNION {
    ?subject citizenship:givenName ?givenName .
    ?subject citizenship:familyName ?familyName .
  } UNION {
    ?subject foaf:name ?fullName .
  } UNION {
    ?subject schema:name ?fullName .
  }
}`
  },
  {
    name: 'Verify Adult Status',
    description: 'Check if credential holder is over 18',
    query: `PREFIX schema: <http://schema.org/>
PREFIX citizenship: <https://w3id.org/citizenship#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT ?subject ?isAdult WHERE {
  ?subject schema:birthDate|citizenship:birthDate ?birthDate .
  BIND((xsd:date(?birthDate) < xsd:date("${new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}")) AS ?isAdult)
  FILTER(BOUND(?isAdult) && ?isAdult)
}`
  },
  {
    name: 'Verify Adult Status (CONSTRUCT)',
    description: 'Create adult verification statements',
    query: `PREFIX schema: <http://schema.org/>
PREFIX citizenship: <https://w3id.org/citizenship#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

CONSTRUCT {
  ?subject a citizenship:Adult ;
           citizenship:isAdult ?isAdult .
} WHERE {
  ?subject schema:birthDate|citizenship:birthDate ?birthDate .
  BIND((xsd:date(?birthDate) < xsd:date("${new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}")) AS ?isAdult)
  FILTER(BOUND(?isAdult) && ?isAdult)
}`
  },
  {
    name: 'Get Vaccination Status',
    description: 'Extract vaccination information',
    query: `PREFIX vaccination: <https://w3id.org/vaccination#>
PREFIX schema: <http://schema.org/>

SELECT ?recipient ?vaccine ?date ?location WHERE {
  ?credential vaccination:recipient ?recipient .
  ?credential vaccination:vaccine ?vaccine .
  OPTIONAL { ?credential vaccination:occurrence ?date }
  OPTIONAL { ?credential vaccination:location ?location }
}`
  },
  {
    name: 'Construct Identity Profile',
    description: 'Create a minimal identity profile from credentials',
    query: `PREFIX schema: <http://schema.org/>
PREFIX citizenship: <https://w3id.org/citizenship#>
PREFIX derived: <https://example.org/derived/>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>

CONSTRUCT {
  ?person a foaf:Person ;
          foaf:givenName ?givenName ;
          foaf:familyName ?familyName ;
          schema:birthDate ?birthDate .
}
WHERE {
  ?subject schema:givenName|citizenship:givenName ?givenName .
  ?subject schema:familyName|citizenship:familyName ?familyName .
  OPTIONAL { ?subject schema:birthDate|citizenship:birthDate ?birthDate }
  BIND(IRI(CONCAT("https://example.org/derived/person/", ENCODE_FOR_URI(?givenName), "-", ENCODE_FOR_URI(?familyName))) AS ?person)
}`
  },
  {
    name: 'Construct Age Verification',
    description: 'Create age verification statements',
    query: `PREFIX schema: <http://schema.org/>
PREFIX citizenship: <https://w3id.org/citizenship#>
PREFIX derived: <https://example.org/derived/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

CONSTRUCT {
  ?ageVerification a derived:AgeVerification ;
                   derived:subject ?subject ;
                   derived:isAdult ?isAdult ;
                   derived:verifiedAt ?now .
}
WHERE {
  ?subject schema:birthDate|citizenship:birthDate ?birthDate .
  BIND((xsd:date(?birthDate) < xsd:date("${new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}")) AS ?isAdult)
  BIND(NOW() AS ?now)
  BIND(IRI(CONCAT("https://example.org/derived/age-verification/", ENCODE_FOR_URI(STR(?subject)))) AS ?ageVerification)
  FILTER(BOUND(?isAdult))
}`
  },
  {
    name: 'Construct Vaccination Summary',
    description: 'Create a vaccination summary from vaccination credentials',
    query: `PREFIX vaccination: <https://w3id.org/vaccination#>
PREFIX schema: <http://schema.org/>
PREFIX derived: <https://example.org/derived/>

CONSTRUCT {
  ?summary a derived:VaccinationSummary ;
           derived:recipient ?recipient ;
           derived:hasVaccination ?vaccine ;
           derived:vaccinationDate ?date .
}
WHERE {
  ?credential vaccination:recipient ?recipient .
  ?credential vaccination:vaccine ?vaccine .
  OPTIONAL { ?credential vaccination:occurrence ?date }
  BIND(IRI(CONCAT("https://example.org/derived/vaccination-summary/", ENCODE_FOR_URI(STR(?recipient)))) AS ?summary)
}`
  }
];
