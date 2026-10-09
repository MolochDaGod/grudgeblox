import { workbenchHeartbeat } from '@/lib/workbenchServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  return workbenchHeartbeat(request)
}
