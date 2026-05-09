// Embedding generation via OpenAI text-embedding-3-small
import OpenAI from "openai";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) throw new Error("[memory] OPENAI_API_KEY is not set");
  _client = new OpenAI({ apiKey });
  return _client;
}

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

export async function embedText(text: string): Promise<number[]> {
  const client = getClient();
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8191), // API token limit
    dimensions: EMBEDDING_DIMENSIONS,
  });
  return response.data[0]!.embedding;
}

export function vectorToSql(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
