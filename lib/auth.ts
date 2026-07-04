// DEPRECATED: Use app-specific auth instances instead
// This file is kept for backward compatibility but should be updated to use:
// - For Catha routes: import { auth } from '@/lib/auth-catha'
// - For Jaba routes: import { auth } from '@/lib/auth-jaba'

import { auth as jabaAuth } from "@/lib/auth-jaba"

export async function getServerSession() {
  // Default to Jaba auth for backward compatibility
  // TODO: Update all usages to use app-specific auth
  return await jabaAuth()
}

