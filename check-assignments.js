const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAssignments() {
  console.log('Checking current stage assignments...');
  
  // Get all users first
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true }
  });
  
  console.log('\n=== CURRENT USERS ===');
  users.forEach(u => console.log(`ID: ${u.id}, Name: ${u.name}, Email: ${u.email}, Role: ${u.role}`));
  
  // Get all stage assignments
  const stages = await prisma.stage.findMany({
    where: {
      assignedTo: { not: null }
    },
    include: {
      assignedUser: { select: { id: true, name: true, email: true } },
      room: {
        select: {
          name: true,
          project: { select: { name: true } }
        }
      }
    }
  });
  
  console.log('\n=== CURRENT STAGE ASSIGNMENTS ===');
  stages.forEach(s => {
    console.log(`Stage: ${s.room.project.name} - ${s.room.name} (${s.type})`);
    console.log(`  Assigned to: ${s.assignedUser?.name} (${s.assignedUser?.email}) [ID: ${s.assignedUser?.id}]`);
  });
  
  // Find any old team member assignments
  const validEmails = ['aaron@meisnerinteriors.com', 'shaya@meisnerinteriors.com', 'maya@meisnerinteriors.com', 'hannah@meisnerinteriors.com'];
  const invalidAssignments = stages.filter(s => s.assignedUser && !validEmails.includes(s.assignedUser.email));
  
  console.log('\n=== INVALID ASSIGNMENTS (Old Team Members) ===');
  if (invalidAssignments.length > 0) {
    invalidAssignments.forEach(a => {
      console.log(`❌ Stage: ${a.stage.room.project.name} - ${a.stage.room.name} (${a.stage.type})`);
      console.log(`   Assigned to OLD MEMBER: ${a.user.name} (${a.user.email})`);
    });
  } else {
    console.log('✅ No invalid assignments found - all stages assigned to current team members');
  }
  
  // Check for any client approval versions that reference Aaron's approval
  const clientApprovals = await prisma.clientApprovalVersion.findMany({
    where: {
      aaronApprovedById: { not: null }
    },
    include: {
      aaronApprovedBy: { select: { id: true, name: true, email: true } },
      stage: {
        select: {
          room: {
            select: {
              name: true,
              project: { select: { name: true } }
            }
          }
        }
      }
    }
  });
  
  console.log('\n=== AARON APPROVAL REFERENCES ===');
  if (clientApprovals.length > 0) {
    clientApprovals.forEach(ca => {
      console.log(`Project: ${ca.stage.room.project.name} - ${ca.stage.room.name}`);
      console.log(`  Aaron approved by: ${ca.aaronApprovedBy.name} (${ca.aaronApprovedBy.email}) [ID: ${ca.aaronApprovedBy.id}]`);
    });
  } else {
    console.log('No client approval versions with Aaron approvals found');
  }
  
  await prisma.$disconnect();
}

checkAssignments().catch(console.error);