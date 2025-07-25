import { VerifiableCredential } from '@/types/credential';

interface LLMResponse {
  content: string;
  error?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Calls various free/affordable LLM APIs for SPARQL assistance
 * Supports OpenRouter, Groq, Together AI, and other free providers
 */
export async function callLLMForSPARQLAssistance(
  userMessage: string,
  credentials: VerifiableCredential[],
  rdfData: string,
  chatHistory: ChatMessage[] = []
): Promise<LLMResponse> {
  // Try different providers in order of preference
  const providers = [
    { name: 'OpenRouter', func: callOpenRouterAPI },
    { name: 'Groq', func: callGroqAPI },
    { name: 'Together AI', func: callTogetherAPI },
    { name: 'Hugging Face', func: callHuggingFaceAPI },
    { name: 'OpenAI', func: callOpenAIAPI }
  ];

  for (const provider of providers) {
    try {
      const result = await provider.func(userMessage, credentials, rdfData, chatHistory);
      if (!result.error) {
        return result;
      }
    } catch (error) {
      console.warn(`${provider.name} failed:`, error);
      continue;
    }
  }

  // If all providers fail, return fallback
  return {
    content: generateFallbackResponse(userMessage, credentials),
    error: 'All LLM providers failed. Please check your API keys or try again later.'
  };
}

/**
 * OpenRouter API - Provides access to many models with free tier
 * Get free API key at: https://openrouter.ai/
 */
async function callOpenRouterAPI(
  userMessage: string,
  credentials: VerifiableCredential[],
  rdfData: string,
  chatHistory: ChatMessage[] = []
): Promise<LLMResponse> {
  const apiKey = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    throw new Error('OpenRouter API key not found');
  }

  const systemPrompt = createSPARQLSystemPrompt(credentials, rdfData);
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...chatHistory.slice(-8),
    { role: 'user', content: userMessage }
  ];

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://sparql-proof-demo.vercel.app', // Replace with your domain
      'X-Title': 'SPARQL Proof Demo'
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.1-8b-instruct:free', // Free model
      messages: messages,
      max_tokens: 2000,
      temperature: 0.3,
      top_p: 0.9
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`);
  }

  const data = await response.json();
  
  if (!data.choices?.[0]?.message?.content) {
    throw new Error('Invalid response from OpenRouter API');
  }

  return {
    content: data.choices[0].message.content.trim()
  };
}

/**
 * Groq API - Fast inference with free tier
 * Get free API key at: https://console.groq.com/
 */
async function callGroqAPI(
  userMessage: string,
  credentials: VerifiableCredential[],
  rdfData: string,
  chatHistory: ChatMessage[] = []
): Promise<LLMResponse> {
  const apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY || process.env.GROQ_API_KEY;
  
  if (!apiKey) {
    throw new Error('Groq API key not found');
  }

  const systemPrompt = createSPARQLSystemPrompt(credentials, rdfData);
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...chatHistory.slice(-8),
    { role: 'user', content: userMessage }
  ];

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant', // Fast and free model
      messages: messages,
      max_tokens: 2000,
      temperature: 0.3,
      top_p: 0.9
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Groq API error: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`);
  }

  const data = await response.json();
  
  if (!data.choices?.[0]?.message?.content) {
    throw new Error('Invalid response from Groq API');
  }

  return {
    content: data.choices[0].message.content.trim()
  };
}

/**
 * Together AI - Free tier available
 * Get API key at: https://api.together.xyz/
 */
async function callTogetherAPI(
  userMessage: string,
  credentials: VerifiableCredential[],
  rdfData: string,
  chatHistory: ChatMessage[] = []
): Promise<LLMResponse> {
  const apiKey = process.env.NEXT_PUBLIC_TOGETHER_API_KEY || process.env.TOGETHER_API_KEY;
  
  if (!apiKey) {
    throw new Error('Together AI API key not found');
  }

  const systemPrompt = createSPARQLSystemPrompt(credentials, rdfData);
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...chatHistory.slice(-8),
    { role: 'user', content: userMessage }
  ];

  const response = await fetch('https://api.together.xyz/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', // Free tier model
      messages: messages,
      max_tokens: 2000,
      temperature: 0.3,
      top_p: 0.9
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Together AI API error: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`);
  }

  const data = await response.json();
  
  if (!data.choices?.[0]?.message?.content) {
    throw new Error('Invalid response from Together AI API');
  }

  return {
    content: data.choices[0].message.content.trim()
  };
}

/**
 * Hugging Face Inference API - Free tier available
 * Get API key at: https://huggingface.co/settings/tokens
 */
async function callHuggingFaceAPI(
  userMessage: string,
  credentials: VerifiableCredential[],
  rdfData: string,
  chatHistory: ChatMessage[] = []
): Promise<LLMResponse> {
  const apiKey = process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY || process.env.HUGGINGFACE_API_KEY;
  
  if (!apiKey) {
    throw new Error('Hugging Face API key not found');
  }

  const systemPrompt = createSPARQLSystemPrompt(credentials, rdfData);
  
  // Build conversation for Hugging Face format
  let conversation = `${systemPrompt}\n\n`;
  chatHistory.slice(-6).forEach(msg => {
    conversation += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n\n`;
  });
  conversation += `User: ${userMessage}\nAssistant:`;

  const response = await fetch('https://api-inference.huggingface.co/models/microsoft/DialoGPT-large', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      inputs: conversation,
      parameters: {
        max_new_tokens: 1000,
        temperature: 0.3,
        top_p: 0.9,
        repetition_penalty: 1.1
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Hugging Face API error: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`);
  }

  const data = await response.json();
  
  if (!data[0]?.generated_text) {
    throw new Error('Invalid response from Hugging Face API');
  }

  // Extract only the new response part
  const fullText = data[0].generated_text;
  const assistantResponse = fullText.split('Assistant:').pop()?.trim() || fullText;

  return {
    content: assistantResponse
  };
}

/**
 * OpenAI API - Fallback option (paid)
 */
async function callOpenAIAPI(
  userMessage: string,
  credentials: VerifiableCredential[],
  rdfData: string,
  chatHistory: ChatMessage[] = []
): Promise<LLMResponse> {
  const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OpenAI API key not found');
  }

  const systemPrompt = createSPARQLSystemPrompt(credentials, rdfData);
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...chatHistory.slice(-10),
    { role: 'user', content: userMessage }
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: messages,
      max_tokens: 2000,
      temperature: 0.3,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`);
  }

  const data = await response.json();
  
  if (!data.choices?.[0]?.message?.content) {
    throw new Error('Invalid response from OpenAI API');
  }

  return {
    content: data.choices[0].message.content.trim()
  };
}

/**
 * Creates a comprehensive system prompt for SPARQL assistance
 */
function createSPARQLSystemPrompt(credentials: VerifiableCredential[], rdfData: string): string {
  const credentialTypes = credentials.map(c => 
    c.type ? (Array.isArray(c.type) ? c.type.join(', ') : c.type) : 'Unknown type'
  ).join('\n- ');

  const commonPrefixes = `PREFIX cred: <https://www.w3.org/2018/credentials#>
PREFIX schema: <http://schema.org/>
PREFIX vaccination: <https://w3id.org/vaccination#>
PREFIX exampleEx: <https://example.org/examples#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX sec: <https://w3id.org/security#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>`;

  return `You are an expert SPARQL query assistant specializing in Verifiable Credentials and RDF data. Your role is to help users write, understand, and optimize SPARQL queries for their credential data.

**Available Credentials:**
The user has ${credentials.length} credential(s) with the following types:
- ${credentialTypes}

**Common Prefixes (ALWAYS include these in your queries):**
${commonPrefixes}

**Current RDF Data Structure:**
${rdfData ? `\`\`\`turtle\n${rdfData.slice(0, 1500)}${rdfData.length > 1500 ? '\n...(truncated)' : ''}\n\`\`\`` : 'No RDF data available'}

**Guidelines:**
1. ALWAYS include proper PREFIX declarations in your SPARQL queries
2. Only generate SELECT queries (other query types are not supported)
3. Use the actual RDF data structure visible above to create accurate queries
4. Provide clear explanations with your queries
5. Include practical examples that work with the user's specific data
6. When suggesting queries, ensure they will return meaningful results
7. Focus on common use cases: name queries, age verification, credential validation, etc.
8. Be helpful and educational - explain SPARQL concepts when relevant

**Response Format:**
- Provide clear, working SPARQL queries in code blocks
- Include explanations of what each query does
- Suggest variations or related queries when appropriate
- Always validate that your queries match the available RDF data structure

Remember: The user needs practical, working queries that will execute successfully against their specific credential data.`;
}

/**
 * Generates a fallback response when the LLM API is unavailable
 */
function generateFallbackResponse(userMessage: string, credentials: VerifiableCredential[]): string {
  const input = userMessage.toLowerCase();
  
  const commonPrefixes = `PREFIX cred: <https://www.w3.org/2018/credentials#>
PREFIX schema: <http://schema.org/>
PREFIX vaccination: <https://w3id.org/vaccination#>
PREFIX exampleEx: <https://example.org/examples#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX sec: <https://w3id.org/security#>

`;

  if (input.includes('name') || input.includes('person')) {
    return `Here's a basic query to get names from your credentials:

\`\`\`sparql
${commonPrefixes}SELECT ?name
WHERE {
  ?subject schema:name ?name .
}
\`\`\`

This query finds all names in your credential data using the schema.org name property.`;
  }

  if (input.includes('help') || input.includes('how')) {
    return `I can help you write SPARQL queries for your ${credentials.length} credential${credentials.length !== 1 ? 's' : ''}!

**Basic Query Structure:**
\`\`\`sparql
${commonPrefixes}SELECT ?variable
WHERE {
  ?subject ?predicate ?variable .
}
\`\`\`

**Note:** The AI assistant is currently unavailable, but I can provide basic query templates. Try asking about specific types of data like "names", "vaccination", or "degrees".`;
  }

  return `I can help with SPARQL queries, but the AI assistant is currently unavailable. Here's a basic query template:

\`\`\`sparql
${commonPrefixes}SELECT ?name ?type
WHERE {
  ?credential a ?type ;
             cred:credentialSubject ?subject .
  ?subject schema:name ?name .
}
\`\`\`

Try asking about specific data types like names, vaccinations, or degrees for more targeted help.`;
}

/**
 * Validates environment setup for LLM APIs
 */
export function validateLLMConfiguration(): { isConfigured: boolean; provider?: string; error?: string } {
  // Check for free/affordable providers first
  const openRouterKey = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
  const groqKey = process.env.NEXT_PUBLIC_GROQ_API_KEY || process.env.GROQ_API_KEY;
  const togetherKey = process.env.NEXT_PUBLIC_TOGETHER_API_KEY || process.env.TOGETHER_API_KEY;
  const huggingFaceKey = process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY || process.env.HUGGINGFACE_API_KEY;
  
  // Check for paid providers as fallback
  const openaiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
  
  if (openRouterKey) {
    return { isConfigured: true, provider: 'OpenRouter (Free)' };
  }
  
  if (groqKey) {
    return { isConfigured: true, provider: 'Groq (Free)' };
  }
  
  if (togetherKey) {
    return { isConfigured: true, provider: 'Together AI (Free)' };
  }
  
  if (huggingFaceKey) {
    return { isConfigured: true, provider: 'Hugging Face (Free)' };
  }
  
  if (openaiKey) {
    return { isConfigured: true, provider: 'OpenAI (Paid)' };
  }
  
  if (anthropicKey) {
    return { isConfigured: true, provider: 'Anthropic (Paid)' };
  }
  
  return {
    isConfigured: false,
    error: 'No LLM API key found. For free options, try OpenRouter, Groq, Together AI, or Hugging Face. See .env.example for setup instructions.'
  };
}
