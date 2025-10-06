/**
 * Integration tests for FFE Templates API
 * 
 * Tests the complete API flow including authentication,
 * validation, and database operations.
 */

import { describe, beforeEach, afterEach, it, expect, beforeAll, afterAll } from '@jest/globals';
import { testSetup, testCleanup, createTestUser, createTestOrg } from '@/test-utils/setup';
import { NextRequest } from 'next/server';
import { GET, POST, PUT, DELETE } from '@/app/api/ffe/v2/templates/route';
import { GET as GET_BY_ID, PUT as PUT_BY_ID, DELETE as DELETE_BY_ID, POST as COPY_TEMPLATE } from '@/app/api/ffe/v2/templates/[id]/route';

describe('FFE Templates API Integration Tests', () => {
  let testOrgId: string;
  let testUserId: string;
  let adminToken: string;
  let designerToken: string;
  let viewerToken: string;
  let createdTemplateId: string;

  beforeAll(async () => {
    await testSetup();
    
    // Create test organization
    const org = await createTestOrg('Test Organization');
    testOrgId = org.id;

    // Create test users with different roles
    const adminUser = await createTestUser('admin@test.com', 'ADMIN', testOrgId);
    const designerUser = await createTestUser('designer@test.com', 'DESIGNER', testOrgId);
    const viewerUser = await createTestUser('viewer@test.com', 'VIEWER', testOrgId);

    testUserId = adminUser.id;
    adminToken = adminUser.token;
    designerToken = designerUser.token;
    viewerToken = viewerUser.token;
  });

  afterAll(async () => {
    await testCleanup();
  });

  describe('GET /api/ffe/v2/templates', () => {
    it('should return templates for authenticated user', async () => {
      const request = new NextRequest('http://localhost/api/ffe/v2/templates', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'X-Org-ID': testOrgId,
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('templates');
      expect(Array.isArray(data.templates)).toBe(true);
    });

    it('should filter templates by room type', async () => {
      // First create a template
      const createRequest = new NextRequest('http://localhost/api/ffe/v2/templates', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'X-Org-ID': testOrgId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test Bedroom Template',
          description: 'A test bedroom template',
          roomType: 'BEDROOM',
          isActive: true,
          sections: [
            {
              name: 'Flooring',
              order: 0,
              items: [
                {
                  name: 'Hardwood Floor',
                  description: 'Premium oak hardwood',
                  defaultState: 'PENDING',
                  isRequired: true,
                  estimatedCost: 5000,
                  notes: '',
                },
              ],
            },
          ],
        }),
      });

      const createResponse = await POST(createRequest);
      const createData = await createResponse.json();
      createdTemplateId = createData.template.id;

      // Now test filtering
      const filterRequest = new NextRequest('http://localhost/api/ffe/v2/templates?roomType=BEDROOM', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'X-Org-ID': testOrgId,
        },
      });

      const response = await GET(filterRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.templates.length).toBeGreaterThan(0);
      expect(data.templates.every((t: any) => t.roomType === 'BEDROOM')).toBe(true);
    });

    it('should require authentication', async () => {
      const request = new NextRequest('http://localhost/api/ffe/v2/templates', {
        method: 'GET',
        headers: {
          'X-Org-ID': testOrgId,
        },
      });

      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('should require organization ID', async () => {
      const request = new NextRequest('http://localhost/api/ffe/v2/templates', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });

      const response = await GET(request);

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/ffe/v2/templates', () => {
    it('should create template with admin role', async () => {
      const templateData = {
        name: 'New Bathroom Template',
        description: 'A comprehensive bathroom template',
        roomType: 'BATHROOM',
        isActive: true,
        sections: [
          {
            name: 'Plumbing',
            order: 0,
            items: [
              {
                name: 'Shower',
                description: 'Walk-in shower',
                defaultState: 'PENDING',
                isRequired: true,
                estimatedCost: 3000,
                notes: '',
              },
              {
                name: 'Vanity',
                description: 'Double sink vanity',
                defaultState: 'PENDING',
                isRequired: true,
                estimatedCost: 2000,
                notes: '',
              },
            ],
          },
          {
            name: 'Lighting',
            order: 1,
            items: [
              {
                name: 'Vanity Lights',
                description: 'LED vanity lighting',
                defaultState: 'PENDING',
                isRequired: false,
                estimatedCost: 500,
                notes: '',
              },
            ],
          },
        ],
      };

      const request = new NextRequest('http://localhost/api/ffe/v2/templates', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'X-Org-ID': testOrgId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(templateData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toHaveProperty('template');
      expect(data.template.name).toBe(templateData.name);
      expect(data.template.roomType).toBe(templateData.roomType);
      expect(data.template.sections).toHaveLength(2);
      expect(data.template.sections[0].items).toHaveLength(2);
      expect(data.template.sections[1].items).toHaveLength(1);

      // Store for later tests
      createdTemplateId = data.template.id;
    });

    it('should create template with designer role', async () => {
      const templateData = {
        name: 'Designer Kitchen Template',
        description: 'Kitchen template by designer',
        roomType: 'KITCHEN',
        isActive: true,
        sections: [],
      };

      const request = new NextRequest('http://localhost/api/ffe/v2/templates', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${designerToken}`,
          'X-Org-ID': testOrgId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(templateData),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
    });

    it('should reject creation with viewer role', async () => {
      const templateData = {
        name: 'Viewer Template',
        roomType: 'BEDROOM',
        isActive: true,
        sections: [],
      };

      const request = new NextRequest('http://localhost/api/ffe/v2/templates', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${viewerToken}`,
          'X-Org-ID': testOrgId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(templateData),
      });

      const response = await POST(request);

      expect(response.status).toBe(403);
    });

    it('should validate required fields', async () => {
      const invalidData = {
        name: '', // Empty name
        roomType: 'BEDROOM',
        isActive: true,
        sections: [],
      };

      const request = new NextRequest('http://localhost/api/ffe/v2/templates', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'X-Org-ID': testOrgId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidData),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should validate room type enum', async () => {
      const invalidData = {
        name: 'Test Template',
        roomType: 'INVALID_ROOM_TYPE',
        isActive: true,
        sections: [],
      };

      const request = new NextRequest('http://localhost/api/ffe/v2/templates', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'X-Org-ID': testOrgId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidData),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/ffe/v2/templates/[id]', () => {
    it('should return specific template by ID', async () => {
      const request = new NextRequest(`http://localhost/api/ffe/v2/templates/${createdTemplateId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'X-Org-ID': testOrgId,
        },
      });

      const response = await GET_BY_ID(request, { params: { id: createdTemplateId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('template');
      expect(data.template.id).toBe(createdTemplateId);
    });

    it('should return 404 for non-existent template', async () => {
      const request = new NextRequest('http://localhost/api/ffe/v2/templates/non-existent-id', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'X-Org-ID': testOrgId,
        },
      });

      const response = await GET_BY_ID(request, { params: { id: 'non-existent-id' } });

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/ffe/v2/templates/[id]', () => {
    it('should update template with admin role', async () => {
      const updateData = {
        name: 'Updated Template Name',
        description: 'Updated description',
        isActive: false,
      };

      const request = new NextRequest(`http://localhost/api/ffe/v2/templates/${createdTemplateId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'X-Org-ID': testOrgId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      const response = await PUT_BY_ID(request, { params: { id: createdTemplateId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.template.name).toBe(updateData.name);
      expect(data.template.description).toBe(updateData.description);
      expect(data.template.isActive).toBe(updateData.isActive);
    });

    it('should update template with designer role', async () => {
      const updateData = {
        description: 'Designer updated description',
      };

      const request = new NextRequest(`http://localhost/api/ffe/v2/templates/${createdTemplateId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${designerToken}`,
          'X-Org-ID': testOrgId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      const response = await PUT_BY_ID(request, { params: { id: createdTemplateId } });

      expect(response.status).toBe(200);
    });

    it('should reject update with viewer role', async () => {
      const updateData = {
        name: 'Viewer Update',
      };

      const request = new NextRequest(`http://localhost/api/ffe/v2/templates/${createdTemplateId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${viewerToken}`,
          'X-Org-ID': testOrgId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      const response = await PUT_BY_ID(request, { params: { id: createdTemplateId } });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/ffe/v2/templates/[id]/copy', () => {
    it('should copy template with new name', async () => {
      const copyData = {
        name: 'Copied Template',
      };

      const request = new NextRequest(`http://localhost/api/ffe/v2/templates/${createdTemplateId}/copy`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'X-Org-ID': testOrgId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(copyData),
      });

      const response = await COPY_TEMPLATE(request, { params: { id: createdTemplateId } });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.template.name).toBe(copyData.name);
      expect(data.template.id).not.toBe(createdTemplateId);
      expect(data.template.sections).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: expect.any(String) })
        ])
      );
    });

    it('should reject copy with viewer role', async () => {
      const copyData = {
        name: 'Viewer Copy',
      };

      const request = new NextRequest(`http://localhost/api/ffe/v2/templates/${createdTemplateId}/copy`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${viewerToken}`,
          'X-Org-ID': testOrgId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(copyData),
      });

      const response = await COPY_TEMPLATE(request, { params: { id: createdTemplateId } });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/ffe/v2/templates/[id]', () => {
    it('should reject delete with designer role', async () => {
      const request = new NextRequest(`http://localhost/api/ffe/v2/templates/${createdTemplateId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${designerToken}`,
          'X-Org-ID': testOrgId,
        },
      });

      const response = await DELETE_BY_ID(request, { params: { id: createdTemplateId } });

      expect(response.status).toBe(403);
    });

    it('should delete template with admin role', async () => {
      const request = new NextRequest(`http://localhost/api/ffe/v2/templates/${createdTemplateId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'X-Org-ID': testOrgId,
        },
      });

      const response = await DELETE_BY_ID(request, { params: { id: createdTemplateId } });

      expect(response.status).toBe(200);
    });

    it('should return 404 for already deleted template', async () => {
      const request = new NextRequest(`http://localhost/api/ffe/v2/templates/${createdTemplateId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'X-Org-ID': testOrgId,
        },
      });

      const response = await DELETE_BY_ID(request, { params: { id: createdTemplateId } });

      expect(response.status).toBe(404);
    });
  });
});