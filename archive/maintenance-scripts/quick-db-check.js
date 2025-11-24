const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function quickCheck() {
  try {
    console.log('\n📊 Current Database Status:\n');
    console.log('Organizations:', await prisma.organization.count());
    console.log('Users:', await prisma.user.count());
    console.log('Clients:', await prisma.client.count());
    console.log('Contractors:', await prisma.contractor.count());
    console.log('Projects:', await prisma.project.count());
    console.log('Rooms:', await prisma.room.count());
    console.log('Stages:', await prisma.stage.count());
    console.log('Room Sections:', await prisma.roomSection.count());
    console.log('\nFFE Data:');
    console.log('FFE Templates:', await prisma.fFETemplate.count());
    console.log('FFE Template Sections:', await prisma.fFETemplateSection.count());
    console.log('FFE Template Items:', await prisma.fFETemplateItem.count());
    console.log('FFE Section Library:', await prisma.fFESectionLibrary.count());
    console.log('Room FFE Items:', await prisma.roomFFEItem.count());
    console.log('Room FFE Sections:', await prisma.roomFFESection.count());
    console.log('Room FFE Instances:', await prisma.roomFFEInstance.count());
    console.log('FFE Change Logs:', await prisma.fFEChangeLog.count());
    console.log('\nOther Data:');
    console.log('Assets:', await prisma.asset.count());
    console.log('Chat Messages:', await prisma.chatMessage.count());
    console.log('Chat Mentions:', await prisma.chatMention.count());
    console.log('Notifications:', await prisma.notification.count());
    console.log('Issues:', await prisma.issue.count());
    console.log('Activities:', await prisma.activity.count());
    console.log('Activity Logs:', await prisma.activityLog.count());
    console.log('Rendering Versions:', await prisma.renderingVersion.count());
    console.log('Spec Books:', await prisma.specBook.count());
    console.log('Spec Book Sections:', await prisma.specBookSection.count());
    console.log('Spec Book Generations:', await prisma.specBookGeneration.count());
    console.log('Design Sections:', await prisma.designSection.count());
    console.log('Dropbox File Links:', await prisma.dropboxFileLink.count());
    console.log('Email Logs:', await prisma.emailLog.count());
    console.log('Project Contractors:', await prisma.projectContractor.count());
    console.log('Client Access Tokens:', await prisma.clientAccessToken.count());
    console.log('Client Access Logs:', await prisma.clientAccessLog.count());
    console.log('Client Approval Activities:', await prisma.clientApprovalActivity.count());
    console.log('Client Approval Assets:', await prisma.clientApprovalAsset.count());
    console.log('');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

quickCheck();
