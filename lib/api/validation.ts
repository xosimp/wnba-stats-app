export function validateBody<T>(body: any, schema: any): T {
  // Placeholder: In production, use a schema validation library like zod or yup
  // For now, just return the body as is
  return body as T;
} 