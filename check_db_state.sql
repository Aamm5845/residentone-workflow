-- Check database tables and team member accounts
SELECT 'Users Count' as info, COUNT(*) as count FROM "User"
UNION ALL
SELECT 'Organizations Count' as info, COUNT(*) as count FROM "Organization"
UNION ALL
SELECT 'Projects Count' as info, COUNT(*) as count FROM "Project"
UNION ALL
SELECT 'Rooms Count' as info, COUNT(*) as count FROM "Room"
UNION ALL
SELECT 'Stages Count' as info, COUNT(*) as count FROM "Stage";

-- Team member details
SELECT name, email, role, "orgId", "createdAt" FROM "User" ORDER BY "createdAt";