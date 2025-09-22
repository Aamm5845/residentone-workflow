#!/usr/bin/env node

// Debug script to check project and session data
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function debugProjectSettings() {
  try {
    console.log('=== Project Settings Debug ===');
    console.log('');

    // Get all projects to see what's available
    console.log('📊 Fetching all projects...');
    const allProjects = await prisma.project.findMany({
      include: {
        client: true,
        createdBy: {
          select: { id: true, name: true, email: true, orgId: true }
        }
      },
      take: 5
    });

    console.log(`Found ${allProjects.length} projects:`);
    allProjects.forEach((project, index) => {
      console.log(`${index + 1}. ${project.name}`);
      console.log(`   ID: ${project.id}`);
      console.log(`   OrgId: ${project.orgId}`);
      console.log(`   Client: ${project.client?.name || 'No client'}`);
      console.log(`   Created by: ${project.createdBy?.name || 'Unknown'} (orgId: ${project.createdBy?.orgId || 'N/A'})`);
      console.log('');
    });

    // Get all users to see orgId patterns
    console.log('👥 Fetching all users...');
    const allUsers = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, orgId: true },
      take: 5
    });

    console.log(`Found ${allUsers.length} users:`);
    allUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.email})`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   OrgId: ${user.orgId || 'NO ORGID!'}`);
      console.log('');
    });

    // Get all organizations
    console.log('🏢 Fetching all organizations...');
    const allOrgs = await prisma.organization.findMany({
      select: { id: true, name: true },
      take: 5
    });

    console.log(`Found ${allOrgs.length} organizations:`);
    allOrgs.forEach((org, index) => {
      console.log(`${index + 1}. ${org.name}`);
      console.log(`   ID: ${org.id}`);
      console.log('');
    });

    // Try to find a specific project by ID (use the first project as example)
    if (allProjects.length > 0) {
      const exampleProject = allProjects[0];
      console.log(`🔍 Testing project query for project: ${exampleProject.name}`);
      console.log(`   Project ID: ${exampleProject.id}`);
      console.log(`   Project OrgId: ${exampleProject.orgId}`);

      // Try different orgId combinations
      const testOrgIds = [
        exampleProject.orgId,
        ...allUsers.map(u => u.orgId).filter(Boolean),
        ...allOrgs.map(o => o.id)
      ].filter((value, index, self) => value && self.indexOf(value) === index); // Remove duplicates

      console.log(`Testing with ${testOrgIds.length} different orgIds:`);

      for (const testOrgId of testOrgIds) {
        try {
          const foundProject = await prisma.project.findFirst({
            where: {
              id: exampleProject.id,
              orgId: testOrgId
            },
            include: { client: true }
          });

          console.log(`   ✅ OrgId ${testOrgId}: ${foundProject ? 'FOUND' : 'NOT FOUND'}`);
        } catch (error) {
          console.log(`   ❌ OrgId ${testOrgId}: ERROR - ${error.message}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Debug script failed:');
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

debugProjectSettings().catch(console.error);