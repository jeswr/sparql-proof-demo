import { VerifiableCredential, CredentialDisplay } from '@/types/credential';
import * as jsonld from 'jsonld';

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
    const defaultContext = [
      'https://www.w3.org/2018/credentials/v1',
      context || {}
    ].filter(Boolean);
    
    return await jsonld.compact(expanded, defaultContext) as VerifiableCredential;
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
