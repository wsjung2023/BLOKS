import { ID_PREFIX } from "./id-prefix.js";

export type EntityKind = keyof typeof ID_PREFIX;

export function createEntityId(kind: EntityKind, value: string | number): string {
  return `${ID_PREFIX[kind]}${value}`;
}
