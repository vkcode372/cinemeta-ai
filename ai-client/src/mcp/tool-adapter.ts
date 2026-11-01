import type { FunctionDeclaration } from '@google/genai';
import { z, type ZodType } from 'zod';
import type { McpToolDefinition } from '../types/index.js';

type JsonSchema = Record<string, unknown>;

export class ToolAdapterError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ToolAdapterError';
  }
}

export class InvalidToolArgumentsError extends Error {
  constructor(public readonly toolName: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'InvalidToolArgumentsError';
  }
}

export interface AdaptedTool {
  declaration: FunctionDeclaration;
  validateArguments(args: unknown): Record<string, unknown>;
}

export interface AdaptedTools {
  declarations: FunctionDeclaration[];
  byName: Map<string, AdaptedTool>;
}

function isRecord(value: unknown): value is JsonSchema {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function schemaToZod(value: unknown): ZodType {
  if (!isRecord(value)) throw new ToolAdapterError('MCP tool input schema must be a JSON Schema object');

  const alternatives = Array.isArray(value.anyOf) ? value.anyOf : Array.isArray(value.oneOf) ? value.oneOf : undefined;
  if (alternatives?.length) {
    const schemas = alternatives.map(schemaToZod);
    return schemas.slice(1).reduce((combined, next) => z.union([combined, next]), schemas[0]);
  }

  if (value.type === 'object') {
    const properties = isRecord(value.properties) ? value.properties : {};
    const required = new Set(Array.isArray(value.required) ? value.required.filter((entry): entry is string => typeof entry === 'string') : []);
    const shape: Record<string, ZodType> = {};
    for (const [name, propertySchema] of Object.entries(properties)) {
      const property = schemaToZod(propertySchema);
      shape[name] = required.has(name) ? property : property.optional();
    }
    return z.object(shape).strict();
  }

  if (value.type === 'string') {
    const stringSchema = value.format === 'uuid' ? z.string().uuid() : z.string();
    const minLength = typeof value.minLength === 'number' ? value.minLength : undefined;
    const maxLength = typeof value.maxLength === 'number' ? value.maxLength : undefined;
    if (Array.isArray(value.enum)) {
      const allowed = value.enum.filter((entry): entry is string => typeof entry === 'string');
      if (!allowed.length) throw new ToolAdapterError('MCP string enum has no string values');
      return stringSchema.refine((entry) =>
        (minLength === undefined || entry.length >= minLength) &&
        (maxLength === undefined || entry.length <= maxLength) &&
        allowed.includes(entry), 'Value violates the MCP string schema');
    }
    return stringSchema.refine((entry) =>
      (minLength === undefined || entry.length >= minLength) &&
      (maxLength === undefined || entry.length <= maxLength), 'Value violates the MCP string schema');
  }

  if (value.type === 'integer') return z.number().int();
  if (value.type === 'number') return z.number();
  if (value.type === 'boolean') return z.boolean();
  if (value.type === 'array' && value.items) return z.array(schemaToZod(value.items));
  if (value.type === undefined) return z.unknown();
  throw new ToolAdapterError(`Unsupported MCP JSON Schema type: ${String(value.type)}`);
}

export function adaptMcpTools(tools: McpToolDefinition[]): AdaptedTools {
  const byName = new Map<string, AdaptedTool>();
  for (const tool of tools) {
    if (byName.has(tool.name)) throw new ToolAdapterError(`Duplicate MCP tool name: ${tool.name}`);
    if (isRecord(tool.inputSchema.properties) && ['userId', 'user_id', 'userID'].some((key) => key in tool.inputSchema.properties!)) {
      throw new ToolAdapterError(`MCP tool ${tool.name} exposes a user identity argument, which is not allowed`);
    }

    const validator = schemaToZod(tool.inputSchema) as ZodType<Record<string, unknown>>;
    const declaration: FunctionDeclaration = {
      name: tool.name,
      ...(tool.description ? { description: tool.description } : {}),
      parametersJsonSchema: tool.inputSchema,
    };
    byName.set(tool.name, {
      declaration,
      validateArguments(args) {
        const result = validator.safeParse(args);
        if (!result.success || !isRecord(result.data)) {
          const details = result.success ? 'Expected an object' : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
          throw new InvalidToolArgumentsError(tool.name, details);
        }
        return result.data;
      },
    });
  }
  return { declarations: [...byName.values()].map((entry) => entry.declaration), byName };
}
