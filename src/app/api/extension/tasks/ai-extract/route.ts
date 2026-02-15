import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getOpenAI, isOpenAIConfigured } from '@/lib/server/openai'

// Helper to get user from API key or session
async function getAuthenticatedUser(request: NextRequest) {
  const apiKey = request.headers.get('X-Extension-Key')

  if (apiKey) {
    const token = await prisma.clientAccessToken.findFirst({
      where: {
        token: apiKey,
        active: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            orgId: true,
            role: true
          }
        }
      }
    })

    if (token?.createdBy) {
      return token.createdBy
    }
  }

  // Fall back to session
  const session = await getSession()
  if (!session?.user?.email) return null

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      name: true,
      email: true,
      orgId: true,
      role: true
    }
  })

  return user
}

// POST: Use AI to extract a clean task title and description from email content
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { emailSubject, emailFrom, emailBody } = body

    // If OpenAI is not configured, fall back to raw values
    if (!isOpenAIConfigured()) {
      return NextResponse.json({
        ok: true,
        title: emailSubject || '(no subject)',
        description: emailBody ? emailBody.substring(0, 200) : '',
        aiGenerated: false,
      })
    }

    // Build the prompt with email content
    const emailContent = [
      emailSubject ? `Subject: ${emailSubject}` : '',
      emailFrom ? `From: ${emailFrom}` : '',
      emailBody ? `\nBody:\n${emailBody.substring(0, 1500)}` : '',
    ].filter(Boolean).join('\n')

    if (!emailContent.trim()) {
      return NextResponse.json({
        ok: true,
        title: '(no subject)',
        description: '',
        aiGenerated: false,
      })
    }

    const openai = getOpenAI()

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 150,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You create short simple tasks from emails for an interior design firm. ' +
            'Title: max 50 characters, plain language, like a to-do item (e.g. "Pay invoice from Moshe" not "Review and process the invoice received from Moshe Gross"). ' +
            'Description: one short sentence with the key detail only. Leave empty string if the title says enough. ' +
            'Keep it simple. No corporate speak. No fancy words. ' +
            'Return JSON: { "title": "...", "description": "..." }',
        },
        {
          role: 'user',
          content: emailContent,
        },
      ],
    })

    const raw = completion.choices[0]?.message?.content || ''

    try {
      const parsed = JSON.parse(raw)
      return NextResponse.json({
        ok: true,
        title: parsed.title || emailSubject || '(no subject)',
        description: parsed.description || '',
        aiGenerated: true,
      })
    } catch {
      // JSON parse failed — fall back to raw values
      return NextResponse.json({
        ok: true,
        title: emailSubject || '(no subject)',
        description: emailBody ? emailBody.substring(0, 200) : '',
        aiGenerated: false,
      })
    }
  } catch (error) {
    console.error('AI extract error:', error)
    // On any error, return raw fallback so the add-on still works
    try {
      const body = await request.clone().json().catch(() => ({}))
      return NextResponse.json({
        ok: true,
        title: body.emailSubject || '(no subject)',
        description: body.emailBody ? body.emailBody.substring(0, 200) : '',
        aiGenerated: false,
      })
    } catch {
      return NextResponse.json({
        ok: true,
        title: '(no subject)',
        description: '',
        aiGenerated: false,
      })
    }
  }
}
