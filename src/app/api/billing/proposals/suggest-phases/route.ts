import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { projectDescription, whatToInclude, whatNotToInclude, projectType } = body

    if (!projectDescription) {
      return NextResponse.json({ error: 'Project description is required' }, { status: 400 })
    }

    const prompt = `You are an interior design project manager. Based on the following project details, suggest relevant project phases.

Project Type: ${projectType || 'Interior Design'}

Project Description:
${projectDescription}

${whatToInclude ? `Features to Include:\n${whatToInclude}` : ''}

${whatNotToInclude ? `Exclusions:\n${whatNotToInclude}` : ''}

Based on this information, suggest 3-6 relevant project phases. Only provide phase TITLES (short names like "Design Development", "3D Renderings", "Drawings", "Engineering Coordination", "Product Selection", "Construction Administration", etc.).

Consider:
- What phases are actually needed based on the scope
- Don't include phases that are excluded
- Focus on interior design typical phases
- Keep titles concise (2-4 words max)

Respond with ONLY a JSON array of phase titles, nothing else. Example:
["Design Development", "3D Renderings", "Construction Documents"]`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
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
    let suggestedPhases: string[] = []

    try {
      // Try to parse JSON directly
      suggestedPhases = JSON.parse(responseText)
    } catch {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        suggestedPhases = JSON.parse(jsonMatch[0])
      }
    }

    // Filter and validate
    suggestedPhases = suggestedPhases
      .filter((phase) => typeof phase === 'string' && phase.trim())
      .map((phase) => phase.trim())
      .slice(0, 8) // Max 8 phases

    return NextResponse.json({ suggestedPhases })
  } catch (error) {
    console.error('Error suggesting phases:', error)
    return NextResponse.json(
      { error: 'Failed to suggest phases' },
      { status: 500 }
    )
  }
}
