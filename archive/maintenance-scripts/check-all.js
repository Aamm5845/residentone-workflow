const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAll() {
  try {
    const counts = {
      'Organizations': await prisma.organization.count(),
      'Users': await prisma.user.count(),
      'Clients': await prisma.client.count(),
      'Contractors': await prisma.contractor.count(),
      'Projects': await prisma.project.count(),
      'Rooms': await prisma.room.count(),
      'Room Sections': await prisma.roomSection.count(),
      'Stages': await prisma.stage.count(),
      'Design Sections': await prisma.designSection.count(),
      'Assets (PICTURES!)': await prisma.asset.count(),
      'Comments': await prisma.comment.count(),
      'Chat Messages': await prisma.chatMessage.count(),
      'Chat Mentions': await prisma.chatMention.count(),
      'Activity Logs': await prisma.activityLog.count(),
      'Activities': await prisma.activity.count(),
      'Notifications': await prisma.notification.count(),
      'FFE Templates': await prisma.fFETemplate.count(),
      'FFE Template Sections': await prisma.fFETemplateSection.count(),
      'FFE Template Items': await prisma.fFETemplateItem.count(),
      'Room FFE Instances': await prisma.roomFFEInstance.count(),
      'Room FFE Sections': await prisma.roomFFESection.count(),
      'Room FFE Items': await prisma.roomFFEItem.count(),
      'FFE Change Logs': await prisma.fFEChangeLog.count(),
      'FFE Section Library': await prisma.fFESectionLibrary.count(),
      'Rendering Versions': await prisma.renderingVersion.count(),
      'Spec Books': await prisma.specBook.count(),
      'Spec Book Sections': await prisma.specBookSection.count(),
      'Spec Book Generations': await prisma.specBookGeneration.count(),
      'Issues': await prisma.issue.count(),
      'Dropbox File Links': await prisma.dropboxFileLink.count(),
      'Drawing Checklist Items': await prisma.drawingChecklistItem.count(),
      'Email Logs': await prisma.emailLog.count(),
      'Client Access Tokens': await prisma.clientAccessToken.count(),
      'Client Access Logs': await prisma.clientAccessLog.count()
    };
    
    console.log('📊 COMPLETE DATABASE STATUS\n');
    console.log('='.repeat(50));
    for (const [key, value] of Object.entries(counts)) {
      const emoji = value > 0 ? '✅' : '❌';
      console.log(`${emoji} ${key}: ${value}`);
    }
    console.log('='.repeat(50));
    
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log(`\n🎉 TOTAL RECORDS: ${total}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAll();
