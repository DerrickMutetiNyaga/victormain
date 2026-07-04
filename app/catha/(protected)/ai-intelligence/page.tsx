import { requireSuperAdmin } from '@/lib/catha-auth'
import AIIntelligenceContent from './ai-intelligence-content'

export default async function AIIntelligencePage() {
  await requireSuperAdmin()
  return <AIIntelligenceContent />
}
