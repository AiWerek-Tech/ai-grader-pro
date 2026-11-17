/**
 * Base Path Helper untuk Deployment Subfolder (misal: https://app.wmvaa.id/ai-grader)
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '/ai-grader';

export function withBasePath(path: string): string {
  if (!path) return BASE_PATH || '/';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (!BASE_PATH) return cleanPath;
  if (cleanPath === BASE_PATH || cleanPath.startsWith(`${BASE_PATH}/`)) return cleanPath;
  return `${BASE_PATH}${cleanPath}`;
}
