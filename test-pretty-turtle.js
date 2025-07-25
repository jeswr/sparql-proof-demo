const { write } = require('@jeswr/pretty-turtle');
const jsonld = require('jsonld');
const { Parser, Store } = require('n3');

async function testPrettyTurtle() {
  // Sample credential (simplified)
  const credential = {
    "@context": [
      "https://www.w3.org/2018/credentials/v1",
      "https://w3id.org/citizenship/v1"
    ],
    "id": "https://example.edu/credentials/58473",
    "type": ["VerifiableCredential", "PermanentResidentCard"],
    "issuer": "https://example.gov",
    "issuanceDate": "2023-01-01T12:00:00Z",
    "credentialSubject": {
      "id": "did:example:ebfeb1f712ebc6f1c276e12ec21",
      "type": ["PermanentResident", "Person"],
      "givenName": "John",
      "familyName": "Doe"
    }
  };

  try {
    console.log('Converting JSON-LD to N-Quads...');
    const nquads = await jsonld.toRDF(credential, { format: 'application/n-quads' });
    console.log('N-Quads:', nquads.substring(0, 200) + '...');

    console.log('\nParsing N-Quads...');
    const parser = new Parser({ format: 'N-Quads' });
    const store = new Store();
    
    const quads = [];
    
    parser.parse(nquads, (error, quad, prefixes) => {
      if (error) {
        console.error('Parse error:', error);
        return;
      }
      
      if (quad) {
        quads.push(quad);
        store.addQuad(quad);
      } else {
        // Parsing complete
        testFormatting();
      }
    });

    async function testFormatting() {
      console.log(`\nFound ${quads.length} quads`);
      
      const prefixMap = {
        'cred': 'https://www.w3.org/2018/credentials#',
        'citizenship': 'https://w3id.org/citizenship#',
        'xsd': 'http://www.w3.org/2001/XMLSchema#',
        'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        'schema': 'http://schema.org/'
      };

      try {
        console.log('\nUsing pretty-turtle...');
        const prettyResult = await write(quads, { prefixes: prefixMap });
        console.log('Pretty-turtle result:');
        console.log(prettyResult);
      } catch (prettyError) {
        console.error('Pretty-turtle error:', prettyError.message);
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testPrettyTurtle();
