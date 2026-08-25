import "server-only";
import type { DocumentAIProvider } from "./types";
import { MockDocumentAIProvider } from "./mock-provider";
import { OpenAIDocumentAIProvider } from "./openai-provider";
import { AzureDocumentAIProvider } from "./azure-provider";

export function getDocumentAIProvider(): DocumentAIProvider {
  const provider = (process.env.DOCUMENT_AI_PROVIDER || (process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY ? "azure" : process.env.OPENAI_API_KEY ? "openai" : "mock")).toLowerCase();
  if (provider === "mock") return new MockDocumentAIProvider();
  if (provider === "openai") return new OpenAIDocumentAIProvider();
  if (provider === "azure") return new AzureDocumentAIProvider();
  throw new Error(`Document AI provider “${provider}” is not configured in this build.`);
}

export type { DocumentAIProvider } from "./types";
