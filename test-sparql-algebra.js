const { translate } = require('sparqlalgebrajs');

// Test the SPARQL algebra parsing
const testQuery = `PREFIX schema: <http://schema.org/>
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
}`;

try {
  console.log('Testing SPARQL algebra parsing...');
  const algebra = translate(testQuery);
  
  console.log('Query type:', algebra.type);
  console.log('Is project (SELECT) query:', algebra.type === 'project');
  
  if (algebra.type === 'project') {
    console.log('Variables:', algebra.variables.map(v => v.value));
  }
  
  console.log('✅ SPARQL algebra parsing successful!');
} catch (error) {
  console.error('❌ SPARQL algebra parsing failed:', error.message);
}
