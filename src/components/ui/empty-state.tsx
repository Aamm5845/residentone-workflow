import * as React from "react"
import { cn } from "@/lib/utils"
import { LucideIcon, FileQuestion, Inbox, Search, FolderOpen, Users, Calendar, Image } from "lucide-react"
import { Button } from "./button"

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    variant?: "default" | "outline" | "secondary"
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  size?: "sm" | "default" | "lg"
}

const sizeStyles = {
  sm: {
    container: "py-8",
    iconWrapper: "w-12 h-12",
    icon: "w-6 h-6",
    title: "text-base",
    description: "text-sm max-w-sm",
  },
  default: {
    container: "py-12",
    iconWrapper: "w-16 h-16",
    icon: "w-8 h-8",
    title: "text-lg",
    description: "text-sm max-w-md",
  },
  lg: {
    container: "py-16",
    iconWrapper: "w-20 h-20",
    icon: "w-10 h-10",
    title: "text-xl",
    description: "text-base max-w-lg",
  },
}

function EmptyState({
  icon: Icon = FileQuestion,
  title,
  description,
  action,
  secondaryAction,
  size = "default",
  className,
  ...props
}: EmptyStateProps) {
  const styles = sizeStyles[size]

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        styles.container,
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "bg-muted rounded-full flex items-center justify-center mb-4",
          styles.iconWrapper
        )}
      >
        <Icon className={cn("text-muted-foreground", styles.icon)} />
      </div>
      
      <h3 className={cn("font-semibold text-foreground mb-2", styles.title)}>
        {title}
      </h3>
      
      {description && (
        <p className={cn("text-muted-foreground mb-6", styles.description)}>
          {description}
        </p>
      )}
      
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {action && (
            <Button
              variant={action.variant || "default"}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="outline"
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// Pre-configured empty states for common use cases
function NoProjectsEmpty({
  onCreateProject,
}: {
  onCreateProject?: () => void
}) {
  return (
    <EmptyState
      icon={FolderOpen}
      title="No projects yet"
      description="Get started by creating your first project. You can manage clients, rooms, and track progress all in one place."
      action={onCreateProject ? {
        label: "Create Project",
        onClick: onCreateProject,
      } : undefined}
    />
  )
}

function NoRoomsEmpty({
  onAddRoom,
}: {
  onAddRoom?: () => void
}) {
  return (
    <EmptyState
      icon={Inbox}
      title="No rooms added"
      description="Add rooms to this project to start tracking design phases and progress."
      action={onAddRoom ? {
        label: "Add Room",
        onClick: onAddRoom,
      } : undefined}
    />
  )
}

function NoSearchResultsEmpty({
  searchTerm,
  onClearSearch,
}: {
  searchTerm?: string
  onClearSearch?: () => void
}) {
  return (
    <EmptyState
      icon={Search}
      title="No results found"
      description={searchTerm 
        ? `We couldn't find anything matching "${searchTerm}". Try different keywords or check your filters.`
        : "We couldn't find anything matching your search. Try different keywords or check your filters."
      }
      action={onClearSearch ? {
        label: "Clear Search",
        onClick: onClearSearch,
        variant: "outline",
      } : undefined}
    />
  )
}

function NoTeamMembersEmpty({
  onInvite,
}: {
  onInvite?: () => void
}) {
  return (
    <EmptyState
      icon={Users}
      title="No team members yet"
      description="Invite team members to collaborate on projects, assign tasks, and track progress together."
      action={onInvite ? {
        label: "Invite Team Member",
        onClick: onInvite,
      } : undefined}
    />
  )
}

function NoEventsEmpty({
  onAddEvent,
}: {
  onAddEvent?: () => void
}) {
  return (
    <EmptyState
      icon={Calendar}
      title="No events scheduled"
      description="Your calendar is empty. Add events to track deadlines, meetings, and important milestones."
      action={onAddEvent ? {
        label: "Add Event",
        onClick: onAddEvent,
      } : undefined}
    />
  )
}

function NoImagesEmpty({
  onUpload,
}: {
  onUpload?: () => void
}) {
  return (
    <EmptyState
      icon={Image}
      title="No images yet"
      description="Upload images to showcase designs, mood boards, or reference materials."
      action={onUpload ? {
        label: "Upload Images",
        onClick: onUpload,
      } : undefined}
    />
  )
}

export { 
  EmptyState, 
  NoProjectsEmpty, 
  NoRoomsEmpty, 
  NoSearchResultsEmpty, 
  NoTeamMembersEmpty,
  NoEventsEmpty,
  NoImagesEmpty,
}
