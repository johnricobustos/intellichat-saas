import { invokeLLM, type Message } from "./_core/llm";
import { getChunksByOrg, getQaPairsByOrg, incrementQaMatchCount } from "./db";

// ==================== TEXT CHUNKING ====================
export function chunkText(text: string, maxChunkSize = 500, overlap = 50): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let currentChunk = "";
  let wordCount = 0;

  for (const sentence of sentences) {
    const sentenceWords = sentence.split(/\s+/).length;
    if (wordCount + sentenceWords > maxChunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      // Keep overlap
      const words = currentChunk.split(/\s+/);
      currentChunk = words.slice(-overlap).join(" ") + " " + sentence;
      wordCount = overlap + sentenceWords;
    } else {
      currentChunk += (currentChunk ? " " : "") + sentence;
      wordCount += sentenceWords;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  // If no sentence breaks, split by word count
  if (chunks.length === 0 && text.trim()) {
    const words = text.split(/\s+/);
    for (let i = 0; i < words.length; i += maxChunkSize - overlap) {
      chunks.push(words.slice(i, i + maxChunkSize).join(" "));
    }
  }

  return chunks;
}

// ==================== EMBEDDING GENERATION ====================
export async function generateEmbedding(text: string): Promise<number[]> {
  // Use LLM to generate a simple embedding via a structured response
  // We'll use a hash-based approach for similarity since we don't have a dedicated embeddings API
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "You are an embedding generator. Given text, output a JSON array of 64 floating point numbers between -1 and 1 that represent the semantic meaning of the text. Different texts with similar meanings should have similar arrays. Output ONLY the JSON array, nothing else."
      },
      { role: "user", content: text.slice(0, 500) }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "embedding",
        strict: true,
        schema: {
          type: "object",
          properties: {
            vector: {
              type: "array",
              items: { type: "number" }
            }
          },
          required: ["vector"],
          additionalProperties: false
        }
      }
    }
  });

  try {
    const content = response.choices[0]?.message?.content;
    if (content && typeof content === "string") {
      const parsed = JSON.parse(content);
      return parsed.vector || [];
    }
  } catch (e) {
    // Fallback: simple hash-based embedding
    return simpleHashEmbedding(text);
  }
  return simpleHashEmbedding(text);
}

// Simple fallback embedding using text hashing
function simpleHashEmbedding(text: string): number[] {
  const vector: number[] = [];
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const words = normalized.split(/\s+/);

  for (let i = 0; i < 64; i++) {
    let sum = 0;
    for (let j = 0; j < words.length; j++) {
      const word = words[j];
      for (let k = 0; k < word.length; k++) {
        sum += word.charCodeAt(k) * (i + 1) * (j + 1) * (k + 1);
      }
    }
    vector.push(Math.sin(sum) * 0.5 + Math.cos(sum * 0.7) * 0.5);
  }
  return vector;
}

// ==================== COSINE SIMILARITY ====================
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

// ==================== SEMANTIC SEARCH ====================
export async function searchRelevantChunks(orgId: number, query: string, topK = 5) {
  const queryEmbedding = await generateEmbedding(query);
  const allChunks = await getChunksByOrg(orgId);

  const scored = allChunks.map(chunk => {
    const chunkEmbedding = chunk.embedding as number[] | null;
    const similarity = chunkEmbedding ? cosineSimilarity(queryEmbedding, chunkEmbedding) : 0;
    return { ...chunk, similarity };
  });

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, topK);
}

// ==================== Q&A MATCHING ====================
export async function findMatchingQaPair(orgId: number, query: string) {
  const pairs = await getQaPairsByOrg(orgId);
  const activePairs = pairs.filter(p => p.isActive);
  const normalizedQuery = query.toLowerCase().trim();

  // Exact match
  for (const pair of activePairs) {
    const pairQuestion = (pair.question as string).toLowerCase().trim();
    if (normalizedQuery === pairQuestion) {
      await incrementQaMatchCount(pair.id);
      return pair;
    }
  }

  // Fuzzy match: check if query contains the question or vice versa
  for (const pair of activePairs) {
    const pairQuestion = (pair.question as string).toLowerCase().trim();
    const queryWords = normalizedQuery.split(/\s+/);
    const pairWords = pairQuestion.split(/\s+/);

    // Calculate word overlap
    const commonWords = queryWords.filter(w => pairWords.includes(w));
    const similarity = commonWords.length / Math.max(queryWords.length, pairWords.length);

    if (similarity > 0.7) {
      await incrementQaMatchCount(pair.id);
      return pair;
    }
  }

  return null;
}

// ==================== RAG CHAT ====================
export interface ChatContext {
  orgId: number;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  botPersonality: string;
  botName: string;
}

export interface ChatResponse {
  answer: string;
  confidence: number;
  sourceDocs: number[];
  wasQaMatch: boolean;
}

export async function generateChatResponse(
  query: string,
  context: ChatContext
): Promise<ChatResponse> {
  // Step 1: Check Q&A pairs first
  const qaPairMatch = await findMatchingQaPair(context.orgId, query);
  if (qaPairMatch) {
    return {
      answer: qaPairMatch.answer as string,
      confidence: 1.0,
      sourceDocs: [],
      wasQaMatch: true,
    };
  }

  // Step 2: Retrieve relevant document chunks
  const relevantChunks = await searchRelevantChunks(context.orgId, query, 5);
  const hasRelevantContext = relevantChunks.length > 0 && relevantChunks[0].similarity > 0.3;

  // Step 3: Build context from chunks
  const documentContext = hasRelevantContext
    ? relevantChunks
        .filter(c => c.similarity > 0.3)
        .map((c, i) => `[Source ${i + 1}]: ${c.content}`)
        .join("\n\n")
    : "";

  // Step 4: Build conversation messages
  const systemPrompt = `${context.botPersonality || "You are a helpful customer support assistant."}

Your name is ${context.botName || "AI Assistant"}.

RULES:
- Only answer questions based on the provided context/documents.
- If the context doesn't contain relevant information to answer the question, say: "I don't have enough information to answer that question. Would you like me to connect you with a human agent?"
- Be concise and helpful.
- Do not make up information that isn't in the provided context.
- If you're unsure, express your uncertainty.

${documentContext ? `KNOWLEDGE BASE CONTEXT:\n${documentContext}` : "No relevant documents found in the knowledge base."}`;

  const chatMessages: Message[] = [
    { role: "system", content: systemPrompt },
    ...context.conversationHistory.slice(-6).map(m => ({ role: m.role as "user" | "assistant", content: m.content } as Message)),
    { role: "user", content: query } as Message,
  ];

  // Step 5: Generate response
  const response = await invokeLLM({ messages: chatMessages });
  const rawContent = response.choices[0]?.message?.content;
  const answer: string = typeof rawContent === "string" ? rawContent : (rawContent ? JSON.stringify(rawContent) : "I'm sorry, I couldn't generate a response. Please try again.");

  // Step 6: Estimate confidence
  let confidence = 0.5;
  if (hasRelevantContext) {
    confidence = Math.min(0.95, relevantChunks[0].similarity + 0.3);
  }
  if (answer.includes("don't have enough information") || answer.includes("I'm not sure") || answer.includes("cannot find")) {
    confidence = 0.2;
  }

  return {
    answer,
    confidence,
    sourceDocs: relevantChunks.filter(c => c.similarity > 0.3).map(c => c.id),
    wasQaMatch: false,
  };
}

// ==================== DOCUMENT PROCESSING ====================
export async function processDocumentText(text: string): Promise<Array<{ content: string; embedding: number[]; tokenCount: number }>> {
  const chunks = chunkText(text);
  const processed: Array<{ content: string; embedding: number[]; tokenCount: number }> = [];

  for (const chunk of chunks) {
    const embedding = await generateEmbedding(chunk);
    const tokenCount = chunk.split(/\s+/).length;
    processed.push({ content: chunk, embedding, tokenCount });
  }

  return processed;
}
