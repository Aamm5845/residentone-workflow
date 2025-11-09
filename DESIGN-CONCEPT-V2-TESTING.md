# Design Concept V2 - Testing Guide

## ✅ Status: Ready to Test

The server is running and all features are implemented. The database needs to be synced first.

## 🚨 Critical: Database Sync Required

The Prisma schema has the new models but they're not in the database yet. You need to sync them:

### Option 1: Using Migration (Recommended for Production)
```bash
npx prisma migrate dev --name add-design-concept-v2
```

### Option 2: Using DB Push (For Development)
```bash
# This will create the tables without migrations
npx prisma db push --accept-data-loss

# Then regenerate the client
npx prisma generate

# Finally, seed the library with 83 items
npx ts-node prisma/seed-design-library.ts
```

## 🧪 Testing Steps

### 1. Get a Stage ID
You need a valid stage ID to test. You can:
- Find one in your database
- Or create a test project/stage through your app

### 2. Navigate to Design Concept V2
Visit: `http://localhost:3000/stages/[STAGE_ID]/design-concept`

Replace `[STAGE_ID]` with your actual stage ID.

### 3. Test the Features

#### Test 1: Browse Library
- ✅ Left sidebar shows 8 categories
- ✅ Click category to expand/collapse
- ✅ See 83 items total with icons

#### Test 2: Search
- ✅ Type "chair" in search box
- ✅ See filtered results (Chair, Armchair, Office Chair)
- ✅ Clear search to see all items

#### Test 3: Add Items
- ✅ Click any item (e.g., "Sofa")
- ✅ See toast notification "Added to design concept"
- ✅ Item appears in center panel
- ✅ Progress bar updates (e.g., "1 of 1 items complete (0%)")

#### Test 4: Add Notes
- ✅ Click in the notes textarea
- ✅ Type some text (e.g., "Use grey fabric, modern style")
- ✅ Click outside the textarea
- ✅ See "(saving...)" message
- ✅ See "Notes saved" toast

#### Test 5: Add Links
- ✅ Click "Add Link" button
- ✅ Paste a URL (e.g., "https://example.com/product")
- ✅ Add a title (e.g., "Product Page")
- ✅ Click "Add Link"
- ✅ See link appear with external link icon
- ✅ Click link to verify it opens in new tab

#### Test 6: Delete Link
- ✅ Hover over a link
- ✅ See red X button appear
- ✅ Click X button
- ✅ See "Link removed" toast
- ✅ Link disappears

#### Test 7: Mark Complete (Renderer View)
- ✅ Click the circle checkbox next to item name
- ✅ See checkmark turn green
- ✅ Item name gets strikethrough
- ✅ Background turns light green
- ✅ Progress updates (e.g., "1 of 1 items complete (100%)")
- ✅ See timestamp "Completed X ago"

#### Test 8: Delete Item
- ✅ Click "..." menu button (top right of card)
- ✅ Click "Remove Item"
- ✅ Confirm in dialog
- ✅ See "Item removed" toast
- ✅ Item disappears from list
- ✅ Progress updates

#### Test 9: Grid vs List View
- ✅ Click Grid/List toggle buttons (top of center panel)
- ✅ See layout change
- ✅ Both views show all information

#### Test 10: Email Notification (Check Backend)
- ✅ Add an item
- ✅ Check server logs for email sent
- ✅ Or check your email if Resend is configured

## 🎯 What to Look For

### Visual Quality
- Clean, modern design
- Smooth animations and transitions
- Clear visual feedback for actions
- Responsive layout

### Functionality
- All buttons work
- Forms submit properly
- Search is instant
- Auto-save works
- Toasts appear for every action

### Performance
- Library loads quickly
- Search is instant
- No lag when adding items
- Smooth scrolling

## 🐛 Common Issues

### Issue: "Table does not exist" error
**Solution:** Run `npx prisma db push --accept-data-loss` then `npx prisma generate`

### Issue: Library is empty
**Solution:** Run the seed script: `npx ts-node prisma/seed-design-library.ts`

### Issue: "Stage not found"
**Solution:** Use a valid stage ID from your database

### Issue: Can't save notes
**Solution:** Check browser console for errors, verify API route is accessible

### Issue: Images don't work
**Solution:** This is expected - Dropbox integration is marked as "coming soon"

## 📊 Expected Results

After adding 5 items and completing 2:
```
Progress Bar: "2 of 5 items complete (40%)"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
█████████████░░░░░░░░░░░░░░░░░
```

Item Card States:
- ⚪ Pending (white background, empty circle)
- ✅ Complete (green background, green checkmark, strikethrough)

## 🎉 Success Criteria

You can consider the test successful if:
- [x] All 83 library items load
- [x] Search filters correctly
- [x] Items can be added
- [x] Notes can be saved
- [x] Links can be added/removed
- [x] Completion can be toggled
- [x] Items can be deleted
- [x] Progress updates correctly
- [x] No console errors
- [x] UI is smooth and responsive

## 📝 Test Notes

Record any issues or observations here:

---

**Tested By:** _________________
**Date:** _________________
**Issues Found:** _________________
**Overall Rating:** _________________

---

## Next Steps After Testing

1. ✅ Verify all features work
2. ✅ Fix any bugs found
3. ✅ Add Dropbox image upload integration
4. ✅ Deploy to production
5. ✅ Train Aaron and Vitor on new workflow
6. ✅ Migrate existing design concepts to V2
