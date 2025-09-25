# Inbox & @Mentions Guide

## Overview

The Inbox feature in the navigation shows notifications specifically for @mentions. When someone mentions you in a comment, message, or chat, you'll receive a notification that appears in your Inbox.

## Features Added

### 1. Inbox in Left Sidebar Navigation
- Located in the left sidebar navigation menu, positioned between Home and My Projects
- Shows an inbox icon with a red notification badge when there are unread @mention notifications
- Clicking navigates to a dedicated Inbox page showing all your mention notifications

### 2. Individual Mention Notifications
- Each @mention creates a separate notification item that appears in your Inbox
- Shows the person who mentioned you and a preview of their message
- Each notification remains unread until you click on it individually
- Notifications are organized into "Unread" and "Read" sections
- Bulk actions available: "Mark Selected Read" and "Mark All Read"

## How @Mentions Work

### For Users (Mentioning Someone)
1. **In any comment field** that supports mentions, type `@` followed by a person's name
2. **Auto-suggestions** will appear showing team members matching your search
3. **Use arrow keys** to navigate suggestions and press Enter/Tab to select
4. **Submit your comment** - mentioned users will automatically receive notifications

### For Users (Being Mentioned)
1. **Notification appears** in your Inbox (inbox icon in top navigation)
2. **Red badge** shows the count of unread mentions
3. **Click the inbox** to see all your mentions
4. **Click a specific mention** to navigate to the relevant page
5. **Mark as read** by clicking the mention or use "Mark all read"

## Where Mentions Work

@mentions are supported in:
- ✅ **Design Comments** (Design workspace comments)
- ✅ **Stage Comments** (Individual stage comments)
- ✅ **Chat Messages** (Phase chat conversations)
- ✅ **Project Comments** (Various project-related discussions)

## Technical Details

### Mention Processing
- Uses regex pattern: `/@([a-zA-Z]+(?:\\s+[a-zA-Z]+)*)/g`
- Supports names with spaces (e.g., "John Doe")
- Case-insensitive matching
- Prevents self-mentions (you can't notify yourself)

### Notification Creation
- Creates notifications with type "MENTION"
- Includes context about where the mention occurred
- Links to the relevant page/stage for easy navigation
- Shows preview of the message content

### User Lookup
- Searches active team members by name
- Limited to organization members only
- Filters out deleted/inactive users
- Currently restricted to: aaron@meisnerinteriors.com, shaya@meisnerinteriors.com, sami@meisnerinteriors.com, euvi.3d@gmail.com

## Usage Examples

### In a Design Comment
```
Hey @Aaron, can you review the color palette for the living room? 
I think the @Shaya suggestion about the accent wall might work better.
```

### In Phase Chat
```
@Team, the client approved the initial concept. 
@Sami, can you start working on the 3D renders?
```

### In Stage Comments
```
@Aaron, I've completed the furniture layout. 
Please review when you have a moment.
```

## Best Practices

### When to Use Mentions
- ✅ Need someone's attention on a specific item
- ✅ Assigning informal tasks or requests
- ✅ Including relevant team members in discussions
- ✅ Getting approval or feedback from specific people

### Mention Etiquette
- 🎯 **Be specific** about what you need from the mentioned person
- 📝 **Provide context** so they understand the request
- 🚫 **Don't over-mention** - only include relevant people
- ⏰ **Consider timing** - mentions create immediate notifications

## Troubleshooting

### Not Receiving Mention Notifications?
1. Check that you're logged in to the correct account
2. Verify the person spelled your name correctly
3. Ensure your account is active and part of the organization
4. Check your notification settings (if implemented)

### Can't Mention Someone?
1. Verify they're a team member in your organization
2. Check that their account is active (not deleted)
3. Try typing their full name as it appears in the system
4. Ensure you're typing `@Name` (with the @ symbol)

### Mentions Not Working in a Feature?
1. Verify that the feature supports mentions (see list above)
2. Check that the comment/message field uses the MentionTextarea component
3. Ensure the backend API processes mentions correctly

## Future Enhancements

Potential improvements that could be added:
- 📧 **Email notifications** for mentions when users are offline
- 🔔 **Mention preference settings** (immediate, daily digest, etc.)
- 👥 **Group mentions** (e.g., @designers, @team)
- 🔍 **Better search** in mention suggestions
- 📱 **Push notifications** for mobile users
- 📊 **Mention analytics** and reporting