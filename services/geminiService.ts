import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Message, Role, GroundingSource, ModelId } from "../types";
import { SYSTEM_INSTRUCTION } from "../constants";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY environment variable is missing");
  }
  return new GoogleGenAI({ apiKey });
};

export const sendMessageToGemini = async (
  history: Message[],
  newMessage: string,
  useSearch: boolean,
  modelId: ModelId = 'gemini-2.5-flash'
): Promise<{ text: string; sources: GroundingSource[] }> => {
  const ai = getClient();
  
  // Prepare history for the API
  // We filter out local UI-only fields and ensure roles are correct
  const contents = history.map((msg) => ({
    role: msg.role === Role.USER ? "user" : "model",
    parts: [{ text: msg.text }],
  }));

  // Add the new message
  contents.push({
    role: "user",
    parts: [{ text: newMessage }],
  });

  // Auto-enable search if a URL is detected in the prompt to allow "reading" the link
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const containsUrl = urlRegex.test(newMessage);

  const tools = (useSearch || containsUrl) ? [{ googleSearch: {} }] : [];

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: modelId,
      contents: contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: tools,
        temperature: 0.7, // Balance creativity with factual grounding
      },
    });

    const text = response.text || "I couldn't generate a response.";
    
    // Extract grounding chunks if available
    const sources: GroundingSource[] = [];
    
    // Check for grounding metadata
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web) {
          sources.push({
            title: chunk.web.title || "Web Source",
            uri: chunk.web.uri,
          });
        }
      });
    }

    return { text, sources };
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const synthesizeNotes = async (notes: string[], modelId: ModelId = 'gemini-2.5-flash'): Promise<string> => {
    const ai = getClient();
    const prompt = `
    You are an editor for the "Generative Lives" Substack. 
    Synthesize the following research notes into a coherent argument structure for the article.
    
    Focus specifically on the "Hollowing Out" thesis: Is the training pipeline breaking?
    
    Organize the synthesis by:
    1. **The Associate Dilemma:** (Entry level automation vs training needs)
    2. **The Hollow Middle:** (Risks to Experienced/Manager roles)
    3. **The Partner Shift:** (Changes in executive leverage and liability)
    
    Research Notes:
    ${notes.join('\n- ')}
    `;

    const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
    });

    return response.text || "Could not synthesize notes.";
}