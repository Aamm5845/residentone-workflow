export interface ProjectLevelSection {
  type: string
  name: string
  description: string
}

export const PROJECT_LEVEL_SECTIONS: ProjectLevelSection[] = [
  { type: 'FLOORPLANS', name: 'Floor Plans', description: 'Overall layout and space planning' },
  { type: 'LIGHTING', name: 'Lighting Plans', description: 'Lighting layout and specifications' },
  { type: 'ELECTRICAL', name: 'Electrical Plans', description: 'Electrical layout and outlets' },
  { type: 'PLUMBING', name: 'Plumbing Plans', description: 'Plumbing layout and fixtures' },
  { type: 'STRUCTURAL', name: 'Structural Plans', description: 'Structural modifications and details' },
  { type: 'RCP', name: 'Reflected Ceiling Plans', description: 'Ceiling design and details' },
]