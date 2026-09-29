// POST /api/retry-leads with header "authorization: Bearer <RETRY_TOKEN>".
// Call from a scheduled Worker or manually to push queued leads into Zoho.
import { flushQueue, type Env } from '../../src/server/integrations';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.RETRY_TOKEN || request.headers.get('authorization') !== `Bearer ${env.RETRY_TOKEN}`) {
    return new Response('Forbidden', { status: 403 });
  }
  const r = await flushQueue(env);
  return new Response(JSON.stringify(r), { headers: { 'content-type': 'application/json' } });
};
