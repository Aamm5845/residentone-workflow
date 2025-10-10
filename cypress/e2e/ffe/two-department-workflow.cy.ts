/// <reference types="cypress" />

describe('FFE Two-Department Workflow', () => {
  beforeEach(() => {
    // Login as admin user to have access to both departments
    cy.login('admin@example.com', 'password')
    
    // Navigate to a test room
    cy.visit('/ffe/room-123/settings')
    
    // Wait for the page to load
    cy.get('[data-testid="ffe-department-router"]').should('exist')
  })

  afterEach(() => {
    // Clean up any test data
    cy.task('cleanupTestData', { roomId: 'room-123' })
  })

  describe('Department Access Control', () => {
    it('should allow admin users to access both Settings and Workspace', () => {
      // Should be in Settings department by default
      cy.get('[data-testid="current-mode"]').should('contain', 'Settings')
      
      // Should be able to switch to Workspace
      cy.get('[data-testid="workspace-toggle"]').click()
      cy.get('[data-testid="current-mode"]').should('contain', 'Workspace')
      
      // Should be able to switch back to Settings
      cy.get('[data-testid="settings-toggle"]').click()
      cy.get('[data-testid="current-mode"]').should('contain', 'Settings')
    })

    it('should redirect non-admin users away from Settings', () => {
      // Login as FFE specialist
      cy.login('ffe@example.com', 'password')
      cy.visit('/ffe/room-123/settings')
      
      // Should be redirected to workspace
      cy.url().should('include', '/ffe/room-123/workspace')
      cy.get('[data-testid="current-mode"]').should('contain', 'Workspace')
    })

    it('should show access denied message for unauthorized users', () => {
      cy.login('viewer@example.com', 'password')
      cy.visit('/ffe/room-123/workspace')
      
      // Should be redirected to projects or show access denied
      cy.url().should('not.include', '/ffe/')
    })
  })

  describe('Settings Department - Item Visibility Control', () => {
    beforeEach(() => {
      cy.visit('/ffe/room-123/settings')
      cy.get('[data-testid="ffe-settings-department"]').should('exist')
    })

    it('should display all items regardless of visibility', () => {
      // Should show both visible and hidden items
      cy.get('[data-testid="ffe-item-card"]').should('have.length.at.least', 2)
      
      // Should show visibility status for each item
      cy.get('[data-testid="visibility-button"]').should('exist')
    })

    it('should hide item from workspace when clicking "Remove"', () => {
      // Find a visible item and hide it
      cy.get('[data-testid="ffe-item-card"]')
        .first()
        .within(() => {
          cy.get('[data-testid="item-name"]').invoke('text').as('itemName')
          cy.get('[data-testid="visibility-button"]')
            .should('contain', 'Use')
            .click()
        })
      
      // Should show success toast
      cy.get('[data-testid="toast"]').should('contain', 'removed from workspace')
      
      // Button should now show "Remove" state
      cy.get('[data-testid="ffe-item-card"]')
        .first()
        .within(() => {
          cy.get('[data-testid="visibility-button"]').should('contain', 'Remove')
        })
      
      // Switch to workspace and verify item is not visible
      cy.get('[data-testid="workspace-toggle"]').click()
      
      cy.get('@itemName').then((itemName) => {
        cy.get('[data-testid="ffe-item-card"]')
          .should('not.contain', itemName)
      })
    })

    it('should make hidden item visible when clicking "Use"', () => {
      // First hide an item
      cy.get('[data-testid="ffe-item-card"]')
        .first()
        .within(() => {
          cy.get('[data-testid="item-name"]').invoke('text').as('itemName')
          cy.get('[data-testid="visibility-button"]').click()
        })
      
      // Now make it visible again
      cy.get('[data-testid="ffe-item-card"]')
        .first()
        .within(() => {
          cy.get('[data-testid="visibility-button"]')
            .should('contain', 'Remove')
            .click()
        })
      
      // Should show success toast
      cy.get('[data-testid="toast"]').should('contain', 'added to workspace')
      
      // Switch to workspace and verify item is visible
      cy.get('[data-testid="workspace-toggle"]').click()
      
      cy.get('@itemName').then((itemName) => {
        cy.get('[data-testid="ffe-item-card"]')
          .should('contain', itemName)
      })
    })

    it('should preserve notes when changing visibility', () => {
      // Add notes to an item
      const testNotes = 'These notes should persist when item is hidden'
      
      cy.get('[data-testid="ffe-item-card"]')
        .first()
        .within(() => {
          cy.get('[data-testid="notes-button"]').click()
        })
      
      cy.get('[data-testid="notes-textarea"]')
        .clear()
        .type(testNotes)
      
      cy.get('[data-testid="notes-save"]').click()
      
      // Hide the item
      cy.get('[data-testid="ffe-item-card"]')
        .first()
        .within(() => {
          cy.get('[data-testid="visibility-button"]').click()
        })
      
      // Make it visible again
      cy.get('[data-testid="ffe-item-card"]')
        .first()
        .within(() => {
          cy.get('[data-testid="visibility-button"]').click()
        })
      
      // Check that notes are still there
      cy.get('[data-testid="ffe-item-card"]')
        .first()
        .within(() => {
          cy.get('[data-testid="notes-button"]').click()
        })
      
      cy.get('[data-testid="notes-textarea"]')
        .should('have.value', testNotes)
    })

    it('should perform bulk visibility operations', () => {
      // Use "Use All" button
      cy.get('[data-testid="use-all-button"]').click()
      
      // Should show success toast
      cy.get('[data-testid="toast"]').should('contain', 'All items added to workspace')
      
      // All visibility buttons should show "Use" state
      cy.get('[data-testid="visibility-button"]').each(($btn) => {
        cy.wrap($btn).should('contain', 'Use')
      })
      
      // Use "Hide All" button
      cy.get('[data-testid="hide-all-button"]').click()
      
      // Should show success toast
      cy.get('[data-testid="toast"]').should('contain', 'All items removed from workspace')
      
      // All visibility buttons should show "Remove" state
      cy.get('[data-testid="visibility-button"]').each(($btn) => {
        cy.wrap($btn).should('contain', 'Remove')
      })
    })
  })

  describe('Workspace Department - Task Execution', () => {
    beforeEach(() => {
      // Ensure we have some visible items to work with
      cy.visit('/ffe/room-123/settings')
      cy.get('[data-testid="use-all-button"]').click()
      
      // Switch to workspace
      cy.get('[data-testid="workspace-toggle"]').click()
      cy.get('[data-testid="ffe-workspace-department"]').should('exist')
    })

    it('should display only visible items', () => {
      // Should only show items marked as visible in settings
      cy.get('[data-testid="ffe-item-card"]').should('exist')
      
      // Should not show add/delete/import controls
      cy.get('[data-testid="add-section-button"]').should('not.exist')
      cy.get('[data-testid="add-item-button"]').should('not.exist')
      cy.get('[data-testid="import-template-button"]').should('not.exist')
    })

    it('should allow state transitions: Pending → Undecided → Completed', () => {
      cy.get('[data-testid="ffe-item-card"]')
        .first()
        .within(() => {
          // Should start in PENDING state
          cy.get('[data-testid="item-state"]').should('contain', 'Pending')
          
          // Change to UNDECIDED
          cy.get('[data-testid="state-undecided-button"]').click()
          cy.get('[data-testid="item-state"]').should('contain', 'Undecided')
          
          // Change to COMPLETED
          cy.get('[data-testid="state-completed-button"]').click()
          cy.get('[data-testid="item-state"]').should('contain', 'Completed')
          
          // Should be able to reopen
          cy.get('[data-testid="state-pending-button"]').click()
          cy.get('[data-testid="item-state"]').should('contain', 'Pending')
        })
      
      // Should show success toasts for each change
      cy.get('[data-testid="toast"]').should('have.length.at.least', 3)
    })

    it('should persist notes across state changes', () => {
      const testNotes = 'Notes should survive state transitions'
      
      // Add notes to an item
      cy.get('[data-testid="ffe-item-card"]')
        .first()
        .within(() => {
          cy.get('[data-testid="notes-button"]').click()
        })
      
      cy.get('[data-testid="notes-textarea"]')
        .clear()
        .type(testNotes)
      
      cy.get('[data-testid="notes-save"]').click()
      
      // Change item state
      cy.get('[data-testid="ffe-item-card"]')
        .first()
        .within(() => {
          cy.get('[data-testid="state-completed-button"]').click()
        })
      
      // Verify notes are still there
      cy.get('[data-testid="ffe-item-card"]')
        .first()
        .within(() => {
          cy.get('[data-testid="notes-button"]').click()
        })
      
      cy.get('[data-testid="notes-textarea"]')
        .should('have.value', testNotes)
      
      // Change state again
      cy.get('[data-testid="notes-save"]').click() // Close notes dialog
      cy.get('[data-testid="ffe-item-card"]')
        .first()
        .within(() => {
          cy.get('[data-testid="state-undecided-button"]').click()
        })
      
      // Verify notes still persist
      cy.get('[data-testid="ffe-item-card"]')
        .first()
        .within(() => {
          cy.get('[data-testid="notes-button"]').click()
        })
      
      cy.get('[data-testid="notes-textarea"]')
        .should('have.value', testNotes)
    })

    it('should show progress statistics and completion tracking', () => {
      // Should display progress overview
      cy.get('[data-testid="progress-overview"]').should('exist')
      cy.get('[data-testid="total-items"]').should('contain.text', 'Total Items')
      cy.get('[data-testid="completed-items"]').should('contain.text', 'Completed')
      
      // Complete an item and verify progress updates
      cy.get('[data-testid="total-items"]').invoke('text').as('initialTotal')
      cy.get('[data-testid="completed-items"]').invoke('text').as('initialCompleted')
      
      cy.get('[data-testid="ffe-item-card"]')
        .first()
        .within(() => {
          cy.get('[data-testid="state-completed-button"]').click()
        })
      
      // Progress should update
      cy.get('[data-testid="completed-items"]').should('not.contain', '@initialCompleted')
      cy.get('[data-testid="progress-percentage"]').should('exist')
    })

    it('should handle page reload without losing notes', () => {
      const testNotes = 'These notes should survive page reload'
      
      // Add notes to an item
      cy.get('[data-testid="ffe-item-card"]')
        .first()
        .within(() => {
          cy.get('[data-testid="item-name"]').invoke('text').as('itemName')
          cy.get('[data-testid="notes-button"]').click()
        })
      
      cy.get('[data-testid="notes-textarea"]')
        .clear()
        .type(testNotes)
      
      cy.get('[data-testid="notes-save"]').click()
      
      // Change state
      cy.get('[data-testid="ffe-item-card"]')
        .first()
        .within(() => {
          cy.get('[data-testid="state-completed-button"]').click()
        })
      
      // Reload the page
      cy.reload()
      
      // Wait for page to load
      cy.get('[data-testid="ffe-workspace-department"]').should('exist')
      
      // Find the same item and verify notes and state persist
      cy.get('@itemName').then((itemName) => {
        cy.contains('[data-testid="ffe-item-card"]', itemName as string)
          .within(() => {
            cy.get('[data-testid="item-state"]').should('contain', 'Completed')
            cy.get('[data-testid="notes-button"]').click()
          })
      })
      
      cy.get('[data-testid="notes-textarea"]')
        .should('have.value', testNotes)
    })
  })

  describe('Cross-Department Integration', () => {
    it('should sync visibility changes between departments in real-time', () => {
      // Start in settings
      cy.visit('/ffe/room-123/settings')
      
      // Hide an item
      cy.get('[data-testid="ffe-item-card"]')
        .first()
        .within(() => {
          cy.get('[data-testid="item-name"]').invoke('text').as('itemName')
          cy.get('[data-testid="visibility-button"]').click()
        })
      
      // Switch to workspace
      cy.get('[data-testid="workspace-toggle"]').click()
      
      // Item should not be visible
      cy.get('@itemName').then((itemName) => {
        cy.get('[data-testid="ffe-item-card"]')
          .should('not.contain', itemName)
      })
      
      // Switch back to settings
      cy.get('[data-testid="settings-toggle"]').click()
      
      // Make item visible again
      cy.get('[data-testid="ffe-item-card"]')
        .first()
        .within(() => {
          cy.get('[data-testid="visibility-button"]').click()
        })
      
      // Switch to workspace
      cy.get('[data-testid="workspace-toggle"]').click()
      
      // Item should now be visible
      cy.get('@itemName').then((itemName) => {
        cy.get('[data-testid="ffe-item-card"]')
          .should('contain', itemName)
      })
    })

    it('should maintain user context when switching departments', () => {
      cy.visit('/ffe/room-123/settings')
      
      // User should see admin features in settings
      cy.get('[data-testid="import-template-button"]').should('exist')
      cy.get('[data-testid="add-section-button"]').should('exist')
      
      // Switch to workspace
      cy.get('[data-testid="workspace-toggle"]').click()
      
      // Should maintain user context but hide admin-only features
      cy.get('[data-testid="import-template-button"]').should('not.exist')
      cy.get('[data-testid="add-section-button"]').should('not.exist')
      
      // But should show workspace features appropriate for admin
      cy.get('[data-testid="progress-overview"]').should('exist')
      cy.get('[data-testid="state-completed-button"]').should('exist')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle API errors gracefully', () => {
      // Mock API failure
      cy.intercept('PATCH', '/api/ffe/v2/rooms/*/items/*/visibility', {
        statusCode: 500,
        body: { error: 'Internal server error' }
      })
      
      cy.visit('/ffe/room-123/settings')
      
      // Try to change visibility
      cy.get('[data-testid="ffe-item-card"]')
        .first()
        .within(() => {
          cy.get('[data-testid="visibility-button"]').click()
        })
      
      // Should show error toast
      cy.get('[data-testid="toast"]')
        .should('contain', 'Failed to update')
        .and('have.class', 'error')
    })

    it('should handle empty workspace gracefully', () => {
      // Hide all items in settings
      cy.visit('/ffe/room-123/settings')
      cy.get('[data-testid="hide-all-button"]').click()
      
      // Switch to workspace
      cy.get('[data-testid="workspace-toggle"]').click()
      
      // Should show empty state message
      cy.get('[data-testid="empty-workspace"]')
        .should('contain', 'No items visible in this workspace')
      
      // Should provide guidance to go to settings
      cy.get('[data-testid="empty-workspace"]')
        .should('contain', 'Visit the FFE Settings')
    })

    it('should handle network connectivity issues', () => {
      cy.visit('/ffe/room-123/workspace')
      
      // Simulate offline condition
      cy.window().then((win) => {
        win.navigator.serviceWorker.getRegistration().then((registration) => {
          if (registration) {
            registration.unregister()
          }
        })
      })
      
      // Mock network failure
      cy.intercept('PATCH', '/api/ffe/v2/rooms/*/items', {
        forceNetworkError: true
      })
      
      // Try to change state
      cy.get('[data-testid="ffe-item-card"]')
        .first()
        .within(() => {
          cy.get('[data-testid="state-completed-button"]').click()
        })
      
      // Should show network error message
      cy.get('[data-testid="toast"]')
        .should('contain', 'network')
        .and('have.class', 'error')
    })
  })
})