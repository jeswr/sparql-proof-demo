# LLM Integration for SPARQL Assistant

This document explains how to set up the AI-powered SPARQL Query Assistant with free LLM APIs.

## 🆓 Free LLM Providers (Recommended)

### 1. OpenRouter (Best Overall)
- **Website**: https://openrouter.ai/
- **Free Credits**: $1/month for new users
- **Models**: Llama 3.1, GPT-3.5-Turbo, Gemma 2, and more
- **Pros**: Easy setup, multiple models, good free tier
- **Setup**: 
  1. Sign up at https://openrouter.ai/
  2. Get API key from https://openrouter.ai/keys
  3. Add to `.env.local`: `NEXT_PUBLIC_OPENROUTER_API_KEY=your_key_here`

### 2. Groq (Fastest)
- **Website**: https://console.groq.com/
- **Free Tier**: 100 requests/minute
- **Models**: Llama 3.1, Mixtral, Gemma
- **Pros**: Ultra-fast inference speed
- **Setup**:
  1. Sign up at https://console.groq.com/
  2. Generate API key
  3. Add to `.env.local`: `NEXT_PUBLIC_GROQ_API_KEY=your_key_here`

### 3. Together AI
- **Website**: https://api.together.xyz/
- **Free Credits**: Available for new users
- **Models**: Llama, Mixtral, CodeLlama
- **Setup**:
  1. Sign up at https://api.together.xyz/
  2. Get API key from dashboard
  3. Add to `.env.local`: `NEXT_PUBLIC_TOGETHER_API_KEY=your_key_here`

### 4. Hugging Face
- **Website**: https://huggingface.co/
- **Free Tier**: Rate-limited but completely free
- **Models**: Thousands of open source models
- **Setup**:
  1. Sign up at https://huggingface.co/
  2. Create token at https://huggingface.co/settings/tokens
  3. Add to `.env.local`: `NEXT_PUBLIC_HUGGINGFACE_API_KEY=your_key_here`

## 💰 Paid Providers (Fallback)

The system also supports OpenAI and Anthropic as paid fallback options if you have existing accounts.

## 🔧 Quick Setup

1. **Choose a provider** from the free options above
2. **Sign up** for a free account
3. **Get your API key** from their dashboard
4. **Create `.env.local`** file in the project root:
   ```bash
   # Example with Groq (replace with your chosen provider)
   NEXT_PUBLIC_GROQ_API_KEY=gsk_your_actual_key_here
   ```
5. **Restart** your development server: `npm run dev`

## 🔄 Provider Fallback System

The system automatically tries providers in this order:
1. **OpenRouter** (if key available)
2. **Groq** (if key available)
3. **Together AI** (if key available)
4. **Hugging Face** (if key available)
5. **OpenAI** (if key available)
6. **Anthropic** (if key available)
7. **Fallback mode** (basic templates)

This ensures maximum reliability - if one provider is down, it automatically tries the next one.

## 🎯 Recommended Setup

For the best experience, we recommend:

1. **Primary**: OpenRouter (great free tier, multiple models)
2. **Backup**: Groq (fast responses)
3. **Development**: Any free provider works fine

## 🔒 Security Notes

- Use `NEXT_PUBLIC_` prefix for client-side access (development)
- Use non-prefixed keys for server-side only (production)
- Never commit API keys to version control
- Each provider has different rate limits and usage policies

## 🐛 Troubleshooting

### Assistant shows "Fallback Mode"
- Check if your API key is correctly set in `.env.local`
- Verify the key format matches the provider's requirements
- Restart your development server after adding the key

### API Errors
- Check your provider's dashboard for usage limits
- Verify your account has remaining credits/quota
- Try a different provider from the list

### No Response from Assistant
- Check browser console for error messages
- Verify your internet connection
- Try refreshing the page

## 📊 Provider Comparison

| Provider | Free Tier | Speed | Models | Setup Difficulty |
|----------|-----------|-------|---------|------------------|
| OpenRouter | $1/month | Fast | Many | Easy |
| Groq | 100 req/min | Ultra-fast | Good | Easy |
| Together AI | Credits | Fast | Good | Easy |
| Hugging Face | Rate-limited | Slow | Many | Easy |

## 🚀 Advanced Configuration

You can customize the models used by each provider by editing `src/utils/llmUtils.ts`. Each provider function allows you to change the model parameter to use different models available on that platform.

For example, with OpenRouter you could use:
- `meta-llama/llama-3.1-8b-instruct:free` (default)
- `google/gemma-2-9b-it:free`
- `microsoft/wizardlm-2-8x22b:free`

Check each provider's documentation for available models and pricing.
