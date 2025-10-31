# Chat Image Attachments - Visual Flow

## 🎯 Feature Overview

Users can attach images to chat messages in ALL phase chats, with preview, inline display, and download capabilities.

## 📸 User Interface Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    PHASE CHAT PANEL                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Previous Messages ↑                                         │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 👤 Alice  2:15 PM                                     │  │
│  │                                                       │  │
│  │ "Here's the color scheme for the bedroom:"          │  │
│  │                                                       │  │
│  │  ┌─────────────────────────┐                        │  │
│  │  │                         │ ⬇ [hover shows]       │  │
│  │  │   [Image Preview]       │                        │  │
│  │  │   512x256px max         │                        │  │
│  │  │                         │                        │  │
│  │  └─────────────────────────┘                        │  │
│  │                                                       │  │
│  │  Click image → Opens full size in new tab           │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  MESSAGE INPUT AREA                                          │
│                                                              │
│  [Image Preview - if selected]                              │
│  ┌────────────────────┐                                     │
│  │ thumbnail.jpg   [X]│  ← Click X to remove                │
│  └────────────────────┘                                     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Type message... @mention              📎         Send│  │
│  │                                        ↑              │  │
│  └──────────────────────────────────────┬───────────────┘  │
│                                          │                   │
│                                   Click to attach image     │
└─────────────────────────────────────────────────────────────┘
```

## 🔄 Upload Flow Diagram

```
┌──────────┐
│  User    │
│  Action  │
└────┬─────┘
     │
     │ 1. Clicks paperclip icon 📎
     ▼
┌──────────────────┐
│  File Picker     │
│  Opens           │
└────┬─────────────┘
     │
     │ 2. Selects image file
     ▼
┌──────────────────────────┐
│  Client Validation       │
│  • Type: JPEG/PNG/WebP   │
│  • Size: < 5MB           │
└────┬─────────────────────┘
     │
     ├─── ❌ Invalid → Toast Error
     │
     │ ✅ Valid
     ▼
┌──────────────────────┐
│  Preview Generated   │
│  FileReader API      │
│  Shows thumbnail     │
└────┬─────────────────┘
     │
     │ 3. User adds optional text
     │ 4. Clicks "Send"
     ▼
┌──────────────────────────┐
│  FormData Created        │
│  • content (text)        │
│  • mentions (array)      │
│  • image (File)          │
└────┬─────────────────────┘
     │
     │ POST /api/chat/[stageId]
     ▼
┌──────────────────────────────┐
│  Server API                  │
│  /api/chat/[stageId]/route   │
└────┬─────────────────────────┘
     │
     │ 5. Validates image
     ▼
┌──────────────────────────┐
│  Server Validation       │
│  • Re-check type         │
│  • Re-check size         │
│  • Check auth            │
└────┬─────────────────────┘
     │
     ├─── ❌ Invalid → 400 Error
     │
     │ ✅ Valid
     ▼
┌──────────────────────────────┐
│  Upload to Vercel Blob       │
│  Path: orgs/{orgId}/chat/    │
│        {stageId}/chat_xxx    │
└────┬─────────────────────────┘
     │
     │ 6. Get URL
     ▼
┌──────────────────────────────┐
│  Save to Database            │
│  ChatMessage {               │
│    content: "...",           │
│    imageUrl: "https://...",  │
│    imageFileName: "..."      │
│  }                           │
└────┬─────────────────────────┘
     │
     │ 7. Return message
     ▼
┌──────────────────────────┐
│  Client Updates UI       │
│  • Clears input          │
│  • Removes preview       │
│  • Adds message to chat  │
│  • Shows toast success   │
└──────────────────────────┘
```

## 💾 Data Storage Structure

```
Vercel Blob Storage:
└── orgs/
    └── {orgId}/
        └── chat/
            └── {stageId}/
                ├── chat_abc123.jpg
                ├── chat_def456.png
                └── chat_ghi789.webp

Database (PostgreSQL):
ChatMessage Table:
┌──────────┬─────────────┬──────────────────────┬────────────────┐
│ id       │ content     │ imageUrl             │ imageFileName  │
├──────────┼─────────────┼──────────────────────┼────────────────┤
│ msg_001  │ "Check it!" │ https://blob.../x.jpg│ bedroom.jpg    │
│ msg_002  │ "(Image)"   │ https://blob.../y.png│ colors.png     │
│ msg_003  │ "Great!"    │ null                 │ null           │
└──────────┴─────────────┴──────────────────────┴────────────────┘
```

## 🎨 Component Architecture

```
PhaseChat Component
├── State Management
│   ├── messages: ChatMessage[]
│   ├── selectedImage: File | null
│   ├── imagePreview: string | null
│   └── sending: boolean
│
├── Event Handlers
│   ├── handleImageSelect(e)
│   │   └── Validates → Creates preview
│   ├── removeImage()
│   │   └── Clears selection & preview
│   └── sendMessage(content, mentions)
│       └── FormData → API → Update UI
│
└── UI Components
    ├── Input Area
    │   ├── Image Preview (if selected)
    │   ├── MentionTextarea
    │   └── Paperclip Button
    │
    └── Messages Display
        └── For each message:
            ├── Author & Timestamp
            ├── Text Content (if any)
            └── Image Display (if imageUrl)
                ├── Preview (max 512x256)
                ├── Download Button (hover)
                └── Click → Open full size
```

## 🔐 Security Flow

```
Client Side:
┌─────────────────────────┐
│  File Type Check        │
│  .jpg, .png, .webp, .gif│
└───────┬─────────────────┘
        │ ✅ Pass
        ▼
┌─────────────────────────┐
│  File Size Check        │
│  Maximum 5MB            │
└───────┬─────────────────┘
        │ ✅ Pass
        ▼
     [Upload]

Server Side:
┌─────────────────────────┐
│  Authentication         │
│  Valid session required │
└───────┬─────────────────┘
        │ ✅ Auth
        ▼
┌─────────────────────────┐
│  Re-validate Type       │
│  Server-side check      │
└───────┬─────────────────┘
        │ ✅ Pass
        ▼
┌─────────────────────────┐
│  Re-validate Size       │
│  Server-side check      │
└───────┬─────────────────┘
        │ ✅ Pass
        ▼
┌─────────────────────────┐
│  Org-Scoped Path        │
│  User can only upload   │
│  to own organization    │
└───────┬─────────────────┘
        │ ✅ Authorized
        ▼
┌─────────────────────────┐
│  Upload to Blob         │
│  Secure storage         │
└─────────────────────────┘
```

## 📊 API Request/Response

### Request (With Image)
```http
POST /api/chat/[stageId]
Content-Type: multipart/form-data

FormData {
  content: "Check this out!"
  mentions: '["user_123"]'
  image: File (binary data)
}
```

### Request (Text Only)
```http
POST /api/chat/[stageId]
Content-Type: application/json

{
  "content": "Just text message",
  "mentions": ["user_123"]
}
```

### Response
```json
{
  "success": true,
  "message": {
    "id": "msg_xyz789",
    "content": "Check this out!",
    "imageUrl": "https://blob.vercel-storage.com/...",
    "imageFileName": "bedroom-design.jpg",
    "authorId": "user_456",
    "stageId": "stage_789",
    "createdAt": "2025-01-31T01:30:00.000Z",
    "author": {
      "id": "user_456",
      "name": "John Doe",
      "role": "DESIGNER",
      "image": "https://..."
    },
    "mentions": [...]
  }
}
```

## ⚡ Performance Considerations

```
Client Side:
├── Preview Generation
│   └── FileReader.readAsDataURL()
│       └── Async, non-blocking
│
├── Image Upload
│   └── FormData multipart upload
│       └── Shows loading state
│
└── Message Display
    └── Images loaded lazily
        └── Browser native lazy loading

Server Side:
├── Image Processing
│   └── Direct Blob upload (no resize)
│       └── Fast, ~100-500ms
│
├── Database Write
│   └── Single INSERT query
│       └── ~50ms
│
└── Response
    └── Returns immediately after save
        └── Total: ~200-600ms
```

## 🎯 Where Feature is Used

```
Application Structure:
└── All Phase Chats
    ├── Design Concept Workspace ✅
    ├── Bedroom Design Workspace ✅
    ├── FFE Stage ✅
    ├── Drawings Stage ✅
    ├── Rendering Workspace ✅
    └── Client Approval Workspace ✅

Each uses <PhaseChat /> component
    Props: { stageId, stageName, className }
    Location: Right sidebar or dedicated panel
```

## 🚀 Ready to Test!

The feature is **LIVE** and ready to use. Navigate to any phase with chat and start uploading images!
