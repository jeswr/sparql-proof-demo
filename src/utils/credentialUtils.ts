import { VerifiableCredential, CredentialDisplay } from '@/types/credential';
import * as jsonld from 'jsonld';
import { Parser, Writer, Store, DataFactory } from 'n3';
import { write as prettyTurtle } from '@jeswr/pretty-turtle';

const { namedNode, literal, quad } = DataFactory;

export class CredentialError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'CredentialError';
  }
}

export const validateCredential = async (credential: any): Promise<VerifiableCredential> => {
  // Basic structure validation
  if (!credential || typeof credential !== 'object') {
    throw new CredentialError('Invalid credential format', 'INVALID_FORMAT');
  }

  // Check required fields
  const requiredFields = ['@context', 'id', 'type', 'issuer', 'issuanceDate', 'credentialSubject'];
  for (const field of requiredFields) {
    if (!(field in credential)) {
      throw new CredentialError(`Missing required field: ${field}`, 'MISSING_FIELD');
    }
  }

  // Validate @context
  if (!credential['@context'] || 
      (!Array.isArray(credential['@context']) && typeof credential['@context'] !== 'string')) {
    throw new CredentialError('Invalid @context format', 'INVALID_CONTEXT');
  }

  // Validate type array
  if (!Array.isArray(credential.type) || !credential.type.includes('VerifiableCredential')) {
    throw new CredentialError('Invalid type format or missing VerifiableCredential type', 'INVALID_TYPE');
  }

  // Validate dates
  try {
    new Date(credential.issuanceDate);
    if (credential.expirationDate) {
      new Date(credential.expirationDate);
    }
  } catch (error) {
    throw new CredentialError('Invalid date format', 'INVALID_DATE');
  }

  return credential as VerifiableCredential;
};

export const expandCredential = async (credential: VerifiableCredential): Promise<any> => {
  try {
    return await jsonld.expand(credential);
  } catch (error) {
    console.warn('Failed to expand credential with JSON-LD:', error);
    return credential;
  }
};

export const compactCredential = async (expanded: any, context?: any): Promise<VerifiableCredential> => {
  try {
    const defaultContext = context || [
      'https://www.w3.org/2018/credentials/v1'
    ];
    
    const compacted = await jsonld.compact(expanded, defaultContext);
    return compacted as VerifiableCredential;
  } catch (error) {
    console.warn('Failed to compact credential with JSON-LD:', error);
    return expanded;
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
  if (credential.name) {
    title = credential.name;
  } else if (credential.credentialSubject.name) {
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
  let contextMappings: { [key: string]: string } = {};
  
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
  const serializeObject = (obj: any, indent: string = '  '): string => {
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
      const entries = Object.entries(obj).filter(([key, _]) => key !== 'id' && key !== '@id');
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

  const subjectEntries = Object.entries(credential.credentialSubject).filter(([key, _]) => key !== 'id');
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
): Promise<any[]> => {
  try {
    // For now, return a mock result indicating the feature is under development
    // This will be implemented with proper SPARQL execution once the library issues are resolved
    console.log('SPARQL Query:', sparqlQuery);
    console.log('Credentials to query:', credentials.length);
    
    // Helper function to safely get nested property
    const getNestedProperty = (obj: any, path: string): any => {
      return path.split('.').reduce((current, key) => current?.[key], obj);
    };
    
    // Helper function to extract string value from potentially complex objects
    const extractStringValue = (value: any): string => {
      if (typeof value === 'string') {
        return value;
      }
      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
      }
      if (value && typeof value === 'object') {
        // Try common string properties
        if (value.displayName) return value.displayName;
        if (value.name) return value.name;
        if (value.title) return value.title;
        if (value.label) return value.label;
        if (value.code) return value.code;
        if (value.value) return extractStringValue(value.value);
        // Fallback to JSON representation
        return JSON.stringify(value);
      }
      return String(value);
    };
    
    // Mock results based on query content for demonstration
    if (sparqlQuery.toLowerCase().includes('givenname') || sparqlQuery.toLowerCase().includes('familyname')) {
      return credentials.map(cred => {
        const subject = cred.credentialSubject as any;
        const result: any = {
          subject: { type: 'uri', value: subject.id || `_:subject-${cred.id}` }
        };
        
        // Only include fields that actually exist
        if (subject.givenName) {
          result.givenName = { type: 'literal', value: subject.givenName };
        }
        if (subject.familyName) {
          result.familyName = { type: 'literal', value: subject.familyName };
        }
        if (subject.name) {
          result.fullName = { type: 'literal', value: subject.name };
        }
        
        return result;
      }).filter(result => Object.keys(result).length > 1); // Filter out entries with only subject
    }
    
    if (sparqlQuery.toLowerCase().includes('birthdate') || sparqlQuery.toLowerCase().includes('adult')) {
      return credentials.map(cred => {
        const subject = cred.credentialSubject as any;
        const result: any = {
          subject: { type: 'uri', value: subject.id || `_:subject-${cred.id}` }
        };
        
        if (subject.birthDate) {
          result.birthDate = { type: 'literal', value: subject.birthDate };
          
          // Calculate if adult (over 18)
          const birthDate = new Date(subject.birthDate);
          const today = new Date();
          
          // Calculate age properly
          let age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          
          // If birth month hasn't occurred this year, or it's the birth month but birth day hasn't occurred
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
          
          result.isAdult = { type: 'literal', value: age >= 18 ? 'true' : 'false' };
          result.age = { type: 'literal', value: age.toString() };
        }
        
        return result;
      }).filter(result => Object.keys(result).length > 1);
    }
    
    if (sparqlQuery.toLowerCase().includes('vaccination')) {
      return credentials
        .filter(cred => cred.type.some(t => t.toLowerCase().includes('vaccination')))
        .map(cred => {
          const subject = cred.credentialSubject as any;
          const result: any = {};
          
          if (subject.id) {
            result.recipient = { type: 'uri', value: subject.id };
          }
          
          // Handle vaccine information - could be string or complex object
          if (subject.vaccine) {
            result.vaccine = { type: 'literal', value: extractStringValue(subject.vaccine) };
          }
          
          if (subject.occurrence) {
            result.date = { type: 'literal', value: extractStringValue(subject.occurrence) };
          } else if (cred.issuanceDate) {
            result.date = { type: 'literal', value: cred.issuanceDate };
          }
          
          // Handle location - could be string or object
          if (subject.location) {
            result.location = { type: 'literal', value: extractStringValue(subject.location) };
          }
          
          return result;
        }).filter(result => Object.keys(result).length > 0);
    }
    
    // Default: return basic credential info
    return credentials.map(cred => {
      const result: any = {
        credential: { type: 'uri', value: cred.id },
        type: { type: 'literal', value: cred.type.filter(t => t !== 'VerifiableCredential').join(', ') || 'VerifiableCredential' },
        issuer: { type: 'uri', value: typeof cred.issuer === 'string' ? cred.issuer : cred.issuer.id },
        issued: { type: 'literal', value: cred.issuanceDate }
      };
      
      // Add subject information if available
      const subject = cred.credentialSubject as any;
      if (subject.id) {
        result.subject = { type: 'uri', value: subject.id };
      }
      if (subject.givenName) {
        result.givenName = { type: 'literal', value: extractStringValue(subject.givenName) };
      }
      if (subject.familyName) {
        result.familyName = { type: 'literal', value: extractStringValue(subject.familyName) };
      }
      if (subject.name) {
        result.name = { type: 'literal', value: extractStringValue(subject.name) };
      }
      
      return result;
    });
    
  } catch (error) {
    console.error('SPARQL query execution failed:', error);
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

SELECT ?subject ?birthDate ?isAdult WHERE {
  {
    ?subject schema:birthDate ?birthDate .
  } UNION {
    ?subject citizenship:birthDate ?birthDate .
  }
  BIND(xsd:date(?birthDate) AS ?birth)
  BIND(xsd:date(NOW()) AS ?today)
  BIND((?today - ?birth) > "P18Y"^^xsd:duration AS ?isAdult)
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
    name: 'Combine Identity Info',
    description: 'Create a consolidated identity profile',
    query: `PREFIX schema: <http://schema.org/>
PREFIX citizenship: <https://w3id.org/citizenship#>
PREFIX cred: <https://www.w3.org/2018/credentials#>

CONSTRUCT {
  ?subject schema:givenName ?givenName ;
           schema:familyName ?familyName ;
           schema:birthDate ?birthDate ;
           schema:nationality ?country ;
           cred:credentialType ?credType .
} WHERE {
  ?credential cred:credentialSubject ?subject .
  ?credential a ?credType .
  OPTIONAL {
    { ?subject schema:givenName ?givenName } 
    UNION 
    { ?subject citizenship:givenName ?givenName }
  }
  OPTIONAL {
    { ?subject schema:familyName ?familyName }
    UNION
    { ?subject citizenship:familyName ?familyName }
  }
  OPTIONAL {
    { ?subject schema:birthDate ?birthDate }
    UNION
    { ?subject citizenship:birthDate ?birthDate }
  }
  OPTIONAL {
    { ?subject schema:nationality ?country }
    UNION
    { ?subject citizenship:birthCountry ?country }
  }
  FILTER(?credType != cred:VerifiableCredential)
}`
  }
];
