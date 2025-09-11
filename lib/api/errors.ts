export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number = 500) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return { status: 'error', message: error.message, code: error.status };
  }
  return { status: 'error', message: 'Internal server error', code: 500 };
} 