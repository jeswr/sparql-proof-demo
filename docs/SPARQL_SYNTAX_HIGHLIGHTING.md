# SPARQL Syntax Highlighting

The SPARQL Query Interface now includes professional syntax highlighting powered by Monaco Editor (the same editor that powers VS Code).

## Features

### 🎨 Syntax Highlighting
- **Keywords**: SELECT, WHERE, PREFIX, FILTER, etc. are highlighted in blue/purple
- **Variables**: ?name, ?person, etc. are highlighted in bold blue/cyan  
- **URIs**: <http://schema.org/name> are highlighted in green
- **Prefixes**: schema:, cred:, etc. are highlighted in teal
- **Strings**: "literal values" are highlighted in orange/red
- **Comments**: # comments are highlighted in gray
- **Numbers**: 123, 45.67 are highlighted appropriately

### 🚀 Enhanced Editing Experience
- **Line Numbers**: Easy navigation with line numbers
- **Code Folding**: Collapse/expand code blocks
- **Auto-completion**: Intelligent suggestions for SPARQL keywords and common prefixes
- **Word Wrap**: Long lines wrap for better readability
- **Bracket Matching**: Automatic matching of brackets and parentheses

### 🌙 Dark Mode Support
- **Perfect Theme Matching**: Editor background now perfectly matches the website's dark gray-700 theme
- **Consistent Colors**: All UI elements (borders, backgrounds, text) match the site's design system
- **Automatic Switching**: Follows your system/browser preference seamlessly
- **Custom Color Scheme**: 
  - **Dark Mode**: gray-700 background with gray-50 text, matching website theme
  - **Light Mode**: Clean white background with proper contrast
- **Enhanced UX**: Smooth theme transitions and consistent visual experience

### 📝 Auto-completion Features
- **SPARQL Keywords**: SELECT, PREFIX, WHERE, etc.
- **Common Prefixes**: Automatically suggests schema:, cred:, vaccination:
- **Code Snippets**: Quick templates for common query patterns

## Usage

1. **Type naturally**: The editor provides real-time syntax highlighting as you type
2. **Use auto-complete**: Press `Ctrl+Space` (or `Cmd+Space` on Mac) for suggestions
3. **Navigate easily**: Use line numbers and code folding for large queries
4. **Copy/paste**: Works seamlessly with external text editors

## Example

The editor now makes SPARQL queries much more readable:

```sparql
# This comment is clearly visible
PREFIX cred: <https://www.w3.org/2018/credentials#>
PREFIX schema: <http://schema.org/>

SELECT ?name ?type
WHERE {
  ?credential a ?type ;
             cred:credentialSubject ?subject .
  ?subject schema:name ?name .
  FILTER(?type != <http://example.org/UnwantedType>)
}
```

## Technical Details

- **Editor**: Monaco Editor (VS Code's editor)
- **Language**: Custom SPARQL language definition
- **Themes**: Custom light/dark themes optimized for SPARQL
- **Performance**: Lightweight and fast, even for large queries

The syntax highlighting makes it much easier to:
- Spot syntax errors quickly
- Understand query structure at a glance
- Write complex queries with confidence
- Learn SPARQL syntax through visual cues
