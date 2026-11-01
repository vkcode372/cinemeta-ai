export class McpConnectionError extends Error {
  constructor(message: string, public readonly statusCode?: number, options?: ErrorOptions) {
    super(message, options);
    this.name = 'McpConnectionError';
  }
}

export class McpToolExecutionError extends Error {
  constructor(public readonly toolName: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'McpToolExecutionError';
  }
}
