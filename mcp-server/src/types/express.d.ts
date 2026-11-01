declare global {
  namespace Express {
    interface Request {
      mcpPrincipal?: { userId: string; token: string };
    }
  }
}

export {};
