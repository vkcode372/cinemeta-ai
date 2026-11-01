import { ToolError } from '../errors/app-error.js';

export async function toolResult(operation: () => Promise<unknown>) {
  try {
    return { content: [{ type: 'text' as const, text: JSON.stringify(await operation()) }] };
  } catch (error) {
    const message = error instanceof ToolError ? error.message : 'Tool execution failed';
    return { isError: true, content: [{ type: 'text' as const, text: message }] };
  }
}
