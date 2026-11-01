declare global {
  namespace Express {
    interface Request { user?: { id: string }; authToken?: string }
  }
}

export {};
