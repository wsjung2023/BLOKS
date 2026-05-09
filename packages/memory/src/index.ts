// @bloks/memory — Character memory RAG: store, search, context injection
export { embedText, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from "./embed.js";
export {
  createMemory,
  linkMemoryToCharacters,
  searchMemories,
  searchMemoriesByScope,
  listCharacterMemories,
  deleteMemory,
} from "./store.js";
export type {
  MemoryNode,
  MemoryScope,
  MemoryType,
  DecayPolicy,
  VisibilityLevel,
  CreateMemoryInput,
  MemorySearchResult,
} from "./store.js";
export { buildMemoryContext, deriveMemorySummary } from "./context-builder.js";
export type { MemoryContextOptions, MemoryContext } from "./context-builder.js";
