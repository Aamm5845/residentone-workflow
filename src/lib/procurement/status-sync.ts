/**
 * Status Synchronization Service for Procurement Workflow
 *
 * Automatically updates RoomFFEItem.specStatus based on procurement events.
 * This ensures items always reflect their current stage in the procurement pipeline.
 */

import { prisma } from '@/lib/prisma';
import { FFESpecStatus, ItemPaymentStatus, Prisma } from '@prisma/client';

// Define the workflow order for status progression
const PROCUREMENT_STATUS_ORDER: FFESpecStatus[] = [
  'DRAFT',
  'SELECTED',
  'RFQ_SENT',
  'QUOTE_RECEIVED',
  'QUOTE_APPROVED',
  'BUDGET_SENT',
  'BUDGET_APPROVED',
  'INVOICED_TO_CLIENT',
  'CLIENT_PAID',
  'ORDERED',
  'SHIPPED',
  'RECEIVED',
  'DELIVERED',
  'INSTALLED',
  'CLOSED',
];

// Manual statuses that should not be automatically overwritten
const MANUAL_STATUSES: FFESpecStatus[] = [
  'HIDDEN',
  'CLIENT_TO_ORDER',
  'CONTRACTOR_TO_ORDER',
  'NEED_SAMPLE',
  'ISSUE',
  'ARCHIVED',
];

// Map procurement events to their target status
const STATUS_TRIGGERS: Record<string, FFESpecStatus> = {
  'rfq_sent': 'RFQ_SENT',
  'quote_received': 'QUOTE_RECEIVED',
  'quote_accepted': 'QUOTE_APPROVED',
  'added_to_client_quote': 'QUOTE_APPROVED',
  'client_quote_sent': 'BUDGET_SENT',
  'client_approved': 'BUDGET_APPROVED',
  'invoice_sent': 'INVOICED_TO_CLIENT',
  'payment_received': 'CLIENT_PAID',
  'order_created': 'ORDERED',
  'order_shipped': 'SHIPPED',
  'order_received': 'RECEIVED',
  'order_delivered': 'DELIVERED',
  'installed': 'INSTALLED',
  'completed': 'CLOSED',
};

type PrismaTransactionClient = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

interface StatusSyncResult {
  itemId: string;
  previousStatus: FFESpecStatus;
  newStatus: FFESpecStatus;
  changed: boolean;
  reason?: string;
}

/**
 * Check if status A is further along in the workflow than status B
 */
function isStatusAhead(statusA: FFESpecStatus, statusB: FFESpecStatus): boolean {
  const indexA = PROCUREMENT_STATUS_ORDER.indexOf(statusA);
  const indexB = PROCUREMENT_STATUS_ORDER.indexOf(statusB);

  // If either status is not in the procurement order, don't compare
  if (indexA === -1 || indexB === -1) return false;

  return indexA > indexB;
}

/**
 * Sync item status based on a procurement event
 * Only moves status forward, never backward
 */
export async function syncItemStatus(
  itemId: string,
  trigger: string,
  actorId?: string,
  tx?: PrismaTransactionClient
): Promise<StatusSyncResult> {
  const db = tx || prisma;

  const newStatus = STATUS_TRIGGERS[trigger];
  if (!newStatus) {
    return {
      itemId,
      previousStatus: 'DRAFT',
      newStatus: 'DRAFT',
      changed: false,
      reason: `Unknown trigger: ${trigger}`,
    };
  }

  const item = await db.roomFFEItem.findUnique({
    where: { id: itemId },
    select: { specStatus: true, name: true },
  });

  if (!item) {
    return {
      itemId,
      previousStatus: 'DRAFT',
      newStatus,
      changed: false,
      reason: 'Item not found',
    };
  }

  const currentStatus = item.specStatus;

  // Don't overwrite manual statuses
  if (MANUAL_STATUSES.includes(currentStatus)) {
    return {
      itemId,
      previousStatus: currentStatus,
      newStatus,
      changed: false,
      reason: `Current status ${currentStatus} is a manual status`,
    };
  }

  // Only update if moving forward in workflow
  if (!isStatusAhead(newStatus, currentStatus)) {
    return {
      itemId,
      previousStatus: currentStatus,
      newStatus,
      changed: false,
      reason: `New status ${newStatus} is not ahead of current status ${currentStatus}`,
    };
  }

  // Update the status
  await db.roomFFEItem.update({
    where: { id: itemId },
    data: { specStatus: newStatus },
  });

  // Log activity
  await db.itemActivity.create({
    data: {
      itemId,
      type: 'STATUS_CHANGED',
      title: 'Status Updated',
      description: `Status changed from ${currentStatus} to ${newStatus} (trigger: ${trigger})`,
      actorId,
      actorType: actorId ? 'user' : 'system',
    },
  });

  return {
    itemId,
    previousStatus: currentStatus,
    newStatus,
    changed: true,
  };
}

/**
 * Sync status for multiple items at once
 */
export async function syncItemsStatus(
  itemIds: string[],
  trigger: string,
  actorId?: string,
  tx?: PrismaTransactionClient
): Promise<StatusSyncResult[]> {
  const results: StatusSyncResult[] = [];

  for (const itemId of itemIds) {
    const result = await syncItemStatus(itemId, trigger, actorId, tx);
    results.push(result);
  }

  return results;
}

/**
 * Update payment status for an item
 */
export async function updateItemPaymentStatus(
  itemId: string,
  paymentStatus: ItemPaymentStatus,
  paidAmount?: number,
  tx?: PrismaTransactionClient
): Promise<void> {
  const db = tx || prisma;

  const updateData: Prisma.RoomFFEItemUpdateInput = {
    paymentStatus,
    paidAt: paymentStatus !== 'NOT_INVOICED' ? new Date() : null,
  };

  if (paidAmount !== undefined) {
    updateData.paidAmount = paidAmount;
  }

  await db.roomFFEItem.update({
    where: { id: itemId },
    data: updateData,
  });
}

/**
 * Accept a quote for an item
 * - Marks previous accepted quote as not accepted
 * - Marks new quote as accepted
 * - Updates item with accepted quote reference and pricing
 * - Syncs status to QUOTE_APPROVED
 */
export async function acceptQuoteForItem(
  roomFFEItemId: string,
  supplierQuoteLineItemId: string,
  userId: string,
  markupPercent?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.$transaction(async (tx) => {
      // 1. Get the quote line item with supplier info
      const quoteLineItem = await tx.supplierQuoteLineItem.findUnique({
        where: { id: supplierQuoteLineItemId },
        include: {
          supplierQuote: {
            include: {
              supplierRFQ: {
                select: {
                  supplierId: true,
                  vendorName: true,
                },
              },
            },
          },
        },
      });

      if (!quoteLineItem) {
        throw new Error('Quote line item not found');
      }

      // 2. Clear any previous accepted quote for this item
      await tx.supplierQuoteLineItem.updateMany({
        where: {
          roomFFEItemId,
          isAccepted: true,
          id: { not: supplierQuoteLineItemId },
        },
        data: {
          isAccepted: false,
        },
      });

      // 3. Mark the new quote as accepted
      await tx.supplierQuoteLineItem.update({
        where: { id: supplierQuoteLineItemId },
        data: {
          isAccepted: true,
          acceptedAt: new Date(),
          acceptedById: userId,
          matchApproved: true,
          matchApprovedAt: new Date(),
          matchApprovedById: userId,
          roomFFEItemId, // Ensure direct link is set
          approvedMarkupPercent: markupPercent,
        },
      });

      // 4. Update the RoomFFEItem
      const supplierRFQ = quoteLineItem.supplierQuote.supplierRFQ;
      await tx.roomFFEItem.update({
        where: { id: roomFFEItemId },
        data: {
          acceptedQuoteLineItemId: supplierQuoteLineItemId,
          tradePrice: quoteLineItem.unitPrice,
          supplierId: supplierRFQ.supplierId,
          supplierName: supplierRFQ.vendorName,
          specStatus: 'QUOTE_APPROVED',
          markupPercent: markupPercent,
        },
      });

      // 5. Log activity
      await tx.itemActivity.create({
        data: {
          itemId: roomFFEItemId,
          type: 'QUOTE_ACCEPTED',
          title: 'Quote Accepted',
          description: `Quote accepted at $${quoteLineItem.unitPrice} per unit`,
          actorId: userId,
          actorType: 'user',
          metadata: {
            supplierQuoteLineItemId,
            unitPrice: quoteLineItem.unitPrice.toString(),
            supplierName: supplierRFQ.vendorName,
          },
        },
      });
    });

    return { success: true };
  } catch (error) {
    console.error('Error accepting quote:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get all quotes for an item for comparison
 */
export async function getItemQuotes(roomFFEItemId: string) {
  // Get quotes through direct link
  const directQuotes = await prisma.supplierQuoteLineItem.findMany({
    where: { roomFFEItemId },
    include: {
      supplierQuote: {
        include: {
          supplierRFQ: {
            select: {
              supplierId: true,
              vendorName: true,
              vendorEmail: true,
            },
          },
        },
      },
      acceptedBy: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Get quotes through RFQ line items (for items without direct link yet)
  const rfqQuotes = await prisma.supplierQuoteLineItem.findMany({
    where: {
      rfqLineItem: {
        roomFFEItemId,
      },
      roomFFEItemId: null, // Only get ones not already directly linked
    },
    include: {
      supplierQuote: {
        include: {
          supplierRFQ: {
            select: {
              supplierId: true,
              vendorName: true,
              vendorEmail: true,
            },
          },
        },
      },
      acceptedBy: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const allQuotes = [...directQuotes, ...rfqQuotes];

  // Find the lowest price for comparison
  const prices = allQuotes.map(q => Number(q.unitPrice));
  const lowestPrice = Math.min(...prices);

  return allQuotes.map(quote => ({
    quoteLineItemId: quote.id,
    supplierQuoteId: quote.supplierQuoteId,
    supplierName: quote.supplierQuote.supplierRFQ.vendorName || 'Unknown Supplier',
    supplierEmail: quote.supplierQuote.supplierRFQ.vendorEmail,

    unitPrice: Number(quote.unitPrice),
    quantity: quote.quantity,
    totalPrice: Number(quote.totalPrice),
    currency: quote.currency,

    leadTime: quote.leadTime,
    availability: quote.availability,

    submittedAt: quote.supplierQuote.submittedAt,
    isAccepted: quote.isAccepted,
    acceptedAt: quote.acceptedAt,
    acceptedBy: quote.acceptedBy,

    isLatestVersion: quote.isLatestVersion,
    quoteVersion: quote.quoteVersion,

    // Comparison helpers
    priceDifference: Number(quote.unitPrice) - lowestPrice,
    percentDifference: lowestPrice > 0
      ? ((Number(quote.unitPrice) - lowestPrice) / lowestPrice) * 100
      : 0,
    isLowestPrice: Number(quote.unitPrice) === lowestPrice,
  }));
}

/**
 * Handle new quote from same supplier - version tracking
 */
export async function handleNewQuoteVersion(
  newQuoteLineItemId: string,
  roomFFEItemId: string,
  supplierId: string | null,
  vendorName: string | null
): Promise<void> {
  // Find existing quote from same supplier for this item
  const existingQuote = await prisma.supplierQuoteLineItem.findFirst({
    where: {
      roomFFEItemId,
      isLatestVersion: true,
      supplierQuote: {
        supplierRFQ: supplierId
          ? { supplierId }
          : { vendorName },
      },
      id: { not: newQuoteLineItemId },
    },
  });

  if (existingQuote) {
    await prisma.$transaction([
      // Mark old as not latest
      prisma.supplierQuoteLineItem.update({
        where: { id: existingQuote.id },
        data: { isLatestVersion: false },
      }),
      // Link new to old as newer version
      prisma.supplierQuoteLineItem.update({
        where: { id: newQuoteLineItemId },
        data: {
          previousVersionId: existingQuote.id,
          quoteVersion: existingQuote.quoteVersion + 1,
          isLatestVersion: true,
          roomFFEItemId,
        },
      }),
    ]);
  } else {
    // First quote from this supplier - just set the direct link
    await prisma.supplierQuoteLineItem.update({
      where: { id: newQuoteLineItemId },
      data: {
        roomFFEItemId,
        isLatestVersion: true,
        quoteVersion: 1,
      },
    });
  }
}

/**
 * Get procurement summary for an item
 */
export async function getItemProcurementSummary(roomFFEItemId: string) {
  const item = await prisma.roomFFEItem.findUnique({
    where: { id: roomFFEItemId },
    include: {
      acceptedQuoteLineItem: {
        include: {
          supplierQuote: {
            include: {
              supplierRFQ: true,
            },
          },
        },
      },
      rfqLineItems: {
        include: {
          rfq: true,
          quoteLineItems: true,
        },
      },
      clientQuoteLineItems: {
        include: {
          clientQuote: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      orderItems: {
        include: {
          order: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });

  if (!item) return null;

  // RFQ Stage
  const rfqLineItems = item.rfqLineItems || [];
  const hasRFQ = rfqLineItems.length > 0;
  const rfqsSent = rfqLineItems.filter(li => li.rfq.status !== 'DRAFT');
  const quotesReceived = rfqLineItems.flatMap(li => li.quoteLineItems);

  // Quote Stage
  const allQuotes = await getItemQuotes(roomFFEItemId);
  const acceptedQuote = item.acceptedQuoteLineItem;

  // Budget/Client Quote Stage
  const clientQuoteLines = item.clientQuoteLineItems || [];
  const latestClientQuote = clientQuoteLines[0]?.clientQuote;

  // Order Stage
  const orderItems = item.orderItems || [];
  const latestOrder = orderItems[0]?.order;

  return {
    item: {
      id: item.id,
      name: item.name,
      sku: item.sku,
      specStatus: item.specStatus,
      paymentStatus: item.paymentStatus,
    },

    rfq: {
      status: !hasRFQ ? 'not_requested' : rfqsSent.length > 0 ? 'sent' : 'draft',
      rfqCount: rfqLineItems.length,
      rfqsSent: rfqsSent.length,
      quotesReceived: quotesReceived.length,
    },

    quote: {
      status: !allQuotes.length ? 'no_quotes' : acceptedQuote ? 'accepted' : 'pending_review',
      acceptedQuote: acceptedQuote ? {
        id: acceptedQuote.id,
        supplierName: acceptedQuote.supplierQuote.supplierRFQ.vendorName,
        unitPrice: Number(acceptedQuote.unitPrice),
        acceptedAt: acceptedQuote.acceptedAt,
      } : null,
      alternativeQuotes: allQuotes.filter(q => !q.isAccepted),
      totalQuotes: allQuotes.length,
    },

    budget: {
      status: !latestClientQuote ? 'not_quoted' : latestClientQuote.status,
      clientQuoteId: latestClientQuote?.id,
      clientQuoteNumber: latestClientQuote?.quoteNumber,
      clientPrice: clientQuoteLines[0] ? Number(clientQuoteLines[0].clientTotalPrice) : null,
      sentAt: latestClientQuote?.sentToClientAt,
    },

    invoice: {
      status: item.paymentStatus,
      paidAmount: item.paidAmount ? Number(item.paidAmount) : null,
      paidAt: item.paidAt,
    },

    order: {
      status: !latestOrder ? 'not_ordered' : latestOrder.status,
      orderId: latestOrder?.id,
      orderNumber: latestOrder?.orderNumber,
      orderedAt: latestOrder?.orderedAt,
      expectedDelivery: latestOrder?.expectedDelivery,
      actualDelivery: latestOrder?.actualDelivery,
      trackingNumber: latestOrder?.trackingNumber,
    },

    activities: item.activities,
  };
}
