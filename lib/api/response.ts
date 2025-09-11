export function success<T>(data: T) {
  return {
    status: 'success',
    data,
  };
}

export function error(message: string, code: number = 500) {
  return {
    status: 'error',
    message,
    code,
  };
} 