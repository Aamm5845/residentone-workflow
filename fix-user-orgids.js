#!/usr/bin/env node

// Script to fix missing orgIds for users
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function fixUserOrgIds() {
  try {
    console.log('=== Fixing User OrgIds ===');
    console.log('');

    // Get users without orgId
    const usersWithoutOrgId = await prisma.user.findMany({
      where: {
        orgId: null
      },
      select: { id: true, name: true, email: true, role: true }
    });

    console.log(`Found ${usersWithoutOrgId.length} users without orgId:`);
    usersWithoutOrgId.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.email}) - ${user.role}`);
    });
    console.log('');

    // Get available organizations
    const orgs = await prisma.organization.findMany({
      select: { id: true, name: true }
    });

    console.log(`Available organizations:`);
    orgs.forEach((org, index) => {
      console.log(`${index + 1}. ${org.name} (ID: ${org.id})`);
    });
    console.log('');

    // Strategy: Assign users to organizations based on their project associations
    for (const user of usersWithoutOrgId) {
      console.log(`🔧 Processing user: ${user.name} (${user.email})`);

      // Find projects created by this user
      const userProjects = await prisma.project.findMany({
        where: { createdById: user.id },
        select: { id: true, name: true, orgId: true }
      });

      if (userProjects.length > 0) {
        // Use the orgId from their most recent project
        const targetOrgId = userProjects[0].orgId;
        console.log(`   Found ${userProjects.length} projects created by this user`);
        console.log(`   Assigning to orgId: ${targetOrgId}`);

        await prisma.user.update({
          where: { id: user.id },
          data: { orgId: targetOrgId }
        });

        console.log(`   ✅ Updated user ${user.name} with orgId: ${targetOrgId}`);
      } else {
        // If no projects, assign to the first available organization
        if (orgs.length > 0) {
          const defaultOrgId = orgs[0].id;
          console.log(`   No projects found, assigning to default org: ${defaultOrgId}`);

          await prisma.user.update({
            where: { id: user.id },
            data: { orgId: defaultOrgId }
          });

          console.log(`   ✅ Updated user ${user.name} with default orgId: ${defaultOrgId}`);
        } else {
          console.log(`   ❌ No organizations available to assign`);
        }
      }
    }

    console.log('');
    console.log('🎉 User orgId fixes completed!');

    // Verify the fixes
    console.log('');
    console.log('📊 Verification - checking user orgIds:');
    const allUsers = await prisma.user.findMany({
      select: { id: true, name: true, email: true, orgId: true }
    });

    allUsers.forEach((user, index) => {
      const status = user.orgId ? '✅' : '❌';
      console.log(`${status} ${user.name} (${user.email}) - orgId: ${user.orgId || 'MISSING'}`);
    });

  } catch (error) {
    console.error('❌ Fix script failed:');
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

fixUserOrgIds().catch(console.error);