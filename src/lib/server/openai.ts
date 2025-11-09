/**
 * Server-only OpenAI client
 * 
 * IMPORTANT: This file must only be imported in server-side code (API routes, server components)
 * Never import this in client components or it will expose the API key
 */

import OpenAI from 'openai'

let openaiClient: OpenAI | null = null

/**
 * Get or create OpenAI client instance
 * @throws Error if OPENAI_API_KEY is not set
 */
export function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY
  
  if (!apiKey) {
    throw new Error(
      'Missing OPENAI_API_KEY environment variable. ' +
      'Add it to .env.local for development or configure it in Vercel for production.'
    )
  }

  // Reuse client instance for better performance
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey,
      timeout: 30000, // 30 second timeout
      maxRetries: 2
    })
  }

  return openaiClient
}

/**
 * Check if OpenAI is configured
 */
export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY
}
