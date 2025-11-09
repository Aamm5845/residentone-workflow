# AI Summary Feature Documentation

## Overview

The AI Summary feature provides intelligent, automated analysis of design concept items using OpenAI's GPT-4 Vision API. It reads all design items, analyzes uploaded images, and generates a comprehensive summary describing:

- Overall design direction and style
- What has been chosen for the room (organized by category)
- Completed vs pending items
- Suggestions for missing or needed elements

## Architecture

### Components

1. **API Route**: `/api/stages/[id]/ai-summary`
   - Server-side route that handles AI summary generation
   - Fetches design items from database
   - Calls OpenAI API with structured prompts
   - Returns formatted summary with metadata

2. **UI Component**: `AISummaryCard`
   - Client component that displays the AI summary
   - Uses SWR for data fetching and caching
   - Auto-refreshes when design items change
   - Handles loading, error, and success states

3. **Server Utilities**:
   - `lib/server/openai.ts` - OpenAI client configuration
   - `lib/server/aiSummaryPrompt.ts` - Prompt building and data preparation

### Data Flow

```
User Action (add/update/delete item)
  ↓
Items updated in database
  ↓
refreshItemsAndSummary() called
  ↓
Debounced refresh (2 seconds)
  ↓
API call to /api/stages/[id]/ai-summary
  ↓
Fetch items + images from database
  ↓
Prepare data (truncate, cap limits)
  ↓
Call OpenAI GPT-4 Vision API
  ↓
Return formatted summary
  ↓
AISummaryCard updates display
```

## Setup Instructions

### Local Development

1. **Add OpenAI API Key**

   Add your OpenAI API key to `.env.local`:

   ```bash
   # OpenAI API Configuration
   OPENAI_API_KEY="your-api-key-here"
   ```

   **Note**: This key is for local development only. Never commit `.env.local` to version control.

2. **Verify Installation**

   The OpenAI SDK has already been installed:

   ```bash
   npm install  # Installs all dependencies including openai
   ```

3. **Start Development Server**

   ```bash
   npm run dev
   ```

### Production Deployment (Vercel)

1. **Add Environment Variable in Vercel Dashboard**

   - Go to your Vercel project settings
   - Navigate to "Environment Variables"
   - Add a new variable:
     - **Name**: `OPENAI_API_KEY`
     - **Value**: Your OpenAI API key (create a new one for production)
     - **Environments**: Production, Preview, Development (as needed)

2. **Create Production API Key**

   - Visit https://platform.openai.com/api-keys
   - Create a new API key specifically for production
   - Set usage limits and rate limits as needed
   - Use this key in Vercel (do NOT use the development key)

3. **Deploy**

   ```bash
   git push origin main
   # Or use Vercel CLI
   vercel --prod
   ```

## Usage

### For Users

The AI Summary appears automatically at the top of the Design Concept workspace, just below the toolbar.

**Features**:
- Automatically loads when you enter the Design Concept phase
- Updates automatically 2 seconds after you make changes (add items, upload images, update notes, etc.)
- Can be manually refreshed by clicking the "Refresh" button
- Expands/collapses to show more or less detail
- Shows completed vs pending item counts
- Displays when it was last updated

**When Summary Updates**:
- Adding a new item from the library
- Removing an item
- Uploading images to an item
- Adding product links to an item
- Updating notes on an item
- Marking items as complete/pending

### For Developers

**Auto-refresh Mechanism**:

The summary auto-refreshes using a debounced strategy to avoid excessive API calls:

```typescript
// In DesignConceptWorkspaceV2.tsx
const refreshSummary = useCallback(() => {
  // Clears existing timer
  if (summaryRefreshTimer) {
    clearTimeout(summaryRefreshTimer)
  }
  
  // Sets new timer to refresh after 2 seconds
  const timer = setTimeout(() => {
    globalMutate(`/api/stages/${stageId}/ai-summary`)
  }, 2000)
  
  setSummaryRefreshTimer(timer)
}, [stageId, globalMutate, summaryRefreshTimer])
```

Any item update calls `refreshItemsAndSummary()` which triggers the debounced refresh.

## Cost Management & Limits

### Token Limits (to control costs)

The following limits are in place to manage OpenAI API costs:

| Limit | Value | Reason |
|-------|-------|--------|
| Max items analyzed | 60 | Most recent items only |
| Max notes per item | 600 chars | Prevent token overflow |
| Max links per item | 3 | Most relevant links only |
| Max images total | 12 | Balance quality vs cost |
| Max images per item | 2 | Representative samples |

These limits are defined in `lib/server/aiSummaryPrompt.ts` and can be adjusted.

### Rate Limiting

**Per-stage, per-user rate limit**: 1 request per 60 seconds

This prevents:
- Accidental spam from rapid UI interactions
- Cost overruns from automated scripts
- Overloading the OpenAI API

If rate-limited, users see a friendly message asking them to wait ~1 minute.

### Model Selection

The API automatically selects the optimal model:

- **With images**: Uses `gpt-4o` (supports vision)
- **Without images**: Uses `gpt-4o-mini` (cheaper, faster)

### Estimated Costs

Typical costs per summary request:

- **Text-only** (gpt-4o-mini): ~$0.001 - $0.005
- **With images** (gpt-4o): ~$0.01 - $0.05

Assuming 100 design concept phases with 10 summary requests each:
- **Monthly cost**: $10 - $50 (depending on image usage)

Monitor actual usage in your OpenAI dashboard.

## API Reference

### GET `/api/stages/[id]/ai-summary`

Generates an AI summary for the specified stage's design concept items.

**Authentication**: Required (Next-Auth session)

**Rate Limit**: 1 request per 60 seconds per stage+user

**Response**:

```typescript
{
  summary: string           // Markdown-formatted summary text
  counts: {
    total: number          // Total items analyzed
    completed: number      // Items marked as complete
    pending: number        // Items still pending
  }
  meta: {
    model: string          // OpenAI model used (gpt-4o or gpt-4o-mini)
    generatedAt: string    // ISO timestamp
    processingTimeMs: number  // API processing time
    itemsAnalyzed: number  // Number of items included
    imagesAnalyzed: number // Number of images analyzed
    tokensUsed: {
      prompt: number       // Tokens in prompt
      completion: number   // Tokens in response
      total: number        // Total tokens
    }
  }
}
```

**Error Responses**:

- `401`: Unauthorized (no valid session)
- `404`: Stage not found
- `429`: Rate limit exceeded (wait 60 seconds)
- `500`: Internal server error
- `503`: OpenAI not configured or service unavailable

## Customization

### Adjusting Summary Style

Edit the system prompt in `lib/server/aiSummaryPrompt.ts`:

```typescript
export function getSystemPrompt(): string {
  return `You are an expert interior design analyst assistant...`
}
```

Customize the prompt to:
- Change the tone (more formal, more creative, etc.)
- Adjust output structure
- Focus on different aspects (budget, sustainability, etc.)

### Changing Limits

Edit constants in `lib/server/aiSummaryPrompt.ts`:

```typescript
const MAX_ITEMS = 60           // Increase to analyze more items
const MAX_NOTES_LENGTH = 600   // Increase for longer notes
const MAX_IMAGES_TOTAL = 12    // Adjust image analysis
```

**Warning**: Increasing limits will increase costs and API latency.

### Modifying Rate Limits

Edit in `app/api/stages/[id]/ai-summary/route.ts`:

```typescript
const RATE_LIMIT_WINDOW_MS = 60000  // Change to 120000 for 2 minutes
const RATE_LIMIT_MAX_CALLS = 1      // Change to 2 for 2 calls per window
```

## Troubleshooting

### Summary Not Loading

1. **Check OpenAI API Key**:
   ```bash
   # Verify key is set
   echo $OPENAI_API_KEY  # Linux/Mac
   # Or check .env.local file
   ```

2. **Check Console Logs**:
   - Server logs: Look for `[AI Summary]` prefixed messages
   - Browser console: Check for network errors

3. **Verify Network**:
   - Ensure you can reach api.openai.com
   - Check for firewall/proxy issues

### Rate Limited

If you're hitting rate limits frequently:
- Increase `RATE_LIMIT_WINDOW_MS` in the API route
- Reduce auto-refresh frequency (increase debounce delay)
- Cache summaries for longer periods

### High Costs

If costs are too high:
- Reduce image limits (`MAX_IMAGES_TOTAL`)
- Use gpt-4o-mini exclusively (remove vision support)
- Increase rate limiting (reduce requests per hour)
- Cache summaries more aggressively

### Poor Summary Quality

If summaries aren't helpful:
- Adjust the system prompt to be more specific
- Increase token limits (`max_tokens` in API call)
- Ensure items have detailed notes
- Add more reference images

## Security

### API Key Security

✅ **Secure**:
- API key stored in environment variables
- Never exposed to client-side code
- Only used in server-side API routes

❌ **Never**:
- Commit `.env.local` to git
- Share API keys in code or documentation
- Use development keys in production

### Data Privacy

- Only design item data is sent to OpenAI
- Client information is included (project name, room name)
- Notes and links are included as-is
- Images are sent via their public URLs

**Important**: If your images or notes contain sensitive information, review OpenAI's data usage policy.

## Future Enhancements

Potential improvements:

1. **Caching**: Store summaries in database to reduce API calls
2. **Streaming**: Stream responses for faster perceived performance
3. **Comparison**: Show how design evolved between versions
4. **Export**: Allow exporting summaries as PDF or Word doc
5. **Suggestions**: Generate specific product recommendations
6. **Budget**: Analyze and summarize budget implications
7. **Style Analysis**: Identify and name the design style automatically

## Support

For issues or questions:
1. Check server logs for `[AI Summary]` messages
2. Review OpenAI API usage in dashboard
3. Verify environment variables are set correctly
4. Test with a simple stage (few items, no images) first

## License & Credits

This feature uses:
- **OpenAI GPT-4 API**: https://platform.openai.com/
- **OpenAI Node.js SDK**: https://github.com/openai/openai-node
- **SWR**: https://swr.vercel.app/

Make sure to comply with OpenAI's Terms of Service and Usage Policies.
