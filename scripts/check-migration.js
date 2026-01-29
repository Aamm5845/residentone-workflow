const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  // First, let's find the project
  const projectId = process.argv[2] || 'cmiqcm4fz005f5bfoxsxpwsof';

  // Try to find with contains first
  let project = await prisma.project.findFirst({
    where: {
      OR: [
        { id: projectId },
        { id: { contains: projectId.substring(0, 10) } }
      ]
    },
    select: { id: true, name: true, dropboxFolder: true }
  });

  if (!project) {
    console.log('Project not found with ID:', projectId);
    console.log('\nListing recent projects:');
    const recent = await prisma.project.findMany({
      select: { id: true, name: true, dropboxFolder: true },
      orderBy: { createdAt: 'desc' },
      take: 15
    });
    recent.forEach(p => {
      const hasDropbox = p.dropboxFolder ? 'YES' : 'no';
      console.log(`${p.id} | ${p.name?.substring(0,40).padEnd(40)} | Dropbox: ${hasDropbox}`);
    });
    await prisma.$disconnect();
    return;
  }

  // Use the found project ID
  const foundProjectId = project.id;

  console.log('\n=== PROJECT ===');
  console.log('ID:', foundProjectId);
  console.log('Name:', project?.name);
  console.log('Dropbox Folder:', project?.dropboxFolder || 'NOT SET');

  // Get RFQs for project
  const rfqs = await prisma.rFQ.findMany({
    where: { projectId: foundProjectId },
    select: { id: true }
  });
  console.log('\nRFQ count:', rfqs.length);

  if (rfqs.length === 0) {
    console.log('No RFQs found for this project');
    await prisma.$disconnect();
    return;
  }

  const rfqIds = rfqs.map(r => r.id);

  // Get supplier quotes with blob URLs
  const quotes = await prisma.supplierQuote.findMany({
    where: {
      supplierRFQ: {
        rfqId: { in: rfqIds }
      },
      quoteDocumentUrl: { not: null }
    },
    select: {
      id: true,
      quoteDocumentUrl: true,
      supplierRFQ: {
        select: {
          supplier: { select: { name: true } },
          vendorName: true
        }
      }
    }
  });

  console.log('\n=== SUPPLIER QUOTES WITH DOCUMENTS ===');
  console.log('Total:', quotes.length);

  let blobQuotes = 0;
  for (const q of quotes) {
    const supplierName = q.supplierRFQ?.supplier?.name || q.supplierRFQ?.vendorName || 'Unknown';
    const isBlob = q.quoteDocumentUrl?.includes('blob.vercel-storage.com') || false;
    if (isBlob) blobQuotes++;
    console.log(`- Quote ${q.id.substring(0,8)}... | Supplier: ${supplierName.substring(0,20).padEnd(20)} | In Blob: ${isBlob ? 'YES - NEEDS MIGRATION' : 'no'}`);
  }
  console.log(`\nQuotes in Blob storage: ${blobQuotes}`);

  // Get RFQ documents
  const docs = await prisma.rFQDocument.findMany({
    where: {
      OR: [
        { rfqId: { in: rfqIds } },
        { supplierQuote: { supplierRFQ: { rfqId: { in: rfqIds } } } }
      ]
    },
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
      provider: true,
      dropboxPath: true,
      type: true
    }
  });

  console.log('\n=== RFQ DOCUMENTS ===');
  console.log('Total:', docs.length);

  let blobDocs = 0;
  for (const d of docs) {
    const isBlob = d.fileUrl?.includes('blob.vercel-storage.com') || false;
    const hasDropbox = d.dropboxPath ? true : false;
    if (isBlob && !hasDropbox) blobDocs++;
    const name = (d.fileName || 'unnamed').substring(0, 35).padEnd(35);
    console.log(`- Doc ${d.id.substring(0,8)}... | ${name} | Provider: ${(d.provider || 'unknown').padEnd(10)} | Needs migration: ${isBlob && !hasDropbox ? 'YES' : 'no'}`);
  }
  console.log(`\nDocuments needing migration: ${blobDocs}`);

  console.log('\n=== SUMMARY ===');
  console.log(`Total files to migrate: ${blobQuotes + blobDocs}`);

  if (blobQuotes + blobDocs > 0) {
    console.log('\nTo migrate, run:');
    console.log(`POST /api/admin/migrate-quotes-to-dropbox with body: {"projectId": "${foundProjectId}", "dryRun": false}`);
  } else {
    console.log('\nNo files need migration!');
  }

  await prisma.$disconnect();
}

check().catch(e => {
  console.error(e);
  process.exit(1);
});
