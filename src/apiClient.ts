/** Same-origin HTTP boundary for the PHP API. DataStore remains the local store. */
export interface ApiHealth {
  status: 'ok';
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function getApiHealth(): Promise<ApiHealth> {
  const response = await fetch('/api/health.php', {
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new ApiError(response.status, `API health check failed (${response.status})`);
  }
  const body: unknown = await response.json();
  if (typeof body !== 'object' || body === null || !('status' in body) || body.status !== 'ok') {
    throw new Error('Invalid API health response');
  }
  return { status: 'ok' };
}
