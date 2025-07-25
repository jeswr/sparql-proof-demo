# W3C Verifiable Credentials Wallet

> **⚠️ Note**: This README is AI-generated and has not been vetted by a human. Please verify all information independently.

A secure, client-side wallet application for managing W3C JSON-LD Verifiable Credentials. Built with Next.js and TypeScript.

> **🎨 Development Note**: This application was "vibe coded" - developed through an intuitive, experimental approach focusing on feel and user experience over rigid specifications.

🌐 **Live Demo**: [http://vc-sparql.jeswr.org](http://vc-sparql.jeswr.org)

## Features

- 🔒 **Secure Local Storage**: All credentials are stored locally in your browser
- 📁 **Upload & Download**: Support for JSON credential files
- 📋 **JSON Paste**: Direct paste of credential JSON
- 🌐 **URL Import**: Fetch credentials directly from web URLs
- 🚀 **Test Credentials**: Quick access to live example credentials
- 👁️ **Rich Viewer**: Formatted, raw JSON, and RDF/Turtle viewing modes with syntax highlighting
- 🔍 **Validation**: W3C Verifiable Credential format validation
- 🐢 **RDF Support**: Convert credentials to Turtle RDF serialization
- 🎨 **Syntax Highlighting**: Beautiful code highlighting for JSON-LD and Turtle formats
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

1. **Upload File**: Drag and drop or click to upload a `.json` or `.jsonld` file containing a W3C Verifiable Credential
2. **Paste JSON**: Click "Paste JSON" and paste the credential JSON directly
3. **From URL**: Click "From URL" to fetch credentials from a web endpoint
   - Enter any URL that returns a W3C Verifiable Credential JSON
   - Use the "Quick Test Credentials" for immediate testing with live examples

### Managing Credentials

- **View**: Click on any credential in the list to view its details
- **View Modes**: Switch between Formatted, Raw JSON, and Turtle RDF views with syntax highlighting
- **Download**: Use the download button to save a credential as a JSON file
- **Delete**: Use the trash button to remove a credential

### Sample Credentials

Sample verifiable credentials are included for testing purposes:
- `/public/sample-credential.json` - University degree credential
- `/public/sample-permanent-resident.jsonld` - Permanent resident card credential  
- `/public/sample-vaccination.json` - COVID-19 vaccination certificate

These can be:
- Downloaded and uploaded as files
- Accessed via the "Quick Test Credentials" in the URL import feature
- Used as templates for creating your own credentials

## W3C Verifiable Credentials

This wallet supports [W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model/) in JSON-LD format. Required fields include:

- `@context`: JSON-LD context
- `id`: Unique identifier for the credential
- `type`: Must include "VerifiableCredential"
- `issuer`: The entity that issued the credential
- `issuanceDate`: When the credential was issued
- `credentialSubject`: The claims about the subject

### RDF/Turtle Support

The wallet can convert JSON-LD credentials to RDF Turtle serialization:
- **Semantic Web Compatible**: Full RDF representation following W3C standards
- **Linked Data**: Proper use of vocabularies and ontologies
- **SPARQL Ready**: Output can be used with SPARQL queries and RDF databases
- **Interoperability**: Standard RDF format for integration with semantic web tools

## Security

- All credentials are stored locally in your browser's localStorage
- No data is transmitted to external servers
- Client-side validation ensures credential format compliance

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).
