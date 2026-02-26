import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { isValidAuthSession } from '@/lib/attribution'
import { getClaude } from '@/lib/server/claude'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { projectDescription, whatToInclude, whatNotToInclude, projectType } = body

    if (!projectDescription) {
      return NextResponse.json({ error: 'Project description is required' }, { status: 400 })
    }

    const prompt = `You are an interior design project manager at Meisner Interiors, a high-end firm in Montreal. Based on the following project details, suggest relevant project phases WITH descriptions.

Project Type: ${projectType || 'Interior Design'}

Project Description:
${projectDescription}

${whatToInclude ? `Features to Include:\n${whatToInclude}` : ''}

${whatNotToInclude ? `Exclusions:\n${whatNotToInclude}` : ''}

Suggest 3-6 relevant project phases. For each phase, write a short description (1-2 sentences) that explains what the client will receive — be specific to this project, not generic.

Writing rules:
- Sound like a real person, not AI. No filler, no fluff.
- Be direct — say what we'll do and why it matters.
- Don't start descriptions with "This phase..." or "In this phase..."
- Avoid words like "transform", "elevate", "stunning", "breathe life into".
- Don't include phases that are excluded.
- Focus on interior design services: design development, renderings, specs, selections, coordination.
- Keep titles concise (2-4 words).

GOOD example:
{"title": "Floor Plans & Layout", "description": "We'll develop detailed floor plans with furniture placement tailored to how you use each room — ensuring everything fits, flows, and feels right."}

BAD example:
{"title": "Floor Plans & Layout", "description": "This phase establishes the functional layout of each space through detailed planning."}

Respond with ONLY a JSON array of objects with "title" and "description" fields, nothing else.`

    const claude = getClaude()
    const message = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    // Extract text content
    const textContent = message.content.find((block) => block.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from AI')
    }

    // Parse the JSON array
    const responseText = textContent.text.trim()
    let suggestedPhases: { title: string; description: string }[] = []

    try {
      suggestedPhases = JSON.parse(responseText)
    } catch {
      // Try to extract JSON array from the response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        suggestedPhases = JSON.parse(jsonMatch[0])
      }
    }

    // Filter and validate
    suggestedPhases = suggestedPhases
      .filter((phase) => typeof phase === 'object' && phase.title?.trim())
      .map((phase) => ({
        title: phase.title.trim(),
        description: (phase.description || '').trim(),
      }))
      .slice(0, 8)

    return NextResponse.json({ suggestedPhases })
  } catch (error) {
    console.error('Error suggesting phases:', error)
    return NextResponse.json(
      { error: 'Failed to suggest phases' },
      { status: 500 }
    )
  }
}
