export const API_BASE =
  import.meta.env.VITE_API_BASE?.trim() || 'http://localhost:8000';
const REQUEST_TIMEOUT_MS = 15000;

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface HttpOptions<TBody> {
  method?: HttpMethod;
  headers?: HeadersInit;
  body?: TBody;
}

interface ErrorLike {
  detail?: string;
  message?: string;
  error?: string;
  title?: string;
}

export async function http<TResp, TBody = unknown>(
  path: string,
  { method = 'GET', headers = {}, body }: HttpOptions<TBody> = {},
): Promise<TResp> {
  const requestHeaders = new Headers(headers);
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let payload: BodyInit | undefined;

  try {
    if (body !== undefined && !(body instanceof FormData)) {
      if (!requestHeaders.has('Content-Type')) {
        requestHeaders.set('Content-Type', 'application/json');
      }
      payload = JSON.stringify(body);
    } else if (body instanceof FormData) {
      payload = body;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: requestHeaders,
      body: payload,
      credentials: 'include',
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type') || '';
    const isJson = /\bjson\b/i.test(contentType);
    const data: unknown = isJson ? await response.json().catch(() => null) : null;

    if (!response.ok) {
      const errData = (data ?? {}) as ErrorLike;
      const msg =
        errData.detail ||
        errData.message ||
        errData.error ||
        errData.title ||
        response.statusText ||
        `HTTP ${response.status}`;
      throw new ApiError(msg, response.status, data);
    }

    return data as TResp;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
