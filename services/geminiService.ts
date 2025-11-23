
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Message, Role, GroundingSource, ModelId, ResearchItem, SynthesisMode, GuidanceConfig } from "../types";
import { getSystemInstruction } from "../constants";

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
  modelId: ModelId = 'gemini-2.5-flash',
  userName: string,
  guidance?: GuidanceConfig
): Promise<{ text: string; sources: GroundingSource[] }> => {
  const ai = getClient();
  
  const contents = history.map((msg) => ({
    role: msg.role === Role.USER ? "user" : "model",
    parts: [{ text: msg.text }],
  }));

  contents.push({
    role: "user",
    parts: [{ text: newMessage }],
  });

  const tools = useSearch ? [{ googleSearch: {} }] : [];

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: modelId,
      contents: contents,
      config: {
        systemInstruction: getSystemInstruction(userName, useSearch, guidance),
        tools: tools,
        temperature: 0.7,
      },
    });

    let text = response.text || "I couldn't generate a response.";
    const sources: GroundingSource[] = [];
    
    // Robust Parsing: Extract from [SOURCE_START] block (Primary)
    const sourceBlockRegex = /\[SOURCE_START\]([\s\S]*?)\[SOURCE_END\]/i;
    const match = text.match(sourceBlockRegex);

    if (match) {
      const blockContent = match[1];
      const lines = blockContent.trim().split('\n');
      
      if (lines.length > 0) {
          lines.forEach(line => {
              const urlMatch = line.match(/URL:\s*([^\s|]+)/);
              const titleMatch = line.match(/Title:\s*(.+)$/);
              
              if (urlMatch && urlMatch[1]) {
                  const rawUrl = urlMatch[1].trim();
                  // V4.4: Allow Vertex, only filter NONE
                  if (rawUrl !== 'NONE') {
                      let title = titleMatch ? titleMatch[1].trim() : "Source";
                      sources.push({
                          title: title,
                          uri: rawUrl
                      });
                  }
              }
          });
      }
      // Remove block from visible text
      text = text.replace(sourceBlockRegex, '').trim();
    }

    // Fallback: If no sources parsed from text, try API metadata
    if (sources.length === 0) {
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (chunks) {
          chunks.forEach((chunk: any) => {
            if (chunk.web && chunk.web.uri) {
              sources.push({
                title: chunk.web.title || "Web Source",
                uri: chunk.web.uri,
              });
            }
          });
        }
    }

    return { text, sources };
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const synthesizeNotes = async (
    items: ResearchItem[], 
    mode: SynthesisMode,
    userName: string,
    modelId: ModelId = 'gemini-2.5-flash'
): Promise<string> => {
    const ai = getClient();
    
    let prompt = "";
    const contentBlob = items.map(i => {
        const typeLabel = i.type === 'user_note' ? 'USER NOTE' : i.type === 'question' ? 'QUERY' : 'EVIDENCE';
        const title = i.title ? ` - ${i.title}` : '';
        const source = i.sourceUrl ? ` (Source: ${i.sourceTitle || 'Web Link'} - ${i.sourceUrl})` : '';
        
        return `[ID: #${i.refId}] [${typeLabel}] [Tier: ${i.tier}]${title}${source}
Content: ${i.content}`;
    }).join('\n\n');

    if (mode === 'query') {
        prompt = `
        You are analyzing the investigative logic of ${userName}.
        Below is a list of Queries they asked, indexed by ID.
        Task: Summarize the arc of their inquiry. Reference specific queries using [Ref: #X].
        Queries:
        ${contentBlob}
        `;
    } else if (mode === 'user_note') {
        prompt = `
        You are acting as a ghostwriter for ${userName}.
        Below are their raw notes, indexed by ID.
        Synthesize these into a coherent narrative.
        Rules: Use ONLY the content in these notes. Reference the specific note ID for every point made using [Ref: #X].
        User Notes:
        ${contentBlob}
        `;
    } else {
        prompt = `
        You are an editor for "Generative Lives".
        Synthesize the following Operational Evidence into a structural analysis.
        
        STRICT ANTI-HALLUCINATION PROTOCOLS:
        1. Use ONLY the content provided in the Research Findings below. Do NOT introduce external evidence.
        2. Every claim you make MUST be backed by a specific Reference ID. Append [Ref: #X] to the end of the sentence.
        3. If a note contains a URL or Source, you MUST include a markdown link in the text, ideally formatted as "Title, Date".
        
        Research Findings:
        ${contentBlob}
        `;
    }

    const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
    });

    return response.text || "Could not synthesize findings.";
}
