

// config/chatbot.ts
export const GROQ_API_KEY: string = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '';
export const CHAT_MODEL: string = 'llama-3.1-8b-instant';
export const CHAT_API_URL: string = `https://api.groq.com/openai/v1/chat/completions`;
export const CHAT_CONFIG = {
  maxConversationHistory: 8,
};
