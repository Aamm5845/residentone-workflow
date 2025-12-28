/**
 * Server-only Anthropic Claude client
 *
 * IMPORTANT: This file must only be imported in server-side code (API routes, server components)
 * Never import this in client components or it will expose the API key
 */

import Anthropic from '@anthropic-ai/sdk'

let claudeClient: Anthropic | null = null

/**
 * Get or create Anthropic Claude client instance
 * @throws Error if ANTHROPIC_API_KEY is not set
 */
export function getClaude(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    throw new Error(
      'Missing ANTHROPIC_API_KEY environment variable. ' +
      'Add it to .env.local for development or configure it in Vercel for production.'
    )
  }

  // Reuse client instance for better performance
  if (!claudeClient) {
    claudeClient = new Anthropic({
      apiKey,
      timeout: 60000, // 60 second timeout for PDF processing
      maxRetries: 2
    })
  }

  return claudeClient
}

/**
 * Check if Anthropic Claude is configured
 */
export function isClaudeConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY
}
