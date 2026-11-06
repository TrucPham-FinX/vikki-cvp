import { previewShell } from '@/cvp/previewShell'
import { signedIn, unauthorized } from '@/cvp/previewHttp'

/** The page Payload's Live Preview frames (cvp/previewShell.ts) */
export async function GET(request: Request) {
  const { t, user } = await signedIn(request)
  if (!user) return unauthorized()
  return new Response(previewShell(t), {
    headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/html; charset=utf-8' },
  })
}
