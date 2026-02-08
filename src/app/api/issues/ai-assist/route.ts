import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { isValidAuthSession } from '@/lib/attribution'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

interface Message {
  role: 'user' | 'assistant'
  content: string | Array<{ type: string; text?: string; source?: any }>
}

/**
 * AI-assisted issue reporting endpoint
 * Helps users clarify their issue through conversation
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      messages,
      hasConsoleLog,
      hasScreenshot,
      consoleLog,
      priority,
      imageBase64,
      imageMimeType,
      currentPage, // The page URL where user reported the issue
      pageName,    // Friendly page name (e.g., "Procurement")
      projectName  // Project name if on a project page
    } = body

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array required' }, { status: 400 })
    }

    // Build the system prompt
    const systemPrompt = `You are a helpful assistant that helps users report software issues. Your goal is to quickly understand and document the issue so it can be fixed.

CONTEXT:
- This is a ${priority} priority issue for an interior design project management app
- The app has: Projects, Rooms, FFE (furniture/fixtures), Procurement, Suppliers, Specs, etc.
${pageName && projectName ? `- User is on: ${pageName} page in "${projectName}" project` : pageName ? `- User is on: ${pageName} page` : ''}
${currentPage ? `- Page link: ${currentPage}` : ''}

IMPORTANT - WHEN TO ASK QUESTIONS:
- For BUGS: If clear what's broken, don't ask questions. Just confirm.
- For FEATURE REQUESTS: Ask ONE question about HOW they want it to work if not specified.
- Examples:
  - "Save button doesn't work" → Clear bug, confirm and submit
  - "Archived items should be hidden" → Ask: "How would you like to view archived items when needed? (toggle button, filter dropdown, separate tab?)"
  - "Add a filter for status" → Ask: "Should this be a dropdown, checkboxes, or tabs?"
  - "It's broken" → Ask: "What specifically is broken?"

KEY: For feature requests, ask about the user experience/implementation if not specified. One question max.

YOUR RESPONSE:
1. If the issue is clear: Confirm you understand, summarize briefly, and mark ready to submit
2. If unclear: Ask ONE short question to clarify the most important missing piece
3. If it's a bug and they haven't provided console/screenshot, you can suggest it but don't require it

RULES:
- Be concise (1-2 sentences)
- Don't repeat back everything they said
- Don't ask multiple questions
- Don't ask obvious questions if they already explained it
- When ready, end with: [READY_TO_SUBMIT]
- Include JSON summary when ready:
\`\`\`json
{
  "title": "Brief issue title (max 10 words)",
  "description": "Clear description including: what should happen, where in the app${currentPage ? ` (Location: ${currentPage})` : pageName ? ` (Location: ${pageName}${projectName ? ` in ${projectName}` : ''})` : ''}",
  "suggestedType": "BUG" | "FEATURE_REQUEST" | "UPDATE_REQUEST" | "GENERAL"
}
\`\`\`

CURRENT STATUS:
- Page: ${pageName || 'Unknown'}${projectName ? ` (Project: ${projectName})` : ''}${currentPage ? `\n- Page link: ${currentPage}` : ''}
- Console log: ${hasConsoleLog ? 'Yes' : 'No'}
- Screenshot: ${hasScreenshot ? 'Yes' : 'No'}
${consoleLog ? `\nConsole:\n${consoleLog.substring(0, 500)}` : ''}
${hasScreenshot ? `\nScreenshot provided - analyze it for context.` : ''}`

    // Convert messages to Anthropic format, including images if present
    const anthropicMessages: any[] = messages.map((msg: Message, index: number) => {
      // If this is the last user message and we have an image, include it
      if (msg.role === 'user' && index === messages.length - 1 && imageBase64 && imageMimeType) {
        return {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: imageMimeType,
                data: imageBase64
              }
            },
            {
              type: 'text',
              text: msg.content as string
            }
          ]
        }
      }
      return {
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }
    })

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: systemPrompt,
      messages: anthropicMessages
    })

    const assistantMessage = response.content[0].type === 'text'
      ? response.content[0].text
      : ''

    // Check if AI is ready to submit
    const isReadyToSubmit = assistantMessage.includes('[READY_TO_SUBMIT]')

    // Extract issue summary if ready
    let issueSummary = null
    if (isReadyToSubmit) {
      const jsonMatch = assistantMessage.match(/```json\n?([\s\S]*?)\n?```/)
      if (jsonMatch) {
        try {
          issueSummary = JSON.parse(jsonMatch[1])
        } catch (e) {
          console.error('Failed to parse issue summary JSON:', e)
        }
      }
    }

    // Clean the message for display (remove the markers and JSON)
    let cleanMessage = assistantMessage
      .replace('[READY_TO_SUBMIT]', '')
      .replace(/```json\n?[\s\S]*?\n?```/, '')
      .trim()

    return NextResponse.json({
      message: cleanMessage,
      isReadyToSubmit,
      issueSummary
    })
  } catch (error) {
    console.error('Error in AI assist:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
