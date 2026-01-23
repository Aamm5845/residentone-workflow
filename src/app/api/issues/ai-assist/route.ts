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
      imageMimeType
    } = body

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array required' }, { status: 400 })
    }

    // Build the system prompt
    const systemPrompt = `You are a helpful assistant that helps users report software issues clearly and accurately. Your goal is to gather enough information to understand and fix the issue.

CONTEXT:
- This is a ${priority} priority issue report for an interior design project management application
- The app is built with Next.js, React, Prisma, and PostgreSQL
- Users can manage projects, rooms, procurement, suppliers, and more

YOUR TASK:
1. Understand what the user is experiencing
2. Ask 1-3 SHORT, focused clarifying questions to understand:
   - What exactly happened (the bug/issue)
   - What they expected to happen
   - Where in the app it occurred (which page/feature)
   - Steps to reproduce if not clear
3. If they haven't provided console logs and it seems like a technical error, ask them to:
   - Press F12 to open browser console
   - Look for any red error messages
   - Copy and paste them
4. If a screenshot would help clarify the issue, suggest they attach one

RULES:
- Keep responses SHORT and conversational (2-4 sentences max)
- Ask only ONE question at a time unless closely related
- Don't be overly formal - be helpful and friendly
- If you have enough information, say "I understand the issue now" and provide a BRIEF summary
- When you have enough info, end your message with: [READY_TO_SUBMIT]
- Include a JSON block at the end with the issue summary when ready:
\`\`\`json
{
  "title": "Brief issue title (max 10 words)",
  "description": "Clear description of the issue, what was expected, and how to reproduce",
  "suggestedType": "BUG" | "FEATURE_REQUEST" | "UPDATE_REQUEST" | "GENERAL"
}
\`\`\`

CURRENT STATUS:
- Console log provided: ${hasConsoleLog ? 'Yes' : 'No'}
- Screenshot provided: ${hasScreenshot ? 'Yes' : 'No'}
${consoleLog ? `\nConsole log content:\n${consoleLog.substring(0, 1000)}` : ''}

${hasScreenshot ? `IMPORTANT: A screenshot has been provided. Analyze it carefully to understand the visual context of the issue. Look for error messages, UI problems, or anything that helps clarify the issue.` : ''}`

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
