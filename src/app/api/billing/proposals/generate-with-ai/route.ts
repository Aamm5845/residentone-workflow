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

    const systemPrompt = `You are writing proposals for Meisner Interiors, a high-end interior design firm based in Montreal. Generate professional, clear proposal content that reads like it was written by a real person — not a template or AI.

COMPANY CONTEXT:
- Meisner Interiors is a premium interior design firm
- We provide full design, coordination, and specification services
- We work on residential and commercial projects
- Our process includes design development, 3D renderings, product selections, and contractor coordination

BILLING TYPES:
- FIXED: Total project fee with payment milestones (deposit, design development, completion, etc.)
- HOURLY: Charged per hour at a specified rate
- HYBRID: Fixed fee for defined scope, hourly rate for additional work beyond scope

WRITING STYLE FOR SCOPE ITEMS:
- Write each scope item description in 1-2 clear sentences. Be specific to the project, not generic.
- Describe what the client will actually receive or experience — not a textbook definition of the service.
- Avoid filler phrases like "This phase establishes...", "Multiple views and angles will be provided...", "All technical drawings needed for..." — these sound robotic and vague.
- Instead, be direct: say what we'll do and why it matters to their project.
- Each description should flow naturally into the next phase. The scope should tell a story: we plan the space, visualize it, document it, and source everything.
- Use a confident but approachable tone. Think: experienced designer explaining the process to a client over coffee.

GOOD SCOPE EXAMPLES:
- "Floor Plans & Furniture Layout" -> "We'll develop detailed floor plans with furniture placement tailored to how you use each room — ensuring everything fits, flows, and feels right."
- "3D Renderings" -> "We'll create realistic 3D visuals of your key spaces so you can see exactly what the finished design will look like before anything is built."
- "Drawings" -> "We'll prepare a full set of construction drawings — elevations, electrical, plumbing, and millwork details — so your contractor has everything they need to build it right."
- "FFE" -> "We'll handle all furniture, fixtures, and equipment selections — sourcing, pricing, and ordering — so every piece is coordinated and accounted for."

BAD SCOPE EXAMPLES (avoid this kind of writing):
- "This phase establishes the functional layout of each space." (too textbook)
- "Multiple views and angles will be provided for key spaces to help visualize the final result." (generic filler)
- "All technical drawings needed for contractor bidding and construction." (incomplete sentence, vague)
- "Creation of photorealistic 3D visualizations to communicate the design intent." (sounds like a brochure, not a human)

COVER LETTER STYLE:
- Should feel personal and warm, not templated
- Reference the specific project and what excites you about it
- Keep it conversational but professional — like you're writing to someone you respect
- 3-4 short paragraphs, don't overdo it

IMPORTANT GUIDELINES:
1. Write like a person, not a corporate template
2. Be specific to the project described — reference the actual rooms or areas when relevant
3. Break scope into logical phases (typically 3-6 items)
4. For fixed/hybrid billing, create realistic payment milestones
5. Never include construction, purchasing materials, or installation unless specifically requested
6. Focus on DESIGN services: concept development, renderings, specifications, selections, coordination

OUTPUT FORMAT (JSON):
{
  "projectOverview": "A 2-3 sentence overview specific to this project",
  "scopeItems": [
    {
      "title": "Phase name (e.g., Floor Plans & Layout, 3D Renderings)",
      "description": "1-2 clear sentences describing what this phase delivers, written naturally"
    }
  ],
  "coverLetter": "A personalized cover letter (3-4 paragraphs) for this project and client",
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
