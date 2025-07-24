export interface VerifiableCredential {
  '@context': string | string[];
  id: string;
  type: string[];
  issuer: string | { id: string; [key: string]: unknown };
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: {
    id?: string;
    [key: string]: unknown;
  };
  proof?: {
    type: string;
    created: string;
    verificationMethod: string;
    proofPurpose: string;
    jws?: string;
    proofValue?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface CredentialDisplay {
  id: string;
  title: string;
  issuer: string;
  issuanceDate: string;
  expirationDate?: string;
  isExpired: boolean;
  types: string[];
}
