# CONSTRUCT Query Troubleshooting Guide

## Common Issues and Solutions

### Issue: "Unknown prefix" error when executing CONSTRUCT queries

**Problem**: When executing a CONSTRUCT query like:
```sparql
PREFIX schema: <http://schema.org/>
PREFIX citizenship: <https://w3id.org/citizenship#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

CONSTRUCT {
  ?subject a citizenship:Adult ;
           citizenship:isAdult ?isAdult .
} WHERE {
  ?subject schema:birthDate|citizenship:birthDate ?birthDate .
  BIND((xsd:date(?birthDate) < xsd:date("2007-07-26")) AS ?isAdult)
  FILTER(BOUND(?isAdult) && ?isAdult)
}
```

You get an error: "SPARQL query failed: Unknown prefix: schema"

**Root Cause**: The CONSTRUCT query execution works in two phases:
1. Extract the WHERE clause and execute as a SELECT query
2. Use the results to execute the CONSTRUCT template

The issue was that the PREFIX declarations were not being preserved when extracting the WHERE clause for the SELECT query.

**Solution**: Updated the `extractWhereClause` function to preserve PREFIX declarations:

```typescript
const extractWhereClause = (constructQuery: string): string => {
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
```

**Status**: ✅ **FIXED** - This issue has been resolved in the current implementation.

### Issue: Variables not properly bound in CONSTRUCT template

**Problem**: Variables in the CONSTRUCT template are not being replaced with their bound values.

**Solution**: The `bindVariablesInConstructQuery` function handles this correctly:
- URIs: `?var` → `<http://example.org/value>`
- Literals: `?var` → `"literal value"`  
- Blank nodes: `?var` → `_:bnode`

### Issue: Empty CONSTRUCT result

**Problem**: CONSTRUCT query executes but returns empty RDF.

**Possible Causes**:
1. **No results selected**: Make sure to select at least one row in the results table
2. **No matching data**: The WHERE clause doesn't match any data in your credentials
3. **Filter conditions too restrictive**: Check your FILTER clauses

**Debugging Steps**:
1. First run the query to see the SELECT results
2. Verify you have matching data by examining the results table
3. Select the appropriate rows and then execute CONSTRUCT
4. Check the browser console for any error messages

### Issue: Syntax errors in CONSTRUCT queries

**Common Syntax Issues**:

1. **Missing dot after CONSTRUCT pattern**:
   ```sparql
   CONSTRUCT {
     ?s ?p ?o .  # ← Don't forget the dot!
   }
   ```

2. **Incorrect prefix declarations**:
   ```sparql
   PREFIX schema: <http://schema.org/>  # ← Correct
   PREFIX schema <http://schema.org/>   # ← Missing colon (incorrect)
   ```

3. **Malformed URIs in CONSTRUCT template**:
   ```sparql
   CONSTRUCT {
     ?person a foaf:Person ;
             foaf:name ?name .  # ← Correct
   }
   ```

### Issue: Performance problems with large result sets

**Problem**: CONSTRUCT queries are slow with many results.

**Solutions**:
1. **Limit results**: Add `LIMIT` clause to your WHERE clause
2. **Filter early**: Use `FILTER` conditions to reduce result set
3. **Select specific rows**: Don't select all results if you only need a subset

**Example**:
```sparql
CONSTRUCT {
  ?person a foaf:Person ;
          foaf:name ?name .
}
WHERE {
  ?person foaf:name ?name .
  FILTER(STRLEN(?name) > 3)
}
LIMIT 10
```

## Best Practices

### 1. Always include PREFIX declarations
Make sure all prefixes used in both CONSTRUCT and WHERE clauses are declared:

```sparql
PREFIX schema: <http://schema.org/>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX derived: <https://example.org/derived/>

CONSTRUCT {
  ?person a foaf:Person ;
          derived:hasName ?name .
}
WHERE {
  ?subject schema:name ?name .
  BIND(IRI(CONCAT("https://example.org/person/", ENCODE_FOR_URI(?name))) AS ?person)
}
```

### 2. Use meaningful URIs in CONSTRUCT templates
Generate meaningful URIs using `BIND` and `CONCAT`:

```sparql
BIND(IRI(CONCAT("https://example.org/derived/person/", ENCODE_FOR_URI(?givenName), "-", ENCODE_FOR_URI(?familyName))) AS ?person)
```

### 3. Test with SELECT first
Before writing a complex CONSTRUCT query, test the WHERE clause with a SELECT:

```sparql
# Test first with SELECT
SELECT ?subject ?birthDate ?isAdult WHERE {
  ?subject schema:birthDate|citizenship:birthDate ?birthDate .
  BIND((xsd:date(?birthDate) < xsd:date("2007-07-26")) AS ?isAdult)
  FILTER(BOUND(?isAdult) && ?isAdult)
}

# Then convert to CONSTRUCT
CONSTRUCT {
  ?subject a citizenship:Adult ;
           citizenship:isAdult ?isAdult .
} WHERE {
  # Same WHERE clause as above
}
```

### 4. Handle optional data gracefully
Use `OPTIONAL` for data that might not be present:

```sparql
CONSTRUCT {
  ?person a foaf:Person ;
          foaf:givenName ?givenName ;
          foaf:familyName ?familyName ;
          schema:birthDate ?birthDate .
}
WHERE {
  ?subject schema:givenName|citizenship:givenName ?givenName .
  ?subject schema:familyName|citizenship:familyName ?familyName .
  OPTIONAL { ?subject schema:birthDate|citizenship:birthDate ?birthDate }
  BIND(IRI(CONCAT("https://example.org/derived/person/", ENCODE_FOR_URI(?givenName), "-", ENCODE_FOR_URI(?familyName))) AS ?person)
}
```

## Getting Help

If you encounter issues not covered here:

1. **Check the browser console** for detailed error messages
2. **Verify your credentials** contain the expected data by viewing the RDF tab
3. **Test with simpler queries** first, then add complexity
4. **Use the SPARQL Assistant** for help with query syntax
5. **Check the sample queries** for working examples

## Implementation Details

The CONSTRUCT query execution process:

1. **Parse the query** using sparqlalgebrajs to validate syntax
2. **Extract WHERE clause** with preserved PREFIX declarations  
3. **Execute as SELECT** to get variable bindings
4. **Display results table** with checkboxes for selection
5. **Bind variables** in the CONSTRUCT template for selected rows
6. **Execute CONSTRUCT** using Comunica query engine
7. **Format output** using pretty-turtle for readable display

This two-phase approach allows for selective construction while maintaining full SPARQL compatibility.
