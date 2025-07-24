# W3C Verifiable Credentials Wallet

A secure, client-side wallet application for managing W3C JSON-LD Verifiable Credentials. Built with Next.js and TypeScript.

## Features

- 🔒 **Secure Local Storage**: All credentials are stored locally in your browser
- 📁 **Upload & Download**: Support for JSON credential files
- 📋 **JSON Paste**: Direct paste of credential JSON
- 👁️ **Rich Viewer**: Formatted and raw JSON viewing modes  
- 🔍 **Validation**: W3C Verifiable Credential format validation
- 🌙 **Dark Mode**: Full dark mode support
- 📱 **Responsive**: Works on desktop and mobile devices

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the wallet.

## Usage

### Adding Credentials

1. **Upload File**: Drag and drop or click to upload a `.json` file containing a W3C Verifiable Credential
2. **Paste JSON**: Click "Paste JSON" and paste the credential JSON directly

### Managing Credentials

- **View**: Click on any credential in the list to view its details
- **Download**: Use the download button to save a credential as a JSON file
- **Delete**: Use the trash button (click twice to confirm) to remove a credential

### Sample Credential

A sample verifiable credential is included at `/public/sample-credential.json` for testing purposes.

## W3C Verifiable Credentials

This wallet supports [W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model/) in JSON-LD format. Required fields include:

- `@context`: JSON-LD context
- `id`: Unique identifier for the credential
- `type`: Must include "VerifiableCredential"
- `issuer`: The entity that issued the credential
- `issuanceDate`: When the credential was issued
- `credentialSubject`: The claims about the subject

## Security

- All credentials are stored locally in your browser's localStorage
- No data is transmitted to external servers
- Client-side validation ensures credential format compliance

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).
