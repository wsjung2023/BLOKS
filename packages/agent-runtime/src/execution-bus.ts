import { EventType, type ToolExecutionRecord, type ToolEventPayload } from "@bloks/shared";

export type ExecutionBusListener = (event: ExecutionBusEvent) => void;

export interface ExecutionBusEvent {
  eventType: EventType;
  payload: ToolEventPayload;
}

/**
 * In-process event bus for tool execution lifecycle events.
 * Runtime is producer; worker/API/web are consumers via SSE bridge.
 */
export class ExecutionBus {
  private readonly listeners = new Set<ExecutionBusListener>();

  subscribe(listener: ExecutionBusListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(eventType: EventType, execution: ToolExecutionRecord): void {
    const event: ExecutionBusEvent = { eventType, payload: { execution } };
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // listener errors must not crash the runtime
      }
    }
  }
}

export const globalExecutionBus = new ExecutionBus();
