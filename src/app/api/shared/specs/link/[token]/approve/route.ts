import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Public API - no auth required (approval via share link)
// Requires project street address verification for security
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const { itemId, projectAddress } = body

    if (!itemId) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 })
    }

    // Require street number for verification
    if (!projectAddress || typeof projectAddress !== 'string' || projectAddress.trim() === '') {
      return NextResponse.json({
        error: 'Street number is required for verification',
        requiresAddress: true
      }, { status: 400 })
    }

    // Find the share link by token
    const shareLink = await prisma.specShareLink.findUnique({
      where: { token },
      select: {
        id: true,
        projectId: true,
        itemIds: true,
        allowApproval: true,
        active: true,
        expiresAt: true
      }
    })

    // Check if link exists
    if (!shareLink) {
      return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
    }

    // Check if link is active
    if (!shareLink.active) {
      return NextResponse.json({ error: 'This link has been deactivated' }, { status: 410 })
    }

    // Check if link has expired
    if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
      return NextResponse.json({ error: 'This link has expired' }, { status: 410 })
    }

    // Check if approval is allowed
    if (!shareLink.allowApproval) {
      return NextResponse.json({ error: 'Approval is not enabled for this link' }, { status: 403 })
    }

    // Verify project street address for security
    const project = await prisma.project.findUnique({
      where: { id: shareLink.projectId },
      select: { streetAddress: true, address: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Extract street number from project address for verification
    const enteredNumber = projectAddress.trim()
    const actualStreetAddress = (project.streetAddress || '').trim()
    const actualAddress = (project.address || '').trim()

    // Helper function to extract street number from an address
    const extractStreetNumber = (address: string): string | null => {
      if (!address) return null
      // Match leading numbers (e.g., "5655 Main Street" -> "5655")
      const match = address.match(/^(\d+)/)
      if (match) return match[1]
      // Also try to find numbers anywhere in the address
      const anyNumberMatch = address.match(/(\d+)/)
      return anyNumberMatch ? anyNumberMatch[1] : null
    }

    const streetNumberFromStreetAddress = extractStreetNumber(actualStreetAddress)
    const streetNumberFromAddress = extractStreetNumber(actualAddress)

    // If project has no address configured, skip verification
    const hasProjectAddress = streetNumberFromStreetAddress || streetNumberFromAddress

    if (hasProjectAddress) {
      // Match the entered number against the extracted street numbers
      const numberMatches =
        (streetNumberFromStreetAddress && enteredNumber === streetNumberFromStreetAddress) ||
        (streetNumberFromAddress && enteredNumber === streetNumberFromAddress)

      if (!numberMatches) {
        console.log('Address verification failed:', {
          entered: enteredNumber,
          fromStreetAddress: streetNumberFromStreetAddress,
          fromAddress: streetNumberFromAddress,
          actualStreetAddress,
          actualAddress
        })
        return NextResponse.json({
          error: 'The street number you entered does not match our records. Please check and try again.',
          invalidAddress: true
        }, { status: 403 })
      }
    }

    // Check if item is in the share link's items (if specific items are selected)
    const hasItemIds = shareLink.itemIds && shareLink.itemIds.length > 0
    if (hasItemIds && !shareLink.itemIds.includes(itemId)) {
      return NextResponse.json({ error: 'Item not found in this share link' }, { status: 404 })
    }

    // Verify item exists and belongs to the project
    const item = await prisma.roomFFEItem.findFirst({
      where: {
        id: itemId,
        section: {
          instance: {
            room: {
              projectId: shareLink.projectId
            }
          }
        }
      },
      select: {
        id: true,
        name: true,
        clientApproved: true,
        section: {
          select: {
            instance: {
              select: {
                room: {
                  select: {
                    projectId: true,
                    name: true
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Check if already approved
    if (item.clientApproved) {
      return NextResponse.json({
        success: true,
        message: 'Item already approved',
        alreadyApproved: true
      })
    }

    // Update the item to mark as approved
    const updatedItem = await prisma.roomFFEItem.update({
      where: { id: itemId },
      data: {
        clientApproved: true,
        clientApprovedAt: new Date(),
        clientApprovedVia: 'share_link'
      }
    })

    // Create activity record for this approval
    const projectId = item.section?.instance?.room?.projectId
    if (projectId) {
      await prisma.activity.create({
        data: {
          type: 'FFE_ITEM_UPDATED',
          projectId,
          details: {
            itemId: item.id,
            itemName: item.name,
            roomName: item.section?.instance?.room?.name,
            action: 'client_approved',
            approvedVia: 'share_link',
            changes: {
              clientApproved: { from: false, to: true }
            }
          }
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Item approved successfully',
      item: {
        id: updatedItem.id,
        clientApproved: updatedItem.clientApproved,
        clientApprovedAt: updatedItem.clientApprovedAt?.toISOString()
      }
    })

  } catch (error) {
    console.error('Error approving item:', error)
    return NextResponse.json(
      { error: 'Failed to approve item' },
      { status: 500 }
    )
  }
}
