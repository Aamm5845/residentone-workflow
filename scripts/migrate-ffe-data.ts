#!/usr/bin/env node

/**
 * FFE Data Migration Script
 * 
 * Migrates existing FFE data from the legacy system to the new template-based system.
 * 
 * Features:
 * - Analyzes legacy FFE data and creates templates
 * - Maps room instances to new template structure
 * - Preserves item states, notes, and completion data
 * - Generates detailed migration reports
 * - Supports dry-run and incremental migration
 * 
 * Usage:
 *   npx ts-node scripts/migrate-ffe-data.ts --dry-run
 *   npx ts-node scripts/migrate-ffe-data.ts --execute
 *   npx ts-node scripts/migrate-ffe-data.ts --org=ORG_ID
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

interface LegacyFFEData {
  orgId: string;
  rooms: LegacyRoom[];
  items: LegacyFFEItem[];
  templates: LegacyTemplate[];
}

interface LegacyRoom {
  id: string;
  name: string;
  roomType: string;
  projectId: string;
  ffeItems: LegacyFFEItemInstance[];
}

interface LegacyFFEItem {
  id: string;
  name: string;
  description?: string;
  category: string;
  roomType?: string;
  isRequired: boolean;
  estimatedCost?: number;
}

interface LegacyFFEItemInstance {
  id: string;
  roomId: string;
  ffeItemId: string;
  status: string;
  notes?: string;
  completedAt?: Date;
  customName?: string;
}

interface LegacyTemplate {
  roomType: string;
  sections: { [category: string]: LegacyFFEItem[] };
}

interface MigrationReport {
  timestamp: string;
  orgId: string;
  summary: {
    totalOrgs: number;
    totalRooms: number;
    totalItems: number;
    templatesCreated: number;
    roomInstancesCreated: number;
    itemsMigrated: number;
    errors: number;
  };
  templates: TemplateReport[];
  rooms: RoomMigrationReport[];
  errors: string[];
  unmappedItems: UnmappedItem[];
}

interface TemplateReport {
  id: string;
  name: string;
  roomType: string;
  sectionsCount: number;
  itemsCount: number;
  sourceRooms: string[];
}

interface RoomMigrationReport {
  roomId: string;
  roomName: string;
  roomType: string;
  templateId: string;
  itemsCount: number;
  completedItems: number;
  errors: string[];
}

interface UnmappedItem {
  legacyItemId: string;
  name: string;
  category: string;
  roomType?: string;
  reason: string;
}

class FFEDataMigrator {
  private prisma: PrismaClient;
  private isDryRun: boolean;
  private targetOrgId?: string;
  private report: MigrationReport;
  private defaultSections: Map<string, string> = new Map();

  constructor(isDryRun = true, targetOrgId?: string) {
    this.prisma = new PrismaClient();
    this.isDryRun = isDryRun;
    this.targetOrgId = targetOrgId;
    
    this.report = {
      timestamp: new Date().toISOString(),
      orgId: targetOrgId || 'ALL',
      summary: {
        totalOrgs: 0,
        totalRooms: 0,
        totalItems: 0,
        templatesCreated: 0,
        roomInstancesCreated: 0,
        itemsMigrated: 0,
        errors: 0
      },
      templates: [],
      rooms: [],
      errors: [],
      unmappedItems: []
    };

    this.initializeDefaultSections();
  }

  private initializeDefaultSections() {
    // Map legacy categories to new section names
    this.defaultSections.set('FLOORING', 'Flooring');
    this.defaultSections.set('LIGHTING', 'Lighting');
    this.defaultSections.set('PLUMBING', 'Plumbing');
    this.defaultSections.set('HARDWARE', 'Hardware');
    this.defaultSections.set('ACCESSORIES', 'Accessories');
    this.defaultSections.set('FURNITURE', 'Furniture');
    this.defaultSections.set('TEXTILES', 'Textiles');
    this.defaultSections.set('WINDOW_TREATMENTS', 'Window Treatments');
    this.defaultSections.set('APPLIANCES', 'Appliances');
    this.defaultSections.set('OTHER', 'Miscellaneous');
  }

  private log(message: string, level: 'INFO' | 'ERROR' | 'WARNING' = 'INFO') {
    const timestamp = new Date().toISOString();
    const prefix = this.isDryRun ? '[DRY RUN]' : '[EXECUTE]';
    console.log(`${prefix} [${level}] ${timestamp}: ${message}`);
    
    if (level === 'ERROR') {
      this.report.errors.push(message);
      this.report.summary.errors++;
    }
  }

  /**
   * Extract and analyze legacy FFE data
   */
  private async extractLegacyData(orgId: string): Promise<LegacyFFEData | null> {
    try {
      this.log(`Extracting legacy FFE data for org: ${orgId}`);

      // Query legacy data (adjust these queries based on your actual schema)
      const rooms = await this.prisma.$queryRaw<any[]>`
        SELECT r.id, r.name, r.roomType, r.projectId,
               json_agg(
                 json_build_object(
                   'id', fi.id,
                   'ffeItemId', fi.ffeItemId,
                   'status', fis.status,
                   'notes', fis.notes,
                   'completedAt', fis.completedAt,
                   'customName', fi.customName
                 )
               ) as ffeItems
        FROM "Room" r
        LEFT JOIN "FFEItem" fi ON fi.roomId = r.id
        LEFT JOIN "FFEItemStatus" fis ON fis.ffeItemId = fi.id
        WHERE r.orgId = ${orgId}
        GROUP BY r.id, r.name, r.roomType, r.projectId
      `;

      const items = await this.prisma.$queryRaw<any[]>`
        SELECT fli.id, fli.name, fli.description, fli.category,
               fli.roomType, fli.isRequired, fli.estimatedCost
        FROM "FFELibraryItem" fli
        WHERE fli.orgId = ${orgId}
      `;

      this.report.summary.totalRooms += rooms.length;
      this.report.summary.totalItems += items.length;

      return {
        orgId,
        rooms: rooms as LegacyRoom[],
        items: items as LegacyFFEItem[],
        templates: this.generateTemplatesFromData(rooms as LegacyRoom[], items as LegacyFFEItem[])
      };

    } catch (error) {
      this.log(`Failed to extract legacy data for org ${orgId}: ${error}`, 'ERROR');
      return null;
    }
  }

  /**
   * Generate templates based on existing room and item data
   */
  private generateTemplatesFromData(rooms: LegacyRoom[], items: LegacyFFEItem[]): LegacyTemplate[] {
    const templates: Map<string, LegacyTemplate> = new Map();
    
    // Group items by room type and category
    rooms.forEach(room => {
      if (!templates.has(room.roomType)) {
        templates.set(room.roomType, {
          roomType: room.roomType,
          sections: {}
        });
      }

      const template = templates.get(room.roomType)!;
      
      // Add items used in this room to the template
      room.ffeItems.forEach(itemInstance => {
        const item = items.find(i => i.id === itemInstance.ffeItemId);
        if (item) {
          const sectionName = this.defaultSections.get(item.category) || 'Miscellaneous';
          
          if (!template.sections[sectionName]) {
            template.sections[sectionName] = [];
          }

          // Add item if not already in the section
          const exists = template.sections[sectionName].some(existingItem => 
            existingItem.id === item.id
          );
          
          if (!exists) {
            template.sections[sectionName].push(item);
          }
        }
      });
    });

    return Array.from(templates.values());
  }

  /**
   * Create new templates in the database
   */
  private async createTemplates(legacyData: LegacyFFEData): Promise<string[]> {
    const templateIds: string[] = [];

    for (const legacyTemplate of legacyData.templates) {
      try {
        const sectionsData = Object.entries(legacyTemplate.sections).map(([sectionName, items], index) => ({
          name: sectionName,
          order: index,
          items: items.map(item => ({
            name: item.customName || item.name,
            description: item.description || '',
            defaultState: 'PENDING' as const,
            isRequired: item.isRequired,
            estimatedCost: item.estimatedCost,
            notes: ''
          }))
        }));

        if (!this.isDryRun) {
          const template = await this.prisma.fFETemplate.create({
            data: {
              orgId: legacyData.orgId,
              name: `${legacyTemplate.roomType} Template (Migrated)`,
              description: `Auto-generated template from legacy ${legacyTemplate.roomType} data`,
              roomType: this.mapRoomType(legacyTemplate.roomType),
              isActive: true,
              sections: {
                create: sectionsData
              }
            },
            include: { sections: { include: { items: true } } }
          });

          templateIds.push(template.id);
        } else {
          // Dry run: simulate template creation
          templateIds.push(`template-${legacyTemplate.roomType}-${Date.now()}`);
        }

        const itemsCount = Object.values(legacyTemplate.sections).reduce(
          (total, items) => total + items.length, 0
        );

        this.report.templates.push({
          id: templateIds[templateIds.length - 1],
          name: `${legacyTemplate.roomType} Template (Migrated)`,
          roomType: legacyTemplate.roomType,
          sectionsCount: Object.keys(legacyTemplate.sections).length,
          itemsCount,
          sourceRooms: legacyData.rooms
            .filter(r => r.roomType === legacyTemplate.roomType)
            .map(r => r.id)
        });

        this.report.summary.templatesCreated++;
        this.log(`Created template for room type: ${legacyTemplate.roomType}`);

      } catch (error) {
        this.log(`Failed to create template for ${legacyTemplate.roomType}: ${error}`, 'ERROR');
      }
    }

    return templateIds;
  }

  /**
   * Create room instances from templates
   */
  private async createRoomInstances(
    legacyData: LegacyFFEData, 
    templateIds: string[]
  ): Promise<void> {
    const templateMap = new Map<string, string>();
    
    // Map room types to template IDs
    legacyData.templates.forEach((template, index) => {
      templateMap.set(template.roomType, templateIds[index]);
    });

    for (const room of legacyData.rooms) {
      const roomReport: RoomMigrationReport = {
        roomId: room.id,
        roomName: room.name,
        roomType: room.roomType,
        templateId: '',
        itemsCount: 0,
        completedItems: 0,
        errors: []
      };

      try {
        const templateId = templateMap.get(room.roomType);
        if (!templateId) {
          roomReport.errors.push(`No template found for room type: ${room.roomType}`);
          this.report.rooms.push(roomReport);
          continue;
        }

        roomReport.templateId = templateId;

        if (!this.isDryRun) {
          // Create room instance
          const roomInstance = await this.prisma.roomFFEInstance.create({
            data: {
              roomId: room.id,
              templateId,
              name: `${room.name} FFE`,
              status: 'IN_PROGRESS',
              progress: 0
            }
          });

          // Create room items based on legacy data
          for (const legacyItem of room.ffeItems) {
            if (legacyItem.ffeItemId) {
              const item = legacyData.items.find(i => i.id === legacyItem.ffeItemId);
              if (item) {
                await this.prisma.roomFFEItem.create({
                  data: {
                    instanceId: roomInstance.id,
                    name: legacyItem.customName || item.name,
                    description: item.description || '',
                    state: this.mapItemState(legacyItem.status),
                    isRequired: item.isRequired,
                    estimatedCost: item.estimatedCost,
                    notes: legacyItem.notes || '',
                    completedAt: legacyItem.completedAt
                  }
                });

                roomReport.itemsCount++;
                if (legacyItem.status === 'COMPLETED') {
                  roomReport.completedItems++;
                }
                this.report.summary.itemsMigrated++;
              }
            }
          }

          // Update progress
          const progress = roomReport.itemsCount > 0 
            ? Math.round((roomReport.completedItems / roomReport.itemsCount) * 100)
            : 0;

          await this.prisma.roomFFEInstance.update({
            where: { id: roomInstance.id },
            data: { progress }
          });
        } else {
          // Dry run simulation
          roomReport.itemsCount = room.ffeItems.length;
          roomReport.completedItems = room.ffeItems.filter(
            item => item.status === 'COMPLETED'
          ).length;
          this.report.summary.itemsMigrated += roomReport.itemsCount;
        }

        this.report.summary.roomInstancesCreated++;
        this.log(`Migrated room: ${room.name} (${room.roomType})`);

      } catch (error) {
        roomReport.errors.push(`Migration failed: ${error}`);
        this.log(`Failed to migrate room ${room.name}: ${error}`, 'ERROR');
      }

      this.report.rooms.push(roomReport);
    }
  }

  /**
   * Map legacy room types to new enum values
   */
  private mapRoomType(legacyType: string): string {
    const mapping: { [key: string]: string } = {
      'bedroom': 'BEDROOM',
      'bathroom': 'BATHROOM',
      'kitchen': 'KITCHEN',
      'living_room': 'LIVING_ROOM',
      'dining_room': 'DINING_ROOM',
      'office': 'HOME_OFFICE',
      'powder_room': 'POWDER_ROOM',
      'laundry': 'LAUNDRY',
      'closet': 'CLOSET',
      'mudroom': 'MUDROOM'
    };

    return mapping[legacyType.toLowerCase()] || 'OTHER';
  }

  /**
   * Map legacy item status to new enum values
   */
  private mapItemState(legacyStatus: string): string {
    const mapping: { [key: string]: string } = {
      'pending': 'PENDING',
      'selected': 'SELECTED',
      'confirmed': 'CONFIRMED',
      'completed': 'COMPLETED',
      'not_applicable': 'NOT_APPLICABLE'
    };

    return mapping[legacyStatus.toLowerCase()] || 'PENDING';
  }

  /**
   * Generate migration report
   */
  private async generateReport(): Promise<void> {
    const reportDir = path.join(process.cwd(), 'migration-reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const reportFile = path.join(
      reportDir, 
      `ffe-migration-${this.report.orgId}-${Date.now()}.json`
    );

    fs.writeFileSync(reportFile, JSON.stringify(this.report, null, 2));
    
    this.log(`Migration report saved: ${reportFile}`);

    // Also create a summary CSV
    const csvFile = path.join(
      reportDir,
      `ffe-migration-summary-${this.report.orgId}-${Date.now()}.csv`
    );

    const csvContent = [
      'Room ID,Room Name,Room Type,Template ID,Items Count,Completed Items,Errors',
      ...this.report.rooms.map(room => 
        `${room.roomId},${room.roomName},${room.roomType},${room.templateId},${room.itemsCount},${room.completedItems},"${room.errors.join('; ')}"`
      )
    ].join('\n');

    fs.writeFileSync(csvFile, csvContent);
    this.log(`Migration summary CSV saved: ${csvFile}`);
  }

  /**
   * Main migration process
   */
  public async migrate(): Promise<void> {
    try {
      this.log('Starting FFE data migration...');
      this.log(`Mode: ${this.isDryRun ? 'DRY RUN' : 'EXECUTE'}`);

      // Get target organizations
      const orgs = this.targetOrgId 
        ? [{ id: this.targetOrgId }]
        : await this.prisma.organization.findMany({ select: { id: true } });

      this.report.summary.totalOrgs = orgs.length;
      this.log(`Found ${orgs.length} organization(s) to migrate`);

      for (const org of orgs) {
        this.log(`Processing organization: ${org.id}`);

        // Extract legacy data
        const legacyData = await this.extractLegacyData(org.id);
        if (!legacyData) {
          continue;
        }

        // Create templates
        const templateIds = await this.createTemplates(legacyData);
        
        // Create room instances
        await this.createRoomInstances(legacyData, templateIds);

        this.log(`Completed migration for org: ${org.id}`);
      }

      // Generate reports
      await this.generateReport();

      // Print summary
      this.printSummary();

    } catch (error) {
      this.log(`Migration failed: ${error}`, 'ERROR');
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  private printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('FFE DATA MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Mode: ${this.isDryRun ? 'DRY RUN' : 'EXECUTE'}`);
    console.log(`Organizations processed: ${this.report.summary.totalOrgs}`);
    console.log(`Rooms processed: ${this.report.summary.totalRooms}`);
    console.log(`Templates created: ${this.report.summary.templatesCreated}`);
    console.log(`Room instances created: ${this.report.summary.roomInstancesCreated}`);
    console.log(`Items migrated: ${this.report.summary.itemsMigrated}`);
    console.log(`Errors: ${this.report.summary.errors}`);
    
    if (this.report.unmappedItems.length > 0) {
      console.log(`Unmapped items: ${this.report.unmappedItems.length}`);
    }

    console.log('\nNext steps:');
    if (this.isDryRun) {
      console.log('- Review the migration report');
      console.log('- Run with --execute to perform actual migration');
    } else {
      console.log('- Verify migrated data in the database');
      console.log('- Test the new FFE workflow');
      console.log('- Consider running legacy cleanup after validation');
    }
    console.log('='.repeat(60));
  }
}

// Command line execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const isDryRun = !args.includes('--execute');
  const orgId = args.find(arg => arg.startsWith('--org='))?.split('=')[1];

  const migrator = new FFEDataMigrator(isDryRun, orgId);
  
  migrator.migrate()
    .then(() => {
      console.log('Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export default FFEDataMigrator;