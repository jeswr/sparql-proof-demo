# CONSTRUCT Query Support

This document explains how to use CONSTRUCT queries in the SPARQL Proof Demo application.

## Overview

The SPARQL Query Interface now supports both SELECT and CONSTRUCT queries. CONSTRUCT queries allow you to create new RDF data by transforming and combining information from your verifiable credentials.

## How CONSTRUCT Queries Work

CONSTRUCT queries work in a **two-step process**:

1. **SELECT Phase**: The WHERE clause is extracted and executed as a SELECT query to find variable bindings
2. **CONSTRUCT Phase**: Selected result rows are used to instantiate the CONSTRUCT template, generating new RDF triples

## User Interface Features

### Query Results Table with Checkboxes
- When you execute a CONSTRUCT query, the results table displays all variable bindings from the WHERE clause
- Each row has a checkbox that allows you to select which result bindings to include in the final construction
- Use the header checkbox to select/deselect all results at once
- Selected rows are highlighted in blue

### CONSTRUCT Controls
- Below the results table, you'll see a blue panel showing how many results are selected
- Click "Execute CONSTRUCT" to generate RDF from the selected bindings
- The button is disabled if no results are selected

### CONSTRUCT Result Display
- The constructed RDF is displayed in a Monaco code editor with Turtle syntax highlighting
- The output uses the pretty-turtle formatter for readable, well-formatted RDF
- Click "Copy" to copy the result to your clipboard

## Sample CONSTRUCT Queries

The interface includes several sample CONSTRUCT queries:

### 1. Construct Identity Profile
Creates a minimal identity profile from credentials:

```sparql
PREFIX schema: <http://schema.org/>
PREFIX citizenship: <https://w3id.org/citizenship#>
PREFIX derived: <https://example.org/derived/>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>

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

### 2. Construct Age Verification
Creates age verification statements:

```sparql
PREFIX schema: <http://schema.org/>
PREFIX citizenship: <https://w3id.org/citizenship#>
PREFIX derived: <https://example.org/derived/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

CONSTRUCT {
  ?ageVerification a derived:AgeVerification ;
                   derived:subject ?subject ;
                   derived:isAdult ?isAdult ;
                   derived:verifiedAt ?now .
}
WHERE {
  ?subject schema:birthDate|citizenship:birthDate ?birthDate .
  BIND((xsd:date(?birthDate) < xsd:date("2006-01-26")) AS ?isAdult)
  BIND(NOW() AS ?now)
  BIND(IRI(CONCAT("https://example.org/derived/age-verification/", ENCODE_FOR_URI(STR(?subject)))) AS ?ageVerification)
  FILTER(BOUND(?isAdult))
}
```

### 3. Construct Vaccination Summary
Creates a vaccination summary from vaccination credentials:

```sparql
PREFIX vaccination: <https://w3id.org/vaccination#>
PREFIX schema: <http://schema.org/>
PREFIX derived: <https://example.org/derived/>

CONSTRUCT {
  ?summary a derived:VaccinationSummary ;
           derived:recipient ?recipient ;
           derived:hasVaccination ?vaccine ;
           derived:vaccinationDate ?date .
}
WHERE {
  ?credential vaccination:recipient ?recipient .
  ?credential vaccination:vaccine ?vaccine .
  OPTIONAL { ?credential vaccination:occurrence ?date }
  BIND(IRI(CONCAT("https://example.org/derived/vaccination-summary/", ENCODE_FOR_URI(STR(?recipient)))) AS ?summary)
}
```

## Workflow Example

1. **Load a CONSTRUCT query** (either write your own or use a sample)
2. **Execute the query** - this runs the WHERE clause and shows variable bindings
3. **Select results** - check the boxes for the result rows you want to include
4. **Execute CONSTRUCT** - generates the new RDF using selected bindings
5. **View/Copy result** - the constructed RDF is displayed with syntax highlighting

## Technical Implementation

### Two-Phase Execution
- **Phase 1**: WHERE clause is extracted and executed as `SELECT * WHERE { ... }` 
- **Phase 2**: Selected bindings are substituted into the CONSTRUCT template

### Variable Binding
Variables in the CONSTRUCT template are replaced with their bound values:
- URIs: `?var` → `<http://example.org/value>`
- Literals: `?var` → `"literal value"`
- Blank nodes: `?var` → `_:bnode`

### Pretty-Turtle Formatting
The output is formatted using the `@jeswr/pretty-turtle` package with predefined prefixes:
- `schema:` for Schema.org terms
- `cred:` for W3C Verifiable Credentials
- `derived:` for derived/constructed data
- And many more...

## Use Cases

CONSTRUCT queries are particularly useful for:

- **Privacy-preserving queries**: Create minimal derived credentials without exposing sensitive data
- **Data transformation**: Convert between different vocabularies or data models
- **Aggregation**: Combine information from multiple credentials into summary statements
- **Zero-Knowledge Proofs**: Generate statements that can be proven without revealing underlying data

## Monaco Editor Features

The CONSTRUCT result editor includes:
- **Syntax highlighting** for Turtle/RDF
- **Dark/light theme** support that follows system preferences
- **Read-only mode** to prevent accidental edits
- **Copy functionality** for easy result sharing
- **Line numbers** and **folding** for large results

## Error Handling

- Invalid CONSTRUCT syntax is detected and reported
- Missing variable bindings are handled gracefully
- Network/execution errors show helpful error messages
- Malformed RDF construction is caught and logged

## Next Steps

This implementation provides the foundation for:
- Integration with Zero-Knowledge Proof systems
- Export of constructed RDF as new verifiable credentials
- Advanced query optimization and caching
- Real-time collaborative query building

## Troubleshooting

For common issues and their solutions, see the [CONSTRUCT Query Troubleshooting Guide](./CONSTRUCT_TROUBLESHOOTING.md).

Common issues include:
- "Unknown prefix" errors when executing CONSTRUCT queries
- Empty CONSTRUCT results
- Syntax errors in CONSTRUCT templates
- Performance issues with large result sets
