/**
 * Activity Logger - Domain-specific helpers for logging activities
 * Makes it easy and consistent to log ActivityLog entries with rich context
 */

import { AuthSession, ActivityActions, EntityTypes, logActivity } from './attribution'
import { prisma } from './prisma'

// ============================================================================
// Types
// ============================================================================

interface BaseActivityContext {
  ipAddress?: string
  userAgent?: string
  entityUrl?: string
}

interface ProjectActivityContext extends BaseActivityContext {
  projectId: string
  projectName?: string
  previousStatus?: string
  newStatus?: string
  clientName?: string
}

interface RoomActivityContext extends BaseActivityContext {
  roomId: string
  roomName?: string
  projectId?: string
  projectName?: string
  previousStatus?: string
  newStatus?: string
}

interface StageActivityContext extends BaseActivityContext {
  stageId: string
  stageName?: string
  projectId?: string
  projectName?: string
  roomId?: string
  roomName?: string
  assignedTo?: string
  assignedToName?: string
  previousStatus?: string
  newStatus?: string
}

interface AssetActivityContext extends BaseActivityContext {
  assetId: string
  assetName?: string
  fileName?: string
  projectId?: string
  projectName?: string
  roomId?: string
  roomName?: string
  stageId?: string
  stageName?: string
  size?: number
  mimeType?: string
  tagName?: string
}

interface CommentActivityContext extends BaseActivityContext {
  commentId: string
  entityType?: string
  projectId?: string
  projectName?: string
  roomId?: string
  roomName?: string
  stageId?: string
  stageName?: string
  mentions?: string[]
  messagePreview?: string
  tagName?: string
}

interface IssueActivityContext extends BaseActivityContext {
  issueId: string
  title?: string
  projectId?: string
  projectName?: string
  roomId?: string
  roomName?: string
  stageId?: string
  stageName?: string
  assigneeId?: string
  assigneeName?: string
  previousStatus?: string
  newStatus?: string
  priority?: string
}

interface ChatActivityContext extends BaseActivityContext {
  messageId: string
  channelId?: string
  channelName?: string
  stageId?: string
  stageName?: string
  mentions?: string[]
  messagePreview?: string
}

interface RenderingActivityContext extends BaseActivityContext {
  versionId: string
  version?: string
  roomId?: string
  roomName?: string
  stageId?: string
  stageName?: string
  projectId?: string
  projectName?: string
  status?: string
}

interface DrawingActivityContext extends BaseActivityContext {
  stageId: string
  stageName?: string
  projectId?: string
  projectName?: string
  roomId?: string
  roomName?: string
  assetId?: string
  fileName?: string
  checklistItemId?: string
  checklistItemName?: string
}

interface FFEActivityContext extends BaseActivityContext {
  itemId: string
  itemName?: string
  roomId?: string
  roomName?: string
  projectId?: string
  projectName?: string
  previousStatus?: string
  newStatus?: string
  category?: string
}

interface ApprovalActivityContext extends BaseActivityContext {
  versionId: string
  version?: string
  stageId?: string
  stageName?: string
  projectId?: string
  projectName?: string
  roomId?: string
  roomName?: string
  decision?: string
  type?: string
}

interface DesignActivityContext extends BaseActivityContext {
  itemId: string
  itemName?: string
  sectionId?: string
  sectionType?: string
  stageId?: string
  stageName?: string
  projectId?: string
  projectName?: string
  roomId?: string
  roomName?: string
  completed?: boolean
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Safely parse entity URL to avoid circular references
 */
function sanitizeContext(ctx: any): any {
  const clean: any = {}
  
  // Only include serializable properties
  for (const [key, value] of Object.entries(ctx)) {
    if (value !== undefined && value !== null && typeof value !== 'function') {
      clean[key] = value
    }
  }
  
  return clean
}

/**
 * Enrich context with missing names by fetching from database
 */
async function enrichProjectContext(ctx: ProjectActivityContext): Promise<ProjectActivityContext> {
  if (ctx.projectName) return ctx
  
  try {
    const project = await prisma.project.findUnique({
      where: { id: ctx.projectId },
      select: { name: true }
    })
    
    if (project) {
      ctx.projectName = project.name
    }
  } catch (error) {
    console.error('Failed to enrich project context:', error)
  }
  
  return ctx
}

async function enrichRoomContext(ctx: RoomActivityContext): Promise<RoomActivityContext> {
  if (ctx.roomName && ctx.projectName) return ctx
  
  try {
    const room = await prisma.room.findUnique({
      where: { id: ctx.roomId },
      select: { 
        name: true,
        type: true,
        project: { select: { id: true, name: true } }
      }
    })
    
    if (room) {
      ctx.roomName = ctx.roomName || room.name || room.type
      ctx.projectId = ctx.projectId || room.project.id
      ctx.projectName = ctx.projectName || room.project.name
    }
  } catch (error) {
    console.error('Failed to enrich room context:', error)
  }
  
  return ctx
}

async function enrichStageContext(ctx: StageActivityContext): Promise<StageActivityContext> {
  if (ctx.stageName && ctx.projectName && ctx.roomName) return ctx
  
  try {
    const stage = await prisma.stage.findUnique({
      where: { id: ctx.stageId },
      select: { 
        type: true,
        room: { 
          select: { 
            id: true,
            name: true,
            type: true,
            project: { select: { id: true, name: true } }
          } 
        }
      }
    })
    
    if (stage) {
      ctx.stageName = ctx.stageName || stage.type
      ctx.roomId = ctx.roomId || stage.room.id
      ctx.roomName = ctx.roomName || stage.room.name || stage.room.type
      ctx.projectId = ctx.projectId || stage.room.project.id
      ctx.projectName = ctx.projectName || stage.room.project.name
    }
  } catch (error) {
    console.error('Failed to enrich stage context:', error)
  }
  
  return ctx
}

// ============================================================================
// Domain-Specific Logging Functions
// ============================================================================

/**
 * Log project-related activities
 */
export async function logProjectActivity(
  session: AuthSession,
  action: string,
  ctx: ProjectActivityContext
): Promise<void> {
  const enriched = await enrichProjectContext(ctx)
  
  await logActivity({
    session,
    action,
    entity: EntityTypes.PROJECT,
    entityId: enriched.projectId,
    details: sanitizeContext(enriched),
    ipAddress: enriched.ipAddress,
    userAgent: enriched.userAgent
  })
}

/**
 * Log room-related activities
 */
export async function logRoomActivity(
  session: AuthSession,
  action: string,
  ctx: RoomActivityContext
): Promise<void> {
  const enriched = await enrichRoomContext(ctx)
  
  await logActivity({
    session,
    action,
    entity: EntityTypes.ROOM,
    entityId: enriched.roomId,
    details: sanitizeContext(enriched),
    ipAddress: enriched.ipAddress,
    userAgent: enriched.userAgent
  })
}

/**
 * Log stage-related activities
 */
export async function logStageActivity(
  session: AuthSession,
  action: string,
  ctx: StageActivityContext
): Promise<void> {
  const enriched = await enrichStageContext(ctx)
  
  await logActivity({
    session,
    action,
    entity: EntityTypes.STAGE,
    entityId: enriched.stageId,
    details: sanitizeContext(enriched),
    ipAddress: enriched.ipAddress,
    userAgent: enriched.userAgent
  })
}

/**
 * Log asset upload specifically
 */
export async function logAssetUpload(
  session: AuthSession,
  ctx: AssetActivityContext
): Promise<void> {
  await logActivity({
    session,
    action: ActivityActions.ASSET_UPLOADED,
    entity: EntityTypes.ASSET,
    entityId: ctx.assetId,
    details: sanitizeContext(ctx),
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent
  })
}

/**
 * Log general asset activities (delete, tag, pin, etc.)
 */
export async function logAssetActivity(
  session: AuthSession,
  action: string,
  ctx: AssetActivityContext
): Promise<void> {
  await logActivity({
    session,
    action,
    entity: EntityTypes.ASSET,
    entityId: ctx.assetId,
    details: sanitizeContext(ctx),
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent
  })
}

/**
 * Log comment-related activities
 */
export async function logCommentActivity(
  session: AuthSession,
  action: string,
  ctx: CommentActivityContext
): Promise<void> {
  await logActivity({
    session,
    action,
    entity: EntityTypes.COMMENT,
    entityId: ctx.commentId,
    details: sanitizeContext(ctx),
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent
  })
}

/**
 * Log issue-related activities
 */
export async function logIssueActivity(
  session: AuthSession,
  action: string,
  ctx: IssueActivityContext
): Promise<void> {
  await logActivity({
    session,
    action,
    entity: EntityTypes.ISSUE,
    entityId: ctx.issueId,
    details: sanitizeContext(ctx),
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent
  })
}

/**
 * Log chat-related activities
 */
export async function logChatActivity(
  session: AuthSession,
  action: string,
  ctx: ChatActivityContext
): Promise<void> {
  await logActivity({
    session,
    action,
    entity: EntityTypes.CHAT_MESSAGE,
    entityId: ctx.messageId,
    details: sanitizeContext(ctx),
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent
  })
}

/**
 * Log rendering-related activities
 */
export async function logRenderingActivity(
  session: AuthSession,
  action: string,
  ctx: RenderingActivityContext
): Promise<void> {
  await logActivity({
    session,
    action,
    entity: EntityTypes.RENDERING_VERSION,
    entityId: ctx.versionId,
    details: sanitizeContext(ctx),
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent
  })
}

/**
 * Log drawing-related activities
 */
export async function logDrawingActivity(
  session: AuthSession,
  action: string,
  ctx: DrawingActivityContext
): Promise<void> {
  await logActivity({
    session,
    action,
    entity: EntityTypes.DRAWING,
    entityId: ctx.stageId,
    details: sanitizeContext(ctx),
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent
  })
}

/**
 * Log FFE-related activities
 */
export async function logFFEActivity(
  session: AuthSession,
  action: string,
  ctx: FFEActivityContext
): Promise<void> {
  await logActivity({
    session,
    action,
    entity: EntityTypes.FFE_ITEM,
    entityId: ctx.itemId,
    details: sanitizeContext(ctx),
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent
  })
}

/**
 * Log approval-related activities
 */
export async function logApprovalActivity(
  session: AuthSession,
  action: string,
  ctx: ApprovalActivityContext
): Promise<void> {
  const entityType = ctx.type === 'floorplan' ? EntityTypes.FLOORPLAN_APPROVAL : EntityTypes.CLIENT_APPROVAL_VERSION
  
  await logActivity({
    session,
    action,
    entity: entityType,
    entityId: ctx.versionId,
    details: sanitizeContext(ctx),
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent
  })
}

/**
 * Log design-related activities (sections, items, notes)
 */
export async function logDesignActivity(
  session: AuthSession,
  action: string,
  ctx: DesignActivityContext
): Promise<void> {
  // Determine entity type based on action
  let entityType = EntityTypes.DESIGN_ITEM
  if (action.includes('SECTION')) {
    entityType = EntityTypes.DESIGN_SECTION
  } else if (action.includes('NOTE')) {
    entityType = EntityTypes.DESIGN_NOTE
  }
  
  await logActivity({
    session,
    action,
    entity: entityType,
    entityId: ctx.itemId,
    details: sanitizeContext(ctx),
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent
  })
}

/**
 * Log checklist-related activities
 */
export async function logChecklistActivity(
  session: AuthSession,
  action: string,
  ctx: { checklistItemId: string } & BaseActivityContext
): Promise<void> {
  await logActivity({
    session,
    action,
    entity: EntityTypes.CHECKLIST_ITEM,
    entityId: ctx.checklistItemId,
    details: sanitizeContext(ctx),
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent
  })
}

/**
 * Log tag-related activities
 */
export async function logTagActivity(
  session: AuthSession,
  action: string,
  ctx: { tagId: string; tagName?: string } & BaseActivityContext
): Promise<void> {
  await logActivity({
    session,
    action,
    entity: EntityTypes.TAG,
    entityId: ctx.tagId,
    details: sanitizeContext(ctx),
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent
  })
}

/**
 * Log user/team-related activities
 */
export async function logUserActivity(
  session: AuthSession,
  action: string,
  ctx: { userId: string; userName?: string; previousRole?: string; newRole?: string } & BaseActivityContext
): Promise<void> {
  await logActivity({
    session,
    action,
    entity: EntityTypes.USER,
    entityId: ctx.userId,
    details: sanitizeContext(ctx),
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent
  })
}

// Re-export attribution helpers for convenience
export { ActivityActions, EntityTypes, logActivity } from './attribution'
