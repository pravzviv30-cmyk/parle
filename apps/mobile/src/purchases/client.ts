import { authHeaders } from '../auth/adapter.ts';
import { TOKEN_SERVER } from '../live/serverUrl.ts';

/** Ask the token server to project verified current subscriber state. */
export async function refreshBilling(): Promise<boolean> {
  try {
    const response = await fetch(`${TOKEN_SERVER}/billing/refresh`, {
      method: 'POST',
      headers: await authHeaders(),
    });
    return response.ok;
  } catch {
    return false;
  }
}
