/** Trusted development tools have no production paid-admission adapter. */
export function assertDevelopmentPaidTool(env: Readonly<Record<string,string|undefined>> = process.env): void {
  if (env.NODE_ENV === 'production') throw new Error('Standalone paid tool refused in production; a reviewed admitted adapter is required');
}
