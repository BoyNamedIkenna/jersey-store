import { createHash } from "crypto";
import OpenAI from "openai";

export const EMBEDDING_MODEL = "text-embedding-3-small";

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("Set OPENAI_API_KEY in server/.env");
    }
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export interface ProductTextInput {
  name: string;
  sport: string;
  league: string;
  team: string;
  kit: string;
  season: string;
  pattern: string;
  description: string;
}


export function buildProductText(p: ProductTextInput): string {
  // Fuzzy attributes only. Team, league, kit and sport are handled by SQL filters.
  return p.description;
}

// Stored in products.embedded_hash. If the hash is unchanged, there is no need to re-embed.
export function hashText(text: string): string {
  return createHash("sha256").update(`${EMBEDDING_MODEL}:${text}`).digest("hex");
}

// One API call can embed many texts. Results come back in the same order as the input.
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const res = await getClient().embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });
  return res.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}