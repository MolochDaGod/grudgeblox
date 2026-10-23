import { serveWorkbench } from '@/lib/workbenchServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request, context: { params: Promise<{ asset: string[] }> }) {
  return serveWorkbench(request, (await context.params).asset)
}
