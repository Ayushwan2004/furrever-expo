// services/chatbotService.ts
import { GROQ_API_KEY, CHAT_API_URL, CHAT_MODEL } from '../config/chatbot';

// services/chatbotService.ts
export interface ConversationMessage {
  role: 'user' | 'assistant'; // No 'model' here, Groq uses 'assistant'
  content: string;            // No 'parts' here, Groq uses 'content'
}

const BELLA_SYSTEM_PROMPT = `
You are Bella 🐾 — a friendly, expert AI pet companion. 

STRICT RULES:
1. Solutions: When asked about pet health, recipes, or training, give a practical solution in exactly 2-3 sentences.
2. Bold Formatting: You MUST use **bold text** for all key instructions, food items, or medicines (e.g., "**chicken and rice**", "**vet visit**").
3. Length: Keep responses under 80 words. Be punchy and GenZ casual ("ngl", "fr").
4. Completion: Never leave a sentence unfinished.
5. Vet Warning: For sickness, give a tip but end with: "but fr, book that **vet appt** 🐾"

If the user greets you (Hi/Hello), reply: "**Hi Hooman! Woof!** 🐾 How are your furry friends?"
If asked anything non-pet related, reply: "Hey Hooman, I only know about animal friends! Ask me about pets 🐾✨"
`;

export const sendMessageToChatbot = async (
  history: ConversationMessage[],
  userMessage: string
): Promise<string> => {
  
  if (!GROQ_API_KEY) throw new Error("Groq API Key is missing!");

  const messages = [
    { role: "system", content: BELLA_SYSTEM_PROMPT },
    ...history,
    { role: "user", content: userMessage }
  ];

  try {
    const response = await fetch(CHAT_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: messages,
        temperature: 0.6,
        max_tokens: 512, // High enough to never cut off
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err?.error?.message || "Connection failed");
    }

    const data = await response.json();
    return data.choices[0].message.content;

  } catch (error) {
    console.error("Chat Service Error:", error);
    throw error;
  }
};