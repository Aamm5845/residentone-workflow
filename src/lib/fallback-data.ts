// Fallback data when database is unavailable
export const fallbackProjects = [
  {
    id: 'project-1',
    name: 'Johnson Residence',
    description: 'Complete residential renovation',
    type: 'RESIDENTIAL',
    status: 'IN_PROGRESS',
    budget: 150000,
    dueDate: new Date('2024-06-01'),
    client: {
      id: 'client-1',
      name: 'John & Jane Resident',
      email: 'john@johnsonresidence.com',
      phone: '(555) 123-4567'
    },
    rooms: [
      {
        id: 'room-1',
        name: 'Entrance - Feldman',
        type: 'ENTRANCE',
        status: 'IN_PROGRESS',
        currentStage: 'DESIGN',
        stages: [
          {
            id: 'stage-1',
            type: 'DESIGN',
            status: 'IN_PROGRESS',
            assignedUser: { name: 'Aaron (Designer)' },
            designSections: [
              {
                id: 'section-1',
                type: 'WALLS',
                content: 'Feature wall with custom millwork and integrated lighting. Neutral paint colors throughout.',
                updatedAt: new Date('2024-01-15'),
                assets: [],
                comments: []
              },
              {
                id: 'section-2',
                type: 'FURNITURE',
                content: 'Welcome bench, console table with mirror, and decorative lighting fixture.',
                updatedAt: new Date('2024-01-14'),
                assets: [],
                comments: []
              }
            ]
          },
          {
            id: 'stage-2',
            type: 'THREE_D',
            status: 'NOT_STARTED',
            assignedUser: { name: 'Vitor (Renderer)' },
            designSections: []
          },
          {
            id: 'stage-3',
            type: 'CLIENT_APPROVAL',
            status: 'NOT_STARTED',
            assignedUser: null,
            designSections: []
          },
          {
            id: 'stage-4',
            type: 'DRAWINGS',
            status: 'NOT_STARTED',
            assignedUser: { name: 'Sammy (Drafter)' },
            designSections: []
          },
          {
            id: 'stage-5',
            type: 'FFE',
            status: 'NOT_STARTED',
            assignedUser: { name: 'Shaya (FFE)' },
            designSections: []
          }
        ],
        ffeItems: [
          {
            id: 'ffe-1',
            name: 'Welcome Bench',
            category: 'Furniture',
            status: 'SOURCING',
            price: 800
          },
          {
            id: 'ffe-2',
            name: 'Console Table',
            category: 'Furniture',
            status: 'NOT_STARTED',
            price: 1200
          }
        ]
      },
      {
        id: 'room-2',
        name: 'Master Bedroom',
        type: 'MASTER_BEDROOM',
        status: 'IN_PROGRESS',
        currentStage: 'DESIGN',
        stages: [
          {
            id: 'stage-6',
            type: 'DESIGN',
            status: 'COMPLETED',
            assignedUser: { name: 'Aaron (Designer)' },
            designSections: []
          },
          {
            id: 'stage-7',
            type: 'THREE_D',
            status: 'IN_PROGRESS',
            assignedUser: { name: 'Vitor (Renderer)' },
            designSections: []
          },
          {
            id: 'stage-8',
            type: 'CLIENT_APPROVAL',
            status: 'NOT_STARTED',
            assignedUser: null,
            designSections: []
          },
          {
            id: 'stage-9',
            type: 'DRAWINGS',
            status: 'NOT_STARTED',
            assignedUser: { name: 'Sammy (Drafter)' },
            designSections: []
          },
          {
            id: 'stage-10',
            type: 'FFE',
            status: 'NOT_STARTED',
            assignedUser: { name: 'Shaya (FFE)' },
            designSections: []
          }
        ],
        ffeItems: []
      },
      {
        id: 'room-3',
        name: 'Living Room',
        type: 'LIVING_ROOM',
        status: 'NOT_STARTED',
        currentStage: null,
        stages: [
          {
            id: 'stage-11',
            type: 'DESIGN',
            status: 'NOT_STARTED',
            assignedUser: { name: 'Aaron (Designer)' },
            designSections: []
          },
          {
            id: 'stage-12',
            type: 'THREE_D',
            status: 'NOT_STARTED',
            assignedUser: { name: 'Vitor (Renderer)' },
            designSections: []
          },
          {
            id: 'stage-13',
            type: 'CLIENT_APPROVAL',
            status: 'NOT_STARTED',
            assignedUser: null,
            designSections: []
          },
          {
            id: 'stage-14',
            type: 'DRAWINGS',
            status: 'NOT_STARTED',
            assignedUser: { name: 'Sammy (Drafter)' },
            designSections: []
          },
          {
            id: 'stage-15',
            type: 'FFE',
            status: 'NOT_STARTED',
            assignedUser: { name: 'Shaya (FFE)' },
            designSections: []
          }
        ],
        ffeItems: []
      }
    ],
    _count: { 
      rooms: 3,
      assets: 12,
      approvals: 2,
      comments: 8
    },
    createdBy: { name: 'Admin User' },
    updatedAt: new Date('2024-01-15')
  },
  {
    id: 'project-2',
    name: 'Smith Residence',
    description: 'Kitchen and living room redesign',
    type: 'RESIDENTIAL',
    status: 'IN_PROGRESS',
    budget: 80000,
    dueDate: new Date('2024-04-15'),
    client: {
      id: 'client-2',
      name: 'Michael & Sarah Smith',
      email: 'michael@example.com',
      phone: '(555) 987-6543'
    },
    rooms: [
      {
        id: 'room-4',
        name: 'Kitchen',
        type: 'KITCHEN',
        status: 'IN_PROGRESS',
        currentStage: 'THREE_D',
        stages: [
          {
            id: 'stage-16',
            type: 'DESIGN',
            status: 'COMPLETED',
            assignedUser: { name: 'Aaron (Designer)' },
            designSections: []
          },
          {
            id: 'stage-17',
            type: 'THREE_D',
            status: 'IN_PROGRESS',
            assignedUser: { name: 'Vitor (Renderer)' },
            designSections: []
          },
          {
            id: 'stage-18',
            type: 'CLIENT_APPROVAL',
            status: 'NOT_STARTED',
            assignedUser: null,
            designSections: []
          },
          {
            id: 'stage-19',
            type: 'DRAWINGS',
            status: 'NOT_STARTED',
            assignedUser: { name: 'Sammy (Drafter)' },
            designSections: []
          },
          {
            id: 'stage-20',
            type: 'FFE',
            status: 'NOT_STARTED',
            assignedUser: { name: 'Shaya (FFE)' },
            designSections: []
          }
        ],
        ffeItems: []
      }
    ],
    _count: { 
      rooms: 1,
      assets: 6,
      approvals: 1,
      comments: 3
    },
    createdBy: { name: 'Admin User' },
    updatedAt: new Date('2024-01-10')
  }
]
