export interface Movie {
  id: string;
  title: string;
  genre: string;
  language: string;
  rating: string | number;
  durationMinutes?: number;
  description?: string;
  posterUrl?: string | null;
  releaseDate?: string;
  shows?: Array<{
    id: string;
    startsAt: string;
    endsAt: string;
    price: string;
    cinema?: { name: string; city: string };
  }>;
}

export interface Booking {
  id: string;
  status: string;
  totalAmount: string;
  createdAt: string;
  showId?: string;
  show?: {
    startsAt: string;
    screenName?: string;
    price?: string;
    movie?: { title: string };
    cinema?: { name: string; city?: string };
  };
  seats?: Array<{ seatNumber: string }>;
}

export interface ShowAvailability {
  showId: string;
  price: string;
  totalSeats: number;
  seats: Array<{ number: string; available: boolean }>;
  show: {
    id: string;
    startsAt: string;
    screenName: string;
    movie?: { title: string };
    cinema?: { name: string; city: string };
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  tools?: Array<{ name: string; status: 'completed' | 'error' }>;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => ({}))) as {
    data?: T;
    error?: { message?: string };
  };
  if (!response.ok)
    throw new ApiRequestError(
      payload.error?.message ?? 'The request could not be completed. Please try again.',
      response.status,
    );
  return payload.data as T;
}

export function createId(): string {
  return globalThis.crypto.randomUUID();
}

export function notifyAuthChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('cinemate:auth-changed'));
}
