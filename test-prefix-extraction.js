// Test script to verify PREFIX extraction from CONSTRUCT queries
// Run with: node test-prefix-extraction.js

const extractWhereClause = (constructQuery) => {
  // Extract PREFIX declarations
  const prefixMatches = constructQuery.match(/PREFIX\s+\w+:\s*<[^>]+>\s*/gi) || [];
  const prefixes = prefixMatches.join('\n');
  
  // Extract WHERE clause
  const whereMatch = constructQuery.match(/WHERE\s*\{([\s\S]*)\}$/i);
  if (whereMatch) {
    return `${prefixes}\n{ ${whereMatch[1]} }`;
  }
  throw new Error('Invalid CONSTRUCT query: WHERE clause not found');
};

// Test case 1: The problematic query from the user
const testQuery1 = `PREFIX schema: <http://schema.org/>
PREFIX citizenship: <https://w3id.org/citizenship#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

CONSTRUCT {
  ?subject a citizenship:Adult ;
           citizenship:isAdult ?isAdult .
} WHERE {
  ?subject schema:birthDate|citizenship:birthDate ?birthDate .
  BIND((xsd:date(?birthDate) < xsd:date("2007-07-26")) AS ?isAdult)
  FILTER(BOUND(?isAdult) && ?isAdult)
}`;

// Test case 2: Complex query with multiple prefixes
const testQuery2 = `PREFIX schema: <http://schema.org/>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX derived: <https://example.org/derived/>

CONSTRUCT {
  ?person a foaf:Person ;
          foaf:name ?name .
}
WHERE {
  ?subject schema:name ?name .
  BIND(IRI(CONCAT("https://example.org/person/", ENCODE_FOR_URI(?name))) AS ?person)
}`;

console.log('=== Test 1: User\'s problematic query ===');
try {
  const result1 = extractWhereClause(testQuery1);
  console.log('✅ SUCCESS: WHERE clause extracted with prefixes');
  console.log('Result:');
  console.log(result1);
  
  // Check that all prefixes are preserved
  const hasSchemaPrefix = result1.includes('PREFIX schema:');
  const hasCitizenshipPrefix = result1.includes('PREFIX citizenship:');
  const hasXsdPrefix = result1.includes('PREFIX xsd:');
  
  console.log(`Schema prefix preserved: ${hasSchemaPrefix ? '✅' : '❌'}`);
  console.log(`Citizenship prefix preserved: ${hasCitizenshipPrefix ? '✅' : '❌'}`);
  console.log(`XSD prefix preserved: ${hasXsdPrefix ? '✅' : '❌'}`);
  
} catch (error) {
  console.log('❌ FAILED:', error.message);
}

console.log('\n=== Test 2: Complex query ===');
try {
  const result2 = extractWhereClause(testQuery2);
  console.log('✅ SUCCESS: WHERE clause extracted with prefixes');
  console.log('Result:');
  console.log(result2);
} catch (error) {
  console.log('❌ FAILED:', error.message);
}

console.log('\n=== Test 3: Query without prefixes ===');
const testQuery3 = `CONSTRUCT {
  ?s ?p ?o .
} WHERE {
  ?s ?p ?o .
}`;

try {
  const result3 = extractWhereClause(testQuery3);
  console.log('✅ SUCCESS: WHERE clause extracted (no prefixes needed)');
  console.log('Result:');
  console.log(result3);
} catch (error) {
  console.log('❌ FAILED:', error.message);
}

console.log('\n=== Summary ===');
console.log('The PREFIX extraction function should now correctly preserve');
console.log('PREFIX declarations when extracting WHERE clauses from CONSTRUCT queries.');
console.log('This fixes the "Unknown prefix" error that was occurring.');
