export class AppError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolError';
  }
}
