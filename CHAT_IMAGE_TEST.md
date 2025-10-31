# Chat Image Attachments - Testing Guide

## ✅ Implementation Complete!

### What Was Done:
1. ✅ Database updated with `imageUrl` and `imageFileName` fields in ChatMessage table
2. ✅ Backend API updated to handle image uploads via FormData
3. ✅ Frontend PhaseChat component enhanced with image attachment UI
4. ✅ Code compiled successfully
5. ✅ Feature is live in ALL phase chats

### Where to Test:
The image attachment feature is now available in **ALL** phase chats across the application:

- **Design Concept Workspace** - Design phases for all rooms
- **Bedroom Design Workspace** - Bedroom-specific design
- **FFE Stage** - Furniture, Fixtures & Equipment
- **Drawings Stage** - Technical drawings phase
- **Rendering Workspace** - 3D rendering phase
- **Client Approval Workspace** - Client review phase

### How to Test:

#### 1. Navigate to Any Phase
Go to any project → Select a room → Open any phase

#### 2. Find the Chat Panel
Look for the chat sidebar (usually on the right side)

#### 3. Attach an Image
1. Click the **paperclip icon** (📎) next to the message input
2. Select an image file (JPEG, PNG, WebP, or GIF)
3. Maximum size: 5MB

#### 4. See the Preview
- A thumbnail preview appears above the input
- Click the **X button** to remove if needed

#### 5. Add Optional Text
- Type a message (optional)
- Use @mentions if needed

#### 6. Send
- Click **Send** button
- Image uploads and message appears

#### 7. View in Chat
- Image displays inline in the chat message
- **Hover** over image to see download button
- **Click** image to open full size in new tab

### Test Cases to Verify:

✅ **Basic Upload**
- [ ] Click paperclip icon opens file picker
- [ ] Select image shows preview
- [ ] Preview has X button to remove
- [ ] Send button works with image

✅ **Image Display**
- [ ] Image appears in chat message
- [ ] Image has rounded corners and border
- [ ] Hover shows download button
- [ ] Click opens full size image

✅ **Validation**
- [ ] Try uploading .pdf → Should show error
- [ ] Try uploading 6MB+ file → Should show error
- [ ] Valid JPEG → Should work
- [ ] Valid PNG → Should work

✅ **With Text**
- [ ] Send image with text message
- [ ] Both text and image appear in message

✅ **Image Only**
- [ ] Send image without text
- [ ] Image appears (text shows "(Image)")

✅ **With Mentions**
- [ ] Send image with @mention
- [ ] Mentioned user gets notification
- [ ] Image and mention both work

✅ **Download**
- [ ] Hover over image
- [ ] Download button appears
- [ ] Click downloads with original filename

### Expected Behavior:

**Before Sending:**
```
┌─────────────────────────┐
│  [Preview of selected   │
│   image with X button]  │
└─────────────────────────┘
┌─────────────────────────┐
│ Type message...    📎   │
│                         │
│            [Send]       │
└─────────────────────────┘
```

**In Chat:**
```
┌─────────────────────────────┐
│ 👤 John Doe  2:30 PM        │
│                             │
│ Check out this design:      │
│                             │
│ ┌─────────────────────┐    │
│ │                     │⬇  │
│ │   [Image Preview]   │    │
│ │                     │    │
│ └─────────────────────┘    │
└─────────────────────────────┘
```

### Troubleshooting:

**Image not uploading?**
- Check browser console for errors
- Verify BLOB_READ_WRITE_TOKEN is set
- Ensure file is under 5MB
- Try different image format

**Paperclip button disabled?**
- Image already selected (remove first)
- Currently sending a message (wait)

**Preview not showing?**
- Check browser console
- Try different image file

**Download not working?**
- Hover over the image
- Button appears in top-right corner
- Click the download icon

### Storage Location:
Images are stored in Vercel Blob at:
```
orgs/{orgId}/chat/{stageId}/chat_{uuid}.{ext}
```

### API Endpoints:
- `POST /api/chat/[stageId]` - Send message (now accepts FormData with image)
- `GET /api/chat/[stageId]` - Get messages (includes imageUrl/imageFileName)

### Database Schema:
```sql
ChatMessage {
  id            String
  content       String
  imageUrl      String?     -- NEW: URL to uploaded image
  imageFileName String?     -- NEW: Original filename
  authorId      String
  stageId       String
  ...
}
```

## 🎉 Ready to Use!

The feature is fully deployed and ready for testing in all phase chats across the entire application!

## Need Help?

If you encounter issues:
1. Check browser console (F12)
2. Check server logs
3. Verify Vercel Blob is configured
4. Review the main guide: `CHAT_IMAGE_ATTACHMENTS_GUIDE.md`
