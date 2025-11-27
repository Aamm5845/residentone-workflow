-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('OWNER', 'ADMIN', 'DESIGNER', 'RENDERER', 'DRAFTER', 'FFE', 'VIEWER');

-- CreateEnum
CREATE TYPE "public"."UserApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."ContractorType" AS ENUM ('CONTRACTOR', 'SUBCONTRACTOR');

-- CreateEnum
CREATE TYPE "public"."ProjectType" AS ENUM ('RESIDENTIAL', 'COMMERCIAL', 'HOSPITALITY');

-- CreateEnum
CREATE TYPE "public"."ProjectStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'ON_HOLD', 'URGENT', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."RoomType" AS ENUM ('ENTRANCE', 'FOYER', 'STAIRCASE', 'LIVING_ROOM', 'DINING_ROOM', 'KITCHEN', 'STUDY_ROOM', 'OFFICE', 'PLAYROOM', 'MASTER_BEDROOM', 'GIRLS_ROOM', 'BOYS_ROOM', 'GUEST_BEDROOM', 'POWDER_ROOM', 'MASTER_BATHROOM', 'FAMILY_BATHROOM', 'GIRLS_BATHROOM', 'BOYS_BATHROOM', 'GUEST_BATHROOM', 'LAUNDRY_ROOM', 'SUKKAH', 'BEDROOM', 'BATHROOM', 'FAMILY_ROOM', 'HALLWAY', 'PANTRY', 'LAUNDRY', 'MUDROOM', 'CLOSET', 'OUTDOOR', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."RoomStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'NEEDS_ATTENTION');

-- CreateEnum
CREATE TYPE "public"."StageType" AS ENUM ('DESIGN', 'DESIGN_CONCEPT', 'THREE_D', 'CLIENT_APPROVAL', 'DRAWINGS', 'FFE');

-- CreateEnum
CREATE TYPE "public"."StageStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'NEEDS_ATTENTION', 'PENDING_APPROVAL', 'REVISION_REQUESTED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "public"."TagType" AS ENUM ('MUST_HAVE', 'OPTIONAL', 'EXPLORE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "public"."FFEItemState" AS ENUM ('PENDING', 'UNDECIDED', 'SELECTED', 'CONFIRMED', 'NOT_NEEDED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."FFETemplateStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."FFEInstanceStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."FFEItemVisibility" AS ENUM ('VISIBLE', 'HIDDEN');

-- CreateEnum
CREATE TYPE "public"."FFEStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SOURCING', 'PROPOSED', 'APPROVED', 'ORDERED', 'DELIVERED', 'COMPLETED', 'NOT_NEEDED');

-- CreateEnum
CREATE TYPE "public"."ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REVISION_REQUESTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."ClientApprovalStageStatus" AS ENUM ('DRAFT', 'PENDING_AARON_APPROVAL', 'READY_FOR_CLIENT', 'SENT_TO_CLIENT', 'CLIENT_REVIEWING', 'FOLLOW_UP_REQUIRED', 'CLIENT_APPROVED', 'REVISION_REQUESTED');

-- CreateEnum
CREATE TYPE "public"."FloorplanApprovalStatus" AS ENUM ('DRAFT', 'PENDING_AARON_APPROVAL', 'READY_FOR_CLIENT', 'SENT_TO_CLIENT', 'CLIENT_REVIEWING', 'FOLLOW_UP_REQUIRED', 'CLIENT_APPROVED', 'REVISION_REQUESTED');

-- CreateEnum
CREATE TYPE "public"."AssetType" AS ENUM ('IMAGE', 'PDF', 'DOCUMENT', 'LINK', 'RENDER', 'DRAWING', 'FLOORPLAN_PDF', 'FLOORPLAN_CAD', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('STAGE_ASSIGNED', 'STAGE_COMPLETED', 'MENTION', 'CHAT_MESSAGE', 'MESSAGE_REACTION', 'DUE_DATE_REMINDER', 'PROJECT_UPDATE');

-- CreateEnum
CREATE TYPE "public"."TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."RenderingVersionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'PUSHED_TO_CLIENT');

-- CreateEnum
CREATE TYPE "public"."DrawingChecklistType" AS ENUM ('LIGHTING', 'ELEVATION', 'MILLWORK', 'FLOORPLAN', 'CUSTOM');

-- CreateEnum
CREATE TYPE "public"."IssueType" AS ENUM ('BUG', 'FEATURE_REQUEST', 'UPDATE_REQUEST', 'GENERAL');

-- CreateEnum
CREATE TYPE "public"."IssuePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "public"."IssueStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."ProjectUpdateType" AS ENUM ('GENERAL', 'PHOTO', 'TASK', 'DOCUMENT', 'COMMUNICATION', 'MILESTONE', 'INSPECTION', 'ISSUE');

-- CreateEnum
CREATE TYPE "public"."ProjectUpdateCategory" AS ENUM ('GENERAL', 'PROGRESS', 'QUALITY', 'SAFETY', 'BUDGET', 'SCHEDULE', 'COMMUNICATION', 'APPROVAL');

-- CreateEnum
CREATE TYPE "public"."ProjectUpdateStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED', 'ON_HOLD', 'REQUIRES_ATTENTION');

-- CreateEnum
CREATE TYPE "public"."PriorityLevel" AS ENUM ('URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NORMAL');

-- CreateEnum
CREATE TYPE "public"."DocumentType" AS ENUM ('PLAN', 'SPECIFICATION', 'CHANGE_ORDER', 'PERMIT', 'INSPECTION_REPORT', 'PHOTO', 'VIDEO', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."MessageType" AS ENUM ('MESSAGE', 'SYSTEM', 'NOTIFICATION', 'URGENT', 'REMINDER');

-- CreateEnum
CREATE TYPE "public"."AssignmentStatus" AS ENUM ('ASSIGNED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "public"."NotificationMethod" AS ENUM ('EMAIL', 'SMS', 'PUSH', 'IN_APP');

-- CreateEnum
CREATE TYPE "public"."MilestoneType" AS ENUM ('CUSTOM', 'PHASE_COMPLETION', 'CLIENT_APPROVAL', 'INSPECTION', 'DELIVERY', 'PAYMENT');

-- CreateEnum
CREATE TYPE "public"."MilestoneStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "public"."SpecBookSectionType" AS ENUM ('FLOORPLANS', 'LIGHTING', 'ELECTRICAL', 'PLUMBING', 'STRUCTURAL', 'RCP', 'ROOM', 'DRAWINGS');

-- CreateEnum
CREATE TYPE "public"."SpecBookGenStatus" AS ENUM ('GENERATING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "public"."PasswordResetToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "role" "public"."UserRole" NOT NULL DEFAULT 'DESIGNER',
    "orgId" TEXT,
    "phoneNumber" TEXT,
    "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smsNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "approvalStatus" "public"."UserApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "company" TEXT,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Contractor" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "type" "public"."ContractorType" NOT NULL DEFAULT 'CONTRACTOR',
    "specialty" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contractor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProjectContractor" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "role" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectContractor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "public"."ProjectType" NOT NULL DEFAULT 'RESIDENTIAL',
    "status" "public"."ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "clientId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "budget" DOUBLE PRECISION,
    "dropboxFolder" TEXT,
    "orgId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "coverImages" JSONB,
    "address" TEXT,
    "streetAddress" TEXT,
    "city" TEXT,
    "province" TEXT,
    "postalCode" TEXT,
    "hasFloorplanApproval" BOOLEAN NOT NULL DEFAULT true,
    "hasSpecBook" BOOLEAN NOT NULL DEFAULT true,
    "hasProjectUpdates" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RoomSection" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Room" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sectionId" TEXT,
    "type" "public"."RoomType" NOT NULL,
    "name" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "status" "public"."RoomStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "currentStage" TEXT,
    "progressFFE" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Stage" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "type" "public"."StageType" NOT NULL,
    "status" "public"."StageStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "assignedTo" TEXT,
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SmsConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DesignSection" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "updatedById" TEXT,
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."TagType" NOT NULL DEFAULT 'CUSTOM',
    "color" TEXT,
    "description" TEXT,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AssetTag" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CommentTag" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AssetPin" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetPin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CommentPin" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentPin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CommentLike" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChecklistItem" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FFEItem" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "public"."FFEStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "supplierLink" TEXT,
    "notes" TEXT,
    "price" DOUBLE PRECISION,
    "leadTime" TEXT,
    "category" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FFEItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FFEItemStatus" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "selectionType" TEXT,
    "isCustomExpanded" BOOLEAN NOT NULL DEFAULT false,
    "subItemStates" JSONB DEFAULT '{}',
    "customOptions" JSONB,
    "standardProduct" JSONB,
    "notes" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,

    CONSTRAINT "FFEItemStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClientApprovalVersion" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "renderingVersionId" TEXT,
    "version" TEXT NOT NULL,
    "status" "public"."ClientApprovalStageStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedByAaron" BOOLEAN NOT NULL DEFAULT false,
    "aaronApprovedAt" TIMESTAMP(3),
    "aaronApprovedById" TEXT,
    "sentToClientAt" TIMESTAMP(3),
    "sentById" TEXT,
    "emailOpenedAt" TIMESTAMP(3),
    "followUpCompletedAt" TIMESTAMP(3),
    "followUpNotes" TEXT,
    "clientDecision" "public"."ApprovalStatus" DEFAULT 'PENDING',
    "clientDecidedAt" TIMESTAMP(3),
    "clientMessage" TEXT,
    "notes" TEXT,
    "followUpSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientApprovalVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClientApprovalAsset" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "includeInEmail" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "blobUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientApprovalAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClientApprovalEmailLog" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "followUpSentAt" TIMESTAMP(3),
    "trackingPixelId" TEXT NOT NULL,

    CONSTRAINT "ClientApprovalEmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClientApprovalActivity" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "userId" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientApprovalActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FloorplanApprovalVersion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "public"."FloorplanApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedByAaron" BOOLEAN NOT NULL DEFAULT false,
    "aaronApprovedAt" TIMESTAMP(3),
    "aaronApprovedById" TEXT,
    "sentToClientAt" TIMESTAMP(3),
    "sentById" TEXT,
    "emailOpenedAt" TIMESTAMP(3),
    "followUpCompletedAt" TIMESTAMP(3),
    "followUpNotes" TEXT,
    "clientDecision" "public"."ApprovalStatus" DEFAULT 'PENDING',
    "clientDecidedAt" TIMESTAMP(3),
    "clientMessage" TEXT,
    "notes" TEXT,
    "followUpSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FloorplanApprovalVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FloorplanApprovalAsset" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "includeInEmail" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FloorplanApprovalAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FloorplanApprovalEmailLog" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "followUpSentAt" TIMESTAMP(3),
    "trackingPixelId" TEXT NOT NULL,

    CONSTRAINT "FloorplanApprovalEmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FloorplanApprovalActivity" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "userId" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FloorplanApprovalActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Approval" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "roomId" TEXT,
    "token" TEXT NOT NULL,
    "status" "public"."ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "sentById" TEXT,
    "decidedById" TEXT,
    "sentAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "message" TEXT,
    "revisionReason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Comment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "projectId" TEXT,
    "roomId" TEXT,
    "stageId" TEXT,
    "sectionId" TEXT,
    "ffeItemId" TEXT,
    "approvalId" TEXT,
    "mentions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChatMessage" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "parentMessageId" TEXT,
    "imageUrl" TEXT,
    "imageFileName" TEXT,
    "attachments" JSONB,
    "editedAt" TIMESTAMP(3),
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChatMention" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "mentionedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChatMessageReaction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessageReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Asset" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "filename" TEXT,
    "url" TEXT NOT NULL,
    "type" "public"."AssetType" NOT NULL,
    "size" INTEGER,
    "mimeType" TEXT,
    "provider" TEXT,
    "metadata" TEXT,
    "description" TEXT,
    "userDescription" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT,
    "roomId" TEXT,
    "stageId" TEXT,
    "sectionId" TEXT,
    "ffeItemId" TEXT,
    "approvalId" TEXT,
    "commentId" TEXT,
    "renderingVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "drawingChecklistItemId" TEXT,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "public"."NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "relatedId" TEXT,
    "relatedType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NotificationSend" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "messageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "errorMessage" TEXT,
    "customMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationSend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RoomPreset" (
    "id" TEXT NOT NULL,
    "roomType" "public"."RoomType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ffeItems" TEXT NOT NULL,
    "sections" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "public"."TaskStatus" NOT NULL DEFAULT 'TODO',
    "assignedTo" TEXT,
    "projectId" TEXT,
    "roomId" TEXT,
    "stageId" TEXT,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "lastSeen" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmailLog" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" TIMESTAMP(3),
    "type" TEXT NOT NULL,
    "metadata" JSONB,
    "deliveryStatus" TEXT DEFAULT 'PENDING',
    "deliveryError" TEXT,
    "providerId" TEXT,
    "provider" TEXT,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClientApproval" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "approvedBy" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decision" TEXT NOT NULL,
    "comments" TEXT,

    CONSTRAINT "ClientApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Activity" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "userId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RenderingVersion" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "customName" TEXT,
    "status" "public"."RenderingVersionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "pushedToClientAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RenderingVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RenderingNote" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RenderingNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DrawingChecklistItem" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "type" "public"."DrawingChecklistType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DrawingChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ActivityLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" JSONB,
    "ipAddress" TEXT,
    "orgId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClientAccessToken" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "name" TEXT,
    "specsUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastAccessedAt" TIMESTAMP(3),
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessedIP" TEXT,

    CONSTRAINT "ClientAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClientAccessLog" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PhaseAccessToken" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "name" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastAccessedAt" TIMESTAMP(3),
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessedIP" TEXT,

    CONSTRAINT "PhaseAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PhaseAccessLog" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhaseAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Issue" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "public"."IssueType" NOT NULL DEFAULT 'GENERAL',
    "priority" "public"."IssuePriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "public"."IssueStatus" NOT NULL DEFAULT 'OPEN',
    "reportedBy" TEXT NOT NULL,
    "assignedTo" TEXT,
    "resolvedBy" TEXT,
    "orgId" TEXT,
    "projectId" TEXT,
    "roomId" TEXT,
    "stageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IssueComment" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IssueComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FFELibraryItem" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "roomTypes" TEXT[],
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "itemType" TEXT NOT NULL DEFAULT 'base',
    "hasStandardOption" BOOLEAN NOT NULL DEFAULT false,
    "hasCustomOption" BOOLEAN NOT NULL DEFAULT false,
    "standardConfig" JSONB,
    "customConfig" JSONB,
    "dependsOn" TEXT[],
    "showWhen" JSONB,
    "isStandard" BOOLEAN NOT NULL DEFAULT true,
    "subItems" JSONB,
    "notes" TEXT,
    "addedFromProjectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,

    CONSTRAINT "FFELibraryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FFEGeneralSettings" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "roomType" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,

    CONSTRAINT "FFEGeneralSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FFEAuditLog" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "notes" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FFEAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FFEBathroomState" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "categorySelections" TEXT NOT NULL DEFAULT '[]',
    "itemStatuses" TEXT NOT NULL DEFAULT '[]',
    "completionPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,

    CONSTRAINT "FFEBathroomState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FFETemplate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "public"."FFETemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "tags" TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,

    CONSTRAINT "FFETemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FFETemplateSection" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isCollapsible" BOOLEAN NOT NULL DEFAULT true,
    "icon" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FFETemplateSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FFETemplateItem" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultState" "public"."FFEItemState" NOT NULL DEFAULT 'PENDING',
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT,
    "tags" TEXT[],
    "estimatedCost" DECIMAL(65,30),
    "leadTimeWeeks" INTEGER,
    "supplierInfo" JSONB,
    "customFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FFETemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RoomFFEInstance" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "templateId" TEXT,
    "name" TEXT NOT NULL,
    "status" "public"."FFEInstanceStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "progress" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "estimatedBudget" DECIMAL(65,30),
    "actualBudget" DECIMAL(65,30),
    "targetCompletionDate" TIMESTAMP(3),
    "actualCompletionDate" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,

    CONSTRAINT "RoomFFEInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RoomFFESection" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "templateSectionId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isExpanded" BOOLEAN NOT NULL DEFAULT true,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomFFESection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RoomFFEItem" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "templateItemId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "state" "public"."FFEItemState" NOT NULL DEFAULT 'PENDING',
    "visibility" "public"."FFEItemVisibility" NOT NULL DEFAULT 'HIDDEN',
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitCost" DECIMAL(65,30),
    "totalCost" DECIMAL(65,30),
    "supplierName" TEXT,
    "supplierLink" TEXT,
    "modelNumber" TEXT,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "attachments" JSONB,
    "customFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,

    CONSTRAINT "RoomFFEItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FFEChangeLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fieldName" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "roomId" TEXT,
    "instanceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FFEChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FFESectionLibrary" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "defaultOrder" INTEGER NOT NULL DEFAULT 0,
    "applicableRoomTypes" "public"."RoomType"[],
    "isGlobal" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FFESectionLibrary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProjectUpdate" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "roomId" TEXT,
    "authorId" TEXT NOT NULL,
    "type" "public"."ProjectUpdateType" NOT NULL DEFAULT 'GENERAL',
    "category" "public"."ProjectUpdateCategory" NOT NULL DEFAULT 'GENERAL',
    "status" "public"."ProjectUpdateStatus" NOT NULL DEFAULT 'ACTIVE',
    "priority" "public"."PriorityLevel" NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT,
    "description" TEXT,
    "location" TEXT,
    "gpsCoordinates" JSONB,
    "metadata" JSONB,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "estimatedCost" DECIMAL(65,30),
    "actualCost" DECIMAL(65,30),
    "timeEstimated" INTEGER,
    "timeLogged" INTEGER,
    "parentUpdateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProjectUpdatePhoto" (
    "id" TEXT NOT NULL,
    "updateId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "caption" TEXT,
    "gpsCoordinates" JSONB,
    "takenAt" TIMESTAMP(3),
    "beforeAfterPairId" TEXT,
    "tags" TEXT[],
    "roomArea" TEXT,
    "tradeCategory" TEXT,
    "isBeforePhoto" BOOLEAN NOT NULL DEFAULT false,
    "isAfterPhoto" BOOLEAN NOT NULL DEFAULT false,
    "annotationsData" JSONB,
    "aiAnalysis" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectUpdatePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProjectUpdateTask" (
    "id" TEXT NOT NULL,
    "updateId" TEXT,
    "projectId" TEXT NOT NULL,
    "roomId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "public"."TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "public"."PriorityLevel" NOT NULL DEFAULT 'MEDIUM',
    "assigneeId" TEXT,
    "contractorId" TEXT,
    "tradeType" TEXT,
    "estimatedHours" DECIMAL(65,30),
    "actualHours" DECIMAL(65,30),
    "estimatedCost" DECIMAL(65,30),
    "actualCost" DECIMAL(65,30),
    "materials" JSONB,
    "dependencies" TEXT[],
    "dueDate" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectUpdateTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProjectUpdateDocument" (
    "id" TEXT NOT NULL,
    "updateId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "documentType" "public"."DocumentType" NOT NULL DEFAULT 'OTHER',
    "version" TEXT NOT NULL,
    "isCurrentVersion" BOOLEAN NOT NULL DEFAULT true,
    "changesFromPrevious" TEXT,
    "approvalStatus" "public"."ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "distributionList" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectUpdateDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProjectUpdateMessage" (
    "id" TEXT NOT NULL,
    "updateId" TEXT NOT NULL,
    "taskId" TEXT,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "messageType" "public"."MessageType" NOT NULL DEFAULT 'MESSAGE',
    "priority" "public"."PriorityLevel" NOT NULL DEFAULT 'NORMAL',
    "parentMessageId" TEXT,
    "mentions" TEXT[],
    "attachments" JSONB,
    "readBy" JSONB,
    "reactions" JSONB,
    "isUrgent" BOOLEAN NOT NULL DEFAULT false,
    "scheduledFor" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectUpdateMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProjectUpdateActivity" (
    "id" TEXT NOT NULL,
    "updateId" TEXT,
    "projectId" TEXT NOT NULL,
    "actorId" TEXT,
    "actionType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectUpdateActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ContractorAssignment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "updateId" TEXT,
    "taskId" TEXT,
    "role" TEXT NOT NULL,
    "status" "public"."AssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "notificationMethod" "public"."NotificationMethod" NOT NULL DEFAULT 'EMAIL',
    "lastNotifiedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProjectMilestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "updateId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "public"."MilestoneType" NOT NULL DEFAULT 'CUSTOM',
    "status" "public"."MilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "percentage" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "targetDate" TIMESTAMP(3),
    "actualDate" TIMESTAMP(3),
    "dependencies" TEXT[],
    "celebrateWithClient" BOOLEAN NOT NULL DEFAULT false,
    "autoGenerateReport" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SpecBook" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,

    CONSTRAINT "SpecBook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SpecBookSection" (
    "id" TEXT NOT NULL,
    "specBookId" TEXT NOT NULL,
    "type" "public"."SpecBookSectionType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "roomId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isIncluded" BOOLEAN NOT NULL DEFAULT true,
    "renderingUrl" TEXT,
    "renderingUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecBookSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DropboxFileLink" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT,
    "drawingChecklistItemId" TEXT,
    "dropboxPath" TEXT NOT NULL,
    "dropboxFileId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "lastModified" TIMESTAMP(3),
    "dropboxRevision" TEXT,
    "cadToPdfCacheUrl" TEXT,
    "uploadedPdfUrl" TEXT,
    "cacheExpiry" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DropboxFileLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SpecBookGeneration" (
    "id" TEXT NOT NULL,
    "specBookId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "public"."SpecBookGenStatus" NOT NULL DEFAULT 'GENERATING',
    "pdfUrl" TEXT,
    "fileSize" INTEGER,
    "pageCount" INTEGER,
    "sectionsIncluded" JSONB NOT NULL,
    "roomsIncluded" JSONB NOT NULL,
    "coverPageData" JSONB NOT NULL,
    "errorMessage" TEXT,
    "generatedById" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "downloadedAt" TIMESTAMP(3),
    "downloadCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SpecBookGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CadPreferences" (
    "id" TEXT NOT NULL,
    "linkedFileId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "layoutName" TEXT,
    "ctbDropboxPath" TEXT,
    "ctbFileId" TEXT,
    "plotArea" TEXT NOT NULL DEFAULT 'extents',
    "window" JSONB,
    "centerPlot" BOOLEAN NOT NULL DEFAULT true,
    "scaleMode" TEXT NOT NULL DEFAULT 'fit',
    "scaleDenominator" INTEGER,
    "keepAspectRatio" BOOLEAN NOT NULL DEFAULT true,
    "margins" JSONB DEFAULT '{"top": 10, "left": 10, "right": 10, "bottom": 10}',
    "paperSize" TEXT DEFAULT 'Auto',
    "orientation" TEXT,
    "dpi" INTEGER DEFAULT 300,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CadPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProjectCadDefaults" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "layoutName" TEXT,
    "ctbDropboxPath" TEXT,
    "ctbFileId" TEXT,
    "plotArea" TEXT NOT NULL DEFAULT 'extents',
    "window" JSONB,
    "centerPlot" BOOLEAN NOT NULL DEFAULT true,
    "scaleMode" TEXT NOT NULL DEFAULT 'fit',
    "scaleDenominator" INTEGER,
    "keepAspectRatio" BOOLEAN NOT NULL DEFAULT true,
    "margins" JSONB DEFAULT '{"top": 10, "left": 10, "right": 10, "bottom": 10}',
    "paperSize" TEXT DEFAULT 'Auto',
    "orientation" TEXT,
    "dpi" INTEGER DEFAULT 300,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectCadDefaults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CadLayoutCache" (
    "id" TEXT NOT NULL,
    "dropboxPath" TEXT NOT NULL,
    "dropboxRevision" TEXT NOT NULL,
    "layouts" JSONB NOT NULL,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CadLayoutCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DesignConceptItemLibrary" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignConceptItemLibrary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DesignConceptItem" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "libraryItemId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "completedByRenderer" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignConceptItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DesignConceptItemImage" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "dropboxPath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "thumbnailUrl" TEXT,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignConceptItemImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DesignConceptItemLink" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "siteName" TEXT,
    "favicon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignConceptItemLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DesignConceptItemNote" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignConceptItemNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DesignConceptItemAttachment" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "dropboxPath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "fileType" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignConceptItemAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DesignConceptCategory" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignConceptCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "public"."Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "public"."Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "public"."VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "public"."VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "public"."PasswordResetToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_email_token_key" ON "public"."PasswordResetToken"("email", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "public"."Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Client_orgId_email_key" ON "public"."Client"("orgId", "email");

-- CreateIndex
CREATE INDEX "Contractor_orgId_type_idx" ON "public"."Contractor"("orgId", "type");

-- CreateIndex
CREATE INDEX "Contractor_orgId_isActive_idx" ON "public"."Contractor"("orgId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Contractor_orgId_email_key" ON "public"."Contractor"("orgId", "email");

-- CreateIndex
CREATE INDEX "ProjectContractor_projectId_idx" ON "public"."ProjectContractor"("projectId");

-- CreateIndex
CREATE INDEX "ProjectContractor_contractorId_idx" ON "public"."ProjectContractor"("contractorId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectContractor_projectId_contractorId_key" ON "public"."ProjectContractor"("projectId", "contractorId");

-- CreateIndex
CREATE INDEX "RoomSection_projectId_idx" ON "public"."RoomSection"("projectId");

-- CreateIndex
CREATE INDEX "RoomSection_projectId_order_idx" ON "public"."RoomSection"("projectId", "order");

-- CreateIndex
CREATE INDEX "Room_projectId_idx" ON "public"."Room"("projectId");

-- CreateIndex
CREATE INDEX "Room_sectionId_idx" ON "public"."Room"("sectionId");

-- CreateIndex
CREATE INDEX "Room_projectId_order_idx" ON "public"."Room"("projectId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Stage_roomId_type_key" ON "public"."Stage"("roomId", "type");

-- CreateIndex
CREATE INDEX "SmsConversation_userId_idx" ON "public"."SmsConversation"("userId");

-- CreateIndex
CREATE INDEX "SmsConversation_phoneNumber_idx" ON "public"."SmsConversation"("phoneNumber");

-- CreateIndex
CREATE INDEX "SmsConversation_stageId_idx" ON "public"."SmsConversation"("stageId");

-- CreateIndex
CREATE INDEX "SmsConversation_lastMessageAt_idx" ON "public"."SmsConversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "SmsConversation_userId_stageId_idx" ON "public"."SmsConversation"("userId", "stageId");

-- CreateIndex
CREATE UNIQUE INDEX "DesignSection_stageId_type_key" ON "public"."DesignSection"("stageId", "type");

-- CreateIndex
CREATE INDEX "Tag_orgId_idx" ON "public"."Tag"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_orgId_name_key" ON "public"."Tag"("orgId", "name");

-- CreateIndex
CREATE INDEX "AssetTag_assetId_idx" ON "public"."AssetTag"("assetId");

-- CreateIndex
CREATE INDEX "AssetTag_tagId_idx" ON "public"."AssetTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetTag_assetId_tagId_key" ON "public"."AssetTag"("assetId", "tagId");

-- CreateIndex
CREATE INDEX "CommentTag_commentId_idx" ON "public"."CommentTag"("commentId");

-- CreateIndex
CREATE INDEX "CommentTag_tagId_idx" ON "public"."CommentTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "CommentTag_commentId_tagId_key" ON "public"."CommentTag"("commentId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetPin_assetId_key" ON "public"."AssetPin"("assetId");

-- CreateIndex
CREATE INDEX "AssetPin_assetId_idx" ON "public"."AssetPin"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "CommentPin_commentId_key" ON "public"."CommentPin"("commentId");

-- CreateIndex
CREATE INDEX "CommentPin_commentId_idx" ON "public"."CommentPin"("commentId");

-- CreateIndex
CREATE INDEX "CommentLike_commentId_idx" ON "public"."CommentLike"("commentId");

-- CreateIndex
CREATE UNIQUE INDEX "CommentLike_userId_commentId_key" ON "public"."CommentLike"("userId", "commentId");

-- CreateIndex
CREATE INDEX "ChecklistItem_sectionId_idx" ON "public"."ChecklistItem"("sectionId");

-- CreateIndex
CREATE INDEX "ChecklistItem_order_idx" ON "public"."ChecklistItem"("order");

-- CreateIndex
CREATE INDEX "FFEItemStatus_roomId_idx" ON "public"."FFEItemStatus"("roomId");

-- CreateIndex
CREATE INDEX "FFEItemStatus_itemId_idx" ON "public"."FFEItemStatus"("itemId");

-- CreateIndex
CREATE INDEX "FFEItemStatus_state_idx" ON "public"."FFEItemStatus"("state");

-- CreateIndex
CREATE INDEX "FFEItemStatus_selectionType_idx" ON "public"."FFEItemStatus"("selectionType");

-- CreateIndex
CREATE UNIQUE INDEX "FFEItemStatus_roomId_itemId_key" ON "public"."FFEItemStatus"("roomId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientApprovalVersion_renderingVersionId_key" ON "public"."ClientApprovalVersion"("renderingVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientApprovalAsset_versionId_assetId_key" ON "public"."ClientApprovalAsset"("versionId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientApprovalEmailLog_trackingPixelId_key" ON "public"."ClientApprovalEmailLog"("trackingPixelId");

-- CreateIndex
CREATE INDEX "FloorplanApprovalVersion_projectId_idx" ON "public"."FloorplanApprovalVersion"("projectId");

-- CreateIndex
CREATE INDEX "FloorplanApprovalVersion_status_idx" ON "public"."FloorplanApprovalVersion"("status");

-- CreateIndex
CREATE INDEX "FloorplanApprovalVersion_createdAt_idx" ON "public"."FloorplanApprovalVersion"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FloorplanApprovalVersion_projectId_version_key" ON "public"."FloorplanApprovalVersion"("projectId", "version");

-- CreateIndex
CREATE INDEX "FloorplanApprovalAsset_versionId_idx" ON "public"."FloorplanApprovalAsset"("versionId");

-- CreateIndex
CREATE INDEX "FloorplanApprovalAsset_assetId_idx" ON "public"."FloorplanApprovalAsset"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "FloorplanApprovalAsset_versionId_assetId_key" ON "public"."FloorplanApprovalAsset"("versionId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "FloorplanApprovalEmailLog_trackingPixelId_key" ON "public"."FloorplanApprovalEmailLog"("trackingPixelId");

-- CreateIndex
CREATE INDEX "FloorplanApprovalEmailLog_versionId_idx" ON "public"."FloorplanApprovalEmailLog"("versionId");

-- CreateIndex
CREATE INDEX "FloorplanApprovalEmailLog_sentAt_idx" ON "public"."FloorplanApprovalEmailLog"("sentAt");

-- CreateIndex
CREATE INDEX "FloorplanApprovalActivity_versionId_idx" ON "public"."FloorplanApprovalActivity"("versionId");

-- CreateIndex
CREATE INDEX "FloorplanApprovalActivity_createdAt_idx" ON "public"."FloorplanApprovalActivity"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Approval_token_key" ON "public"."Approval"("token");

-- CreateIndex
CREATE INDEX "ChatMessage_stageId_createdAt_idx" ON "public"."ChatMessage"("stageId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_authorId_idx" ON "public"."ChatMessage"("authorId");

-- CreateIndex
CREATE INDEX "ChatMessage_parentMessageId_idx" ON "public"."ChatMessage"("parentMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMention_messageId_mentionedId_key" ON "public"."ChatMention"("messageId", "mentionedId");

-- CreateIndex
CREATE INDEX "ChatMessageReaction_messageId_idx" ON "public"."ChatMessageReaction"("messageId");

-- CreateIndex
CREATE INDEX "ChatMessageReaction_userId_idx" ON "public"."ChatMessageReaction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessageReaction_messageId_userId_emoji_key" ON "public"."ChatMessageReaction"("messageId", "userId", "emoji");

-- CreateIndex
CREATE INDEX "NotificationSend_stageId_idx" ON "public"."NotificationSend"("stageId");

-- CreateIndex
CREATE INDEX "NotificationSend_recipientUserId_idx" ON "public"."NotificationSend"("recipientUserId");

-- CreateIndex
CREATE INDEX "NotificationSend_eventType_idx" ON "public"."NotificationSend"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSend_eventType_stageId_recipientUserId_key" ON "public"."NotificationSend"("eventType", "stageId", "recipientUserId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomPreset_roomType_name_key" ON "public"."RoomPreset"("roomType", "name");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_userId_deviceId_key" ON "public"."UserSession"("userId", "deviceId");

-- CreateIndex
CREATE INDEX "RenderingVersion_stageId_idx" ON "public"."RenderingVersion"("stageId");

-- CreateIndex
CREATE INDEX "RenderingVersion_createdAt_idx" ON "public"."RenderingVersion"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RenderingVersion_roomId_version_key" ON "public"."RenderingVersion"("roomId", "version");

-- CreateIndex
CREATE INDEX "RenderingNote_versionId_idx" ON "public"."RenderingNote"("versionId");

-- CreateIndex
CREATE INDEX "RenderingNote_createdAt_idx" ON "public"."RenderingNote"("createdAt");

-- CreateIndex
CREATE INDEX "DrawingChecklistItem_stageId_idx" ON "public"."DrawingChecklistItem"("stageId");

-- CreateIndex
CREATE INDEX "DrawingChecklistItem_order_idx" ON "public"."DrawingChecklistItem"("order");

-- CreateIndex
CREATE INDEX "ActivityLog_actorId_idx" ON "public"."ActivityLog"("actorId");

-- CreateIndex
CREATE INDEX "ActivityLog_orgId_idx" ON "public"."ActivityLog"("orgId");

-- CreateIndex
CREATE INDEX "ActivityLog_entity_entityId_idx" ON "public"."ActivityLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "public"."ActivityLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClientAccessToken_token_key" ON "public"."ClientAccessToken"("token");

-- CreateIndex
CREATE INDEX "ClientAccessToken_projectId_idx" ON "public"."ClientAccessToken"("projectId");

-- CreateIndex
CREATE INDEX "ClientAccessToken_token_idx" ON "public"."ClientAccessToken"("token");

-- CreateIndex
CREATE INDEX "ClientAccessToken_active_idx" ON "public"."ClientAccessToken"("active");

-- CreateIndex
CREATE INDEX "ClientAccessToken_expiresAt_idx" ON "public"."ClientAccessToken"("expiresAt");

-- CreateIndex
CREATE INDEX "ClientAccessLog_tokenId_idx" ON "public"."ClientAccessLog"("tokenId");

-- CreateIndex
CREATE INDEX "ClientAccessLog_createdAt_idx" ON "public"."ClientAccessLog"("createdAt");

-- CreateIndex
CREATE INDEX "ClientAccessLog_action_idx" ON "public"."ClientAccessLog"("action");

-- CreateIndex
CREATE UNIQUE INDEX "PhaseAccessToken_token_key" ON "public"."PhaseAccessToken"("token");

-- CreateIndex
CREATE INDEX "PhaseAccessToken_stageId_idx" ON "public"."PhaseAccessToken"("stageId");

-- CreateIndex
CREATE INDEX "PhaseAccessToken_token_idx" ON "public"."PhaseAccessToken"("token");

-- CreateIndex
CREATE INDEX "PhaseAccessToken_active_idx" ON "public"."PhaseAccessToken"("active");

-- CreateIndex
CREATE INDEX "PhaseAccessToken_expiresAt_idx" ON "public"."PhaseAccessToken"("expiresAt");

-- CreateIndex
CREATE INDEX "PhaseAccessLog_tokenId_idx" ON "public"."PhaseAccessLog"("tokenId");

-- CreateIndex
CREATE INDEX "PhaseAccessLog_createdAt_idx" ON "public"."PhaseAccessLog"("createdAt");

-- CreateIndex
CREATE INDEX "PhaseAccessLog_action_idx" ON "public"."PhaseAccessLog"("action");

-- CreateIndex
CREATE INDEX "Issue_reportedBy_idx" ON "public"."Issue"("reportedBy");

-- CreateIndex
CREATE INDEX "Issue_assignedTo_idx" ON "public"."Issue"("assignedTo");

-- CreateIndex
CREATE INDEX "Issue_status_idx" ON "public"."Issue"("status");

-- CreateIndex
CREATE INDEX "Issue_createdAt_idx" ON "public"."Issue"("createdAt");

-- CreateIndex
CREATE INDEX "Issue_orgId_idx" ON "public"."Issue"("orgId");

-- CreateIndex
CREATE INDEX "Issue_projectId_idx" ON "public"."Issue"("projectId");

-- CreateIndex
CREATE INDEX "Issue_roomId_idx" ON "public"."Issue"("roomId");

-- CreateIndex
CREATE INDEX "IssueComment_issueId_idx" ON "public"."IssueComment"("issueId");

-- CreateIndex
CREATE INDEX "IssueComment_createdAt_idx" ON "public"."IssueComment"("createdAt");

-- CreateIndex
CREATE INDEX "FFELibraryItem_orgId_idx" ON "public"."FFELibraryItem"("orgId");

-- CreateIndex
CREATE INDEX "FFELibraryItem_category_idx" ON "public"."FFELibraryItem"("category");

-- CreateIndex
CREATE INDEX "FFELibraryItem_roomTypes_idx" ON "public"."FFELibraryItem" USING GIN ("roomTypes");

-- CreateIndex
CREATE INDEX "FFELibraryItem_itemType_idx" ON "public"."FFELibraryItem"("itemType");

-- CreateIndex
CREATE UNIQUE INDEX "FFELibraryItem_orgId_itemId_key" ON "public"."FFELibraryItem"("orgId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "FFEGeneralSettings_orgId_key" ON "public"."FFEGeneralSettings"("orgId");

-- CreateIndex
CREATE INDEX "FFEGeneralSettings_orgId_idx" ON "public"."FFEGeneralSettings"("orgId");

-- CreateIndex
CREATE INDEX "FFEGeneralSettings_roomType_idx" ON "public"."FFEGeneralSettings"("roomType");

-- CreateIndex
CREATE UNIQUE INDEX "FFEGeneralSettings_orgId_roomType_key" ON "public"."FFEGeneralSettings"("orgId", "roomType");

-- CreateIndex
CREATE INDEX "FFEAuditLog_roomId_idx" ON "public"."FFEAuditLog"("roomId");

-- CreateIndex
CREATE INDEX "FFEAuditLog_itemId_idx" ON "public"."FFEAuditLog"("itemId");

-- CreateIndex
CREATE INDEX "FFEAuditLog_userId_idx" ON "public"."FFEAuditLog"("userId");

-- CreateIndex
CREATE INDEX "FFEAuditLog_createdAt_idx" ON "public"."FFEAuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FFEBathroomState_roomId_key" ON "public"."FFEBathroomState"("roomId");

-- CreateIndex
CREATE INDEX "FFEBathroomState_roomId_idx" ON "public"."FFEBathroomState"("roomId");

-- CreateIndex
CREATE INDEX "FFEBathroomState_completionPercentage_idx" ON "public"."FFEBathroomState"("completionPercentage");

-- CreateIndex
CREATE INDEX "FFETemplate_orgId_idx" ON "public"."FFETemplate"("orgId");

-- CreateIndex
CREATE INDEX "FFETemplate_status_idx" ON "public"."FFETemplate"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FFETemplate_orgId_name_key" ON "public"."FFETemplate"("orgId", "name");

-- CreateIndex
CREATE INDEX "FFETemplateSection_templateId_order_idx" ON "public"."FFETemplateSection"("templateId", "order");

-- CreateIndex
CREATE INDEX "FFETemplateItem_sectionId_order_idx" ON "public"."FFETemplateItem"("sectionId", "order");

-- CreateIndex
CREATE INDEX "FFETemplateItem_isRequired_idx" ON "public"."FFETemplateItem"("isRequired");

-- CreateIndex
CREATE UNIQUE INDEX "RoomFFEInstance_roomId_key" ON "public"."RoomFFEInstance"("roomId");

-- CreateIndex
CREATE INDEX "RoomFFEInstance_roomId_idx" ON "public"."RoomFFEInstance"("roomId");

-- CreateIndex
CREATE INDEX "RoomFFEInstance_templateId_idx" ON "public"."RoomFFEInstance"("templateId");

-- CreateIndex
CREATE INDEX "RoomFFEInstance_status_idx" ON "public"."RoomFFEInstance"("status");

-- CreateIndex
CREATE INDEX "RoomFFESection_instanceId_order_idx" ON "public"."RoomFFESection"("instanceId", "order");

-- CreateIndex
CREATE INDEX "RoomFFEItem_sectionId_order_idx" ON "public"."RoomFFEItem"("sectionId", "order");

-- CreateIndex
CREATE INDEX "RoomFFEItem_state_idx" ON "public"."RoomFFEItem"("state");

-- CreateIndex
CREATE INDEX "RoomFFEItem_visibility_idx" ON "public"."RoomFFEItem"("visibility");

-- CreateIndex
CREATE INDEX "RoomFFEItem_sectionId_visibility_idx" ON "public"."RoomFFEItem"("sectionId", "visibility");

-- CreateIndex
CREATE INDEX "RoomFFEItem_isRequired_idx" ON "public"."RoomFFEItem"("isRequired");

-- CreateIndex
CREATE INDEX "FFEChangeLog_entityType_entityId_idx" ON "public"."FFEChangeLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "FFEChangeLog_userId_createdAt_idx" ON "public"."FFEChangeLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "FFEChangeLog_orgId_createdAt_idx" ON "public"."FFEChangeLog"("orgId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FFESectionLibrary_name_key" ON "public"."FFESectionLibrary"("name");

-- CreateIndex
CREATE INDEX "ProjectUpdate_projectId_createdAt_idx" ON "public"."ProjectUpdate"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectUpdate_roomId_idx" ON "public"."ProjectUpdate"("roomId");

-- CreateIndex
CREATE INDEX "ProjectUpdate_status_idx" ON "public"."ProjectUpdate"("status");

-- CreateIndex
CREATE INDEX "ProjectUpdate_priority_idx" ON "public"."ProjectUpdate"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectUpdatePhoto_beforeAfterPairId_key" ON "public"."ProjectUpdatePhoto"("beforeAfterPairId");

-- CreateIndex
CREATE INDEX "ProjectUpdatePhoto_updateId_idx" ON "public"."ProjectUpdatePhoto"("updateId");

-- CreateIndex
CREATE INDEX "ProjectUpdatePhoto_takenAt_idx" ON "public"."ProjectUpdatePhoto"("takenAt");

-- CreateIndex
CREATE INDEX "ProjectUpdatePhoto_tradeCategory_idx" ON "public"."ProjectUpdatePhoto"("tradeCategory");

-- CreateIndex
CREATE INDEX "ProjectUpdateTask_projectId_status_idx" ON "public"."ProjectUpdateTask"("projectId", "status");

-- CreateIndex
CREATE INDEX "ProjectUpdateTask_assigneeId_idx" ON "public"."ProjectUpdateTask"("assigneeId");

-- CreateIndex
CREATE INDEX "ProjectUpdateTask_contractorId_idx" ON "public"."ProjectUpdateTask"("contractorId");

-- CreateIndex
CREATE INDEX "ProjectUpdateTask_dueDate_idx" ON "public"."ProjectUpdateTask"("dueDate");

-- CreateIndex
CREATE INDEX "ProjectUpdateDocument_updateId_idx" ON "public"."ProjectUpdateDocument"("updateId");

-- CreateIndex
CREATE INDEX "ProjectUpdateDocument_documentType_idx" ON "public"."ProjectUpdateDocument"("documentType");

-- CreateIndex
CREATE INDEX "ProjectUpdateDocument_approvalStatus_idx" ON "public"."ProjectUpdateDocument"("approvalStatus");

-- CreateIndex
CREATE INDEX "ProjectUpdateMessage_updateId_createdAt_idx" ON "public"."ProjectUpdateMessage"("updateId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectUpdateMessage_taskId_idx" ON "public"."ProjectUpdateMessage"("taskId");

-- CreateIndex
CREATE INDEX "ProjectUpdateMessage_authorId_idx" ON "public"."ProjectUpdateMessage"("authorId");

-- CreateIndex
CREATE INDEX "ProjectUpdateActivity_projectId_createdAt_idx" ON "public"."ProjectUpdateActivity"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectUpdateActivity_entityType_entityId_idx" ON "public"."ProjectUpdateActivity"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ContractorAssignment_projectId_idx" ON "public"."ContractorAssignment"("projectId");

-- CreateIndex
CREATE INDEX "ContractorAssignment_contractorId_idx" ON "public"."ContractorAssignment"("contractorId");

-- CreateIndex
CREATE INDEX "ContractorAssignment_status_idx" ON "public"."ContractorAssignment"("status");

-- CreateIndex
CREATE INDEX "ProjectMilestone_projectId_idx" ON "public"."ProjectMilestone"("projectId");

-- CreateIndex
CREATE INDEX "ProjectMilestone_status_idx" ON "public"."ProjectMilestone"("status");

-- CreateIndex
CREATE INDEX "SpecBook_projectId_idx" ON "public"."SpecBook"("projectId");

-- CreateIndex
CREATE INDEX "SpecBook_isActive_idx" ON "public"."SpecBook"("isActive");

-- CreateIndex
CREATE INDEX "SpecBookSection_specBookId_order_idx" ON "public"."SpecBookSection"("specBookId", "order");

-- CreateIndex
CREATE INDEX "SpecBookSection_type_idx" ON "public"."SpecBookSection"("type");

-- CreateIndex
CREATE INDEX "SpecBookSection_roomId_idx" ON "public"."SpecBookSection"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "SpecBookSection_specBookId_type_roomId_key" ON "public"."SpecBookSection"("specBookId", "type", "roomId");

-- CreateIndex
CREATE INDEX "DropboxFileLink_sectionId_idx" ON "public"."DropboxFileLink"("sectionId");

-- CreateIndex
CREATE INDEX "DropboxFileLink_drawingChecklistItemId_idx" ON "public"."DropboxFileLink"("drawingChecklistItemId");

-- CreateIndex
CREATE INDEX "DropboxFileLink_dropboxPath_idx" ON "public"."DropboxFileLink"("dropboxPath");

-- CreateIndex
CREATE INDEX "DropboxFileLink_dropboxRevision_idx" ON "public"."DropboxFileLink"("dropboxRevision");

-- CreateIndex
CREATE INDEX "SpecBookGeneration_specBookId_generatedAt_idx" ON "public"."SpecBookGeneration"("specBookId", "generatedAt");

-- CreateIndex
CREATE INDEX "SpecBookGeneration_status_idx" ON "public"."SpecBookGeneration"("status");

-- CreateIndex
CREATE INDEX "SpecBookGeneration_generatedAt_idx" ON "public"."SpecBookGeneration"("generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CadPreferences_linkedFileId_key" ON "public"."CadPreferences"("linkedFileId");

-- CreateIndex
CREATE INDEX "CadPreferences_linkedFileId_idx" ON "public"."CadPreferences"("linkedFileId");

-- CreateIndex
CREATE INDEX "CadPreferences_projectId_idx" ON "public"."CadPreferences"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCadDefaults_projectId_key" ON "public"."ProjectCadDefaults"("projectId");

-- CreateIndex
CREATE INDEX "ProjectCadDefaults_projectId_idx" ON "public"."ProjectCadDefaults"("projectId");

-- CreateIndex
CREATE INDEX "CadLayoutCache_dropboxPath_idx" ON "public"."CadLayoutCache"("dropboxPath");

-- CreateIndex
CREATE INDEX "CadLayoutCache_expiresAt_idx" ON "public"."CadLayoutCache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CadLayoutCache_dropboxPath_dropboxRevision_key" ON "public"."CadLayoutCache"("dropboxPath", "dropboxRevision");

-- CreateIndex
CREATE INDEX "DesignConceptItemLibrary_category_idx" ON "public"."DesignConceptItemLibrary"("category");

-- CreateIndex
CREATE INDEX "DesignConceptItemLibrary_isActive_idx" ON "public"."DesignConceptItemLibrary"("isActive");

-- CreateIndex
CREATE INDEX "DesignConceptItemLibrary_category_order_idx" ON "public"."DesignConceptItemLibrary"("category", "order");

-- CreateIndex
CREATE UNIQUE INDEX "DesignConceptItemLibrary_name_category_key" ON "public"."DesignConceptItemLibrary"("name", "category");

-- CreateIndex
CREATE INDEX "DesignConceptItem_stageId_idx" ON "public"."DesignConceptItem"("stageId");

-- CreateIndex
CREATE INDEX "DesignConceptItem_stageId_order_idx" ON "public"."DesignConceptItem"("stageId", "order");

-- CreateIndex
CREATE INDEX "DesignConceptItem_libraryItemId_idx" ON "public"."DesignConceptItem"("libraryItemId");

-- CreateIndex
CREATE INDEX "DesignConceptItem_completedByRenderer_idx" ON "public"."DesignConceptItem"("completedByRenderer");

-- CreateIndex
CREATE INDEX "DesignConceptItemImage_itemId_idx" ON "public"."DesignConceptItemImage"("itemId");

-- CreateIndex
CREATE INDEX "DesignConceptItemImage_itemId_order_idx" ON "public"."DesignConceptItemImage"("itemId", "order");

-- CreateIndex
CREATE INDEX "DesignConceptItemLink_itemId_idx" ON "public"."DesignConceptItemLink"("itemId");

-- CreateIndex
CREATE INDEX "DesignConceptItemLink_itemId_order_idx" ON "public"."DesignConceptItemLink"("itemId", "order");

-- CreateIndex
CREATE INDEX "DesignConceptItemNote_itemId_idx" ON "public"."DesignConceptItemNote"("itemId");

-- CreateIndex
CREATE INDEX "DesignConceptItemNote_itemId_createdAt_idx" ON "public"."DesignConceptItemNote"("itemId", "createdAt");

-- CreateIndex
CREATE INDEX "DesignConceptItemAttachment_itemId_idx" ON "public"."DesignConceptItemAttachment"("itemId");

-- CreateIndex
CREATE INDEX "DesignConceptItemAttachment_itemId_order_idx" ON "public"."DesignConceptItemAttachment"("itemId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "DesignConceptCategory_key_key" ON "public"."DesignConceptCategory"("key");

-- CreateIndex
CREATE INDEX "DesignConceptCategory_isActive_idx" ON "public"."DesignConceptCategory"("isActive");

-- CreateIndex
CREATE INDEX "DesignConceptCategory_order_idx" ON "public"."DesignConceptCategory"("order");

-- CreateIndex
CREATE INDEX "DesignConceptCategory_isDefault_idx" ON "public"."DesignConceptCategory"("isDefault");

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Client" ADD CONSTRAINT "Client_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Contractor" ADD CONSTRAINT "Contractor_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectContractor" ADD CONSTRAINT "ProjectContractor_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "public"."Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectContractor" ADD CONSTRAINT "ProjectContractor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Project" ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Project" ADD CONSTRAINT "Project_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Project" ADD CONSTRAINT "Project_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RoomSection" ADD CONSTRAINT "RoomSection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Room" ADD CONSTRAINT "Room_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Room" ADD CONSTRAINT "Room_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Room" ADD CONSTRAINT "Room_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "public"."RoomSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Room" ADD CONSTRAINT "Room_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Stage" ADD CONSTRAINT "Stage_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Stage" ADD CONSTRAINT "Stage_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Stage" ADD CONSTRAINT "Stage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Stage" ADD CONSTRAINT "Stage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Stage" ADD CONSTRAINT "Stage_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SmsConversation" ADD CONSTRAINT "SmsConversation_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "public"."Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SmsConversation" ADD CONSTRAINT "SmsConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DesignSection" ADD CONSTRAINT "DesignSection_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DesignSection" ADD CONSTRAINT "DesignSection_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DesignSection" ADD CONSTRAINT "DesignSection_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "public"."Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DesignSection" ADD CONSTRAINT "DesignSection_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Tag" ADD CONSTRAINT "Tag_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetTag" ADD CONSTRAINT "AssetTag_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "public"."Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetTag" ADD CONSTRAINT "AssetTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "public"."Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetTag" ADD CONSTRAINT "AssetTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CommentTag" ADD CONSTRAINT "CommentTag_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "public"."Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CommentTag" ADD CONSTRAINT "CommentTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "public"."Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CommentTag" ADD CONSTRAINT "CommentTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetPin" ADD CONSTRAINT "AssetPin_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "public"."Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetPin" ADD CONSTRAINT "AssetPin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CommentPin" ADD CONSTRAINT "CommentPin_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "public"."Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CommentPin" ADD CONSTRAINT "CommentPin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CommentLike" ADD CONSTRAINT "CommentLike_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "public"."Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CommentLike" ADD CONSTRAINT "CommentLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChecklistItem" ADD CONSTRAINT "ChecklistItem_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChecklistItem" ADD CONSTRAINT "ChecklistItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChecklistItem" ADD CONSTRAINT "ChecklistItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "public"."DesignSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FFEItem" ADD CONSTRAINT "FFEItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FFEItem" ADD CONSTRAINT "FFEItem_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FFEItem" ADD CONSTRAINT "FFEItem_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FFEItemStatus" ADD CONSTRAINT "FFEItemStatus_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FFEItemStatus" ADD CONSTRAINT "FFEItemStatus_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FFEItemStatus" ADD CONSTRAINT "FFEItemStatus_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClientApprovalVersion" ADD CONSTRAINT "ClientApprovalVersion_aaronApprovedById_fkey" FOREIGN KEY ("aaronApprovedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClientApprovalVersion" ADD CONSTRAINT "ClientApprovalVersion_renderingVersionId_fkey" FOREIGN KEY ("renderingVersionId") REFERENCES "public"."RenderingVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClientApprovalVersion" ADD CONSTRAINT "ClientApprovalVersion_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClientApprovalVersion" ADD CONSTRAINT "ClientApprovalVersion_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "public"."Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClientApprovalAsset" ADD CONSTRAINT "ClientApprovalAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "public"."Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClientApprovalAsset" ADD CONSTRAINT "ClientApprovalAsset_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "public"."ClientApprovalVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClientApprovalEmailLog" ADD CONSTRAINT "ClientApprovalEmailLog_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "public"."ClientApprovalVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClientApprovalActivity" ADD CONSTRAINT "ClientApprovalActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClientApprovalActivity" ADD CONSTRAINT "ClientApprovalActivity_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "public"."ClientApprovalVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FloorplanApprovalVersion" ADD CONSTRAINT "FloorplanApprovalVersion_aaronApprovedById_fkey" FOREIGN KEY ("aaronApprovedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FloorplanApprovalVersion" ADD CONSTRAINT "FloorplanApprovalVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FloorplanApprovalVersion" ADD CONSTRAINT "FloorplanApprovalVersion_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FloorplanApprovalAsset" ADD CONSTRAINT "FloorplanApprovalAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "public"."Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FloorplanApprovalAsset" ADD CONSTRAINT "FloorplanApprovalAsset_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "public"."FloorplanApprovalVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FloorplanApprovalEmailLog" ADD CONSTRAINT "FloorplanApprovalEmailLog_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "public"."FloorplanApprovalVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FloorplanApprovalActivity" ADD CONSTRAINT "FloorplanApprovalActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FloorplanApprovalActivity" ADD CONSTRAINT "FloorplanApprovalActivity_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "public"."FloorplanApprovalVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Approval" ADD CONSTRAINT "Approval_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Approval" ADD CONSTRAINT "Approval_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Approval" ADD CONSTRAINT "Approval_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Approval" ADD CONSTRAINT "Approval_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Comment" ADD CONSTRAINT "Comment_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "public"."Approval"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Comment" ADD CONSTRAINT "Comment_ffeItemId_fkey" FOREIGN KEY ("ffeItemId") REFERENCES "public"."FFEItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Comment" ADD CONSTRAINT "Comment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Comment" ADD CONSTRAINT "Comment_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Comment" ADD CONSTRAINT "Comment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "public"."DesignSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Comment" ADD CONSTRAINT "Comment_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "public"."Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatMessage" ADD CONSTRAINT "ChatMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatMessage" ADD CONSTRAINT "ChatMessage_parentMessageId_fkey" FOREIGN KEY ("parentMessageId") REFERENCES "public"."ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatMessage" ADD CONSTRAINT "ChatMessage_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "public"."Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatMention" ADD CONSTRAINT "ChatMention_mentionedId_fkey" FOREIGN KEY ("mentionedId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatMention" ADD CONSTRAINT "ChatMention_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatMessageReaction" ADD CONSTRAINT "ChatMessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatMessageReaction" ADD CONSTRAINT "ChatMessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Asset" ADD CONSTRAINT "Asset_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "public"."Approval"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Asset" ADD CONSTRAINT "Asset_drawingChecklistItemId_fkey" FOREIGN KEY ("drawingChecklistItemId") REFERENCES "public"."DrawingChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Asset" ADD CONSTRAINT "Asset_ffeItemId_fkey" FOREIGN KEY ("ffeItemId") REFERENCES "public"."FFEItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Asset" ADD CONSTRAINT "Asset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Asset" ADD CONSTRAINT "Asset_renderingVersionId_fkey" FOREIGN KEY ("renderingVersionId") REFERENCES "public"."RenderingVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Asset" ADD CONSTRAINT "Asset_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Asset" ADD CONSTRAINT "Asset_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "public"."DesignSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Asset" ADD CONSTRAINT "Asset_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "public"."Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Asset" ADD CONSTRAINT "Asset_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailLog" ADD CONSTRAINT "EmailLog_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "public"."ClientApprovalVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Activity" ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RenderingVersion" ADD CONSTRAINT "RenderingVersion_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RenderingVersion" ADD CONSTRAINT "RenderingVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RenderingVersion" ADD CONSTRAINT "RenderingVersion_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RenderingVersion" ADD CONSTRAINT "RenderingVersion_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "public"."Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RenderingVersion" ADD CONSTRAINT "RenderingVersion_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RenderingNote" ADD CONSTRAINT "RenderingNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RenderingNote" ADD CONSTRAINT "RenderingNote_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "public"."RenderingVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ActivityLog" ADD CONSTRAINT "ActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClientAccessToken" ADD CONSTRAINT "ClientAccessToken_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClientAccessToken" ADD CONSTRAINT "ClientAccessToken_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClientAccessLog" ADD CONSTRAINT "ClientAccessLog_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "public"."ClientAccessToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Issue" ADD CONSTRAINT "Issue_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Issue" ADD CONSTRAINT "Issue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Issue" ADD CONSTRAINT "Issue_reportedBy_fkey" FOREIGN KEY ("reportedBy") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Issue" ADD CONSTRAINT "Issue_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Issue" ADD CONSTRAINT "Issue_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Issue" ADD CONSTRAINT "Issue_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "public"."Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IssueComment" ADD CONSTRAINT "IssueComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IssueComment" ADD CONSTRAINT "IssueComment_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "public"."Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FFETemplate" ADD CONSTRAINT "FFETemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FFETemplate" ADD CONSTRAINT "FFETemplate_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FFETemplateSection" ADD CONSTRAINT "FFETemplateSection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."FFETemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FFETemplateItem" ADD CONSTRAINT "FFETemplateItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "public"."FFETemplateSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RoomFFEInstance" ADD CONSTRAINT "RoomFFEInstance_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RoomFFEInstance" ADD CONSTRAINT "RoomFFEInstance_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RoomFFEInstance" ADD CONSTRAINT "RoomFFEInstance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."FFETemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RoomFFEInstance" ADD CONSTRAINT "RoomFFEInstance_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RoomFFESection" ADD CONSTRAINT "RoomFFESection_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "public"."RoomFFEInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RoomFFEItem" ADD CONSTRAINT "RoomFFEItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "public"."RoomFFESection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RoomFFEItem" ADD CONSTRAINT "RoomFFEItem_templateItemId_fkey" FOREIGN KEY ("templateItemId") REFERENCES "public"."FFETemplateItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectUpdateTask" ADD CONSTRAINT "ProjectUpdateTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectUpdateTask" ADD CONSTRAINT "ProjectUpdateTask_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "public"."Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectUpdateTask" ADD CONSTRAINT "ProjectUpdateTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectUpdateTask" ADD CONSTRAINT "ProjectUpdateTask_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectUpdateTask" ADD CONSTRAINT "ProjectUpdateTask_updateId_fkey" FOREIGN KEY ("updateId") REFERENCES "public"."ProjectUpdate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectUpdateMessage" ADD CONSTRAINT "ProjectUpdateMessage_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."ProjectUpdateTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContractorAssignment" ADD CONSTRAINT "ContractorAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."ProjectUpdateTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SpecBook" ADD CONSTRAINT "SpecBook_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SpecBookSection" ADD CONSTRAINT "SpecBookSection_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SpecBookSection" ADD CONSTRAINT "SpecBookSection_specBookId_fkey" FOREIGN KEY ("specBookId") REFERENCES "public"."SpecBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DropboxFileLink" ADD CONSTRAINT "DropboxFileLink_drawingChecklistItemId_fkey" FOREIGN KEY ("drawingChecklistItemId") REFERENCES "public"."DrawingChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DropboxFileLink" ADD CONSTRAINT "DropboxFileLink_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "public"."SpecBookSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SpecBookGeneration" ADD CONSTRAINT "SpecBookGeneration_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SpecBookGeneration" ADD CONSTRAINT "SpecBookGeneration_specBookId_fkey" FOREIGN KEY ("specBookId") REFERENCES "public"."SpecBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DesignConceptItem" ADD CONSTRAINT "DesignConceptItem_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DesignConceptItem" ADD CONSTRAINT "DesignConceptItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DesignConceptItem" ADD CONSTRAINT "DesignConceptItem_libraryItemId_fkey" FOREIGN KEY ("libraryItemId") REFERENCES "public"."DesignConceptItemLibrary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DesignConceptItem" ADD CONSTRAINT "DesignConceptItem_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "public"."Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DesignConceptItem" ADD CONSTRAINT "DesignConceptItem_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DesignConceptItemImage" ADD CONSTRAINT "DesignConceptItemImage_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "public"."DesignConceptItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DesignConceptItemLink" ADD CONSTRAINT "DesignConceptItemLink_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "public"."DesignConceptItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DesignConceptItemNote" ADD CONSTRAINT "DesignConceptItemNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DesignConceptItemNote" ADD CONSTRAINT "DesignConceptItemNote_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "public"."DesignConceptItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DesignConceptItemAttachment" ADD CONSTRAINT "DesignConceptItemAttachment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "public"."DesignConceptItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

