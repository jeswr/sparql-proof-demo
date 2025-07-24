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
              prefixes: prefixMap,
              // Additional formatting options
              format: 'turtle'
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
