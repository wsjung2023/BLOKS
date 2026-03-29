declare module "bullmq" {
  export class Queue {
    constructor(name: string, options?: Record<string, unknown>);
    add(name: string, data: unknown, options?: Record<string, unknown>): Promise<{ id: string }>;
  }
}
