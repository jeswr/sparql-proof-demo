export interface VerifiableCredential {
  '@context': string | string[];
  id: string;
  type: string[];
  issuer: string | { id: string; [key: string]: any };
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: {
    id?: string;
    [key: string]: any;
  };
  proof?: {
    type: string;
    created: string;
    verificationMethod: string;
    proofPurpose: string;
    jws?: string;
    proofValue?: string;
    [key: string]: any;
  };
  [key: string]: any;
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
