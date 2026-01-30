import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { isValidAuthSession } from '@/lib/attribution'
import { getClaude } from '@/lib/server/claude'

/**
 * AI-powered proposal generation endpoint
 * Uses Claude to generate professional proposal content based on user input
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      projectName,
      projectType,
      clientName,
      designDescription,
      whatToInclude,
      whatNotToInclude,
      billingType,
      suggestedBudget,
      hourlyRate,
    } = body

    if (!designDescription) {
      return NextResponse.json({ error: 'Design description is required' }, { status: 400 })
    }

    const systemPrompt = `You are an expert interior design proposal writer for Meisner Interiors, a high-end interior design firm. Your task is to generate professional proposal content.

COMPANY CONTEXT:
- Meisner Interiors is a premium interior design firm
- We provide full design, coordination, and specification services
- We work on residential and commercial projects
- Our process includes design development, 3D renderings, product selections, and contractor coordination

BILLING TYPES:
- FIXED: Total project fee with payment milestones (deposit, design development, completion, etc.)
- HOURLY: Charged per hour at a specified rate
- HYBRID: Fixed fee for defined scope, hourly rate for additional work beyond scope

IMPORTANT GUIDELINES:
1. Be professional but warm and welcoming
2. Use clear, specific language
3. Break scope items into logical phases
4. For fixed/hybrid billing, create realistic payment milestones
5. Never include construction, purchasing materials, or installation unless specifically requested
6. Focus on DESIGN services: concept development, renderings, specifications, selections, coordination

OUTPUT FORMAT (JSON):
{
  "projectOverview": "A 2-3 sentence overview of what Meisner Interiors will provide",
  "scopeItems": [
    {
      "title": "Phase name (e.g., Design Development, Product Selections)",
      "description": "Detailed description of what's included in this phase"
    }
  ],
  "coverLetter": "A professional cover letter (3-4 paragraphs) personalized for this project",
  "paymentSchedule": [
    {
      "title": "Milestone name",
      "amount": number,
      "percent": number or null,
      "dueOn": "signing" | "milestone" | "completion",
      "description": "Brief description of when this payment is due"
    }
  ],
  "suggestedBudget": number (only if not provided by user),
  "hourlyRate": number (only for HOURLY/HYBRID if not provided),
  "estimatedHours": number (only for HOURLY billing)
}

For HOURLY billing, omit paymentSchedule and suggestedBudget.
For FIXED billing, omit hourlyRate and estimatedHours.
For HYBRID billing, include both paymentSchedule AND hourlyRate.`

    const userPrompt = `Generate a proposal for the following project:

PROJECT: ${projectName}
TYPE: ${projectType}
CLIENT: ${clientName}
BILLING TYPE: ${billingType}

DESIGN DESCRIPTION:
${designDescription}

${whatToInclude ? `WHAT TO INCLUDE:\n${whatToInclude}\n` : ''}
${whatNotToInclude ? `WHAT NOT TO INCLUDE:\n${whatNotToInclude}\n` : ''}
${suggestedBudget ? `BUDGET: $${suggestedBudget}` : 'Suggest an appropriate budget based on the scope.'}
${hourlyRate ? `HOURLY RATE: $${hourlyRate}/hour` : billingType !== 'FIXED' ? 'Suggest an appropriate hourly rate for a premium design firm (typically $150-300/hour).' : ''}

Generate professional proposal content in JSON format.`

    const claude = getClaude()
    const response = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ]
    })

    const assistantMessage = response.content[0].type === 'text'
      ? response.content[0].text
      : ''

    // Extract JSON from the response
    let proposalContent = null

    // Try to find JSON in code blocks first
    const jsonMatch = assistantMessage.match(/```(?:json)?\n?([\s\S]*?)\n?```/)
    if (jsonMatch) {
      try {
        proposalContent = JSON.parse(jsonMatch[1])
      } catch (e) {
        console.error('Failed to parse JSON from code block:', e)
      }
    }

    // If no code block, try to parse the entire response as JSON
    if (!proposalContent) {
      try {
        proposalContent = JSON.parse(assistantMessage)
      } catch (e) {
        console.error('Failed to parse response as JSON:', e)
        // Try to extract JSON object from text
        const jsonObjectMatch = assistantMessage.match(/\{[\s\S]*\}/)
        if (jsonObjectMatch) {
          try {
            proposalContent = JSON.parse(jsonObjectMatch[0])
          } catch (e2) {
            console.error('Failed to extract JSON object:', e2)
          }
        }
      }
    }

    if (!proposalContent) {
      return NextResponse.json(
        { error: 'Failed to generate proposal content. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json(proposalContent)
  } catch (error) {
    console.error('Error generating proposal with AI:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
