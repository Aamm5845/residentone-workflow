/**
 * FFE Feature Flags System
 * 
 * Manages the rollout of the new FFE template system with granular control
 * over features and access for different organizations and user roles.
 */

export interface FFEFeatureFlags {
  // Core system flags
  ffeV2Enabled: boolean;
  templateManagementEnabled: boolean;
  legacySystemEnabled: boolean;
  
  // UI feature flags
  templateSelectorEnabled: boolean;
  bulkTemplateActionsEnabled: boolean;
  advancedTemplateEditorEnabled: boolean;
  
  // API feature flags
  v2ApiEnabled: boolean;
  dataMigrationEnabled: boolean;
  
  // Admin features
  legacyCleanupEnabled: boolean;
  systemDiagnosticsEnabled: boolean;
}

export interface FFERolePermissions {
  // Template management permissions
  canViewTemplates: boolean;
  canCreateTemplates: boolean;
  canEditTemplates: boolean;
  canDeleteTemplates: boolean;
  canCopyTemplates: boolean;
  
  // FFE workflow permissions
  canAccessFFEWorkflow: boolean;
  canEditFFEItems: boolean;
  canCompleteFFEPhases: boolean;
  
  // System administration
  canManageFeatureFlags: boolean;
  canAccessLegacyCleanup: boolean;
  canRunDataMigration: boolean;
  canViewSystemDiagnostics: boolean;
}

export type UserRole = 'ADMIN' | 'DESIGNER' | 'FFE' | 'VIEWER';
export type FeatureFlagScope = 'GLOBAL' | 'ORG' | 'USER';

class FFEFeatureFlagManager {
  private static instance: FFEFeatureFlagManager;
  private flags: Map<string, FFEFeatureFlags> = new Map();
  private rolePermissions: Map<UserRole, FFERolePermissions> = new Map();

  private constructor() {
    this.initializeRolePermissions();
  }

  public static getInstance(): FFEFeatureFlagManager {
    if (!FFEFeatureFlagManager.instance) {
      FFEFeatureFlagManager.instance = new FFEFeatureFlagManager();
    }
    return FFEFeatureFlagManager.instance;
  }

  private initializeRolePermissions() {
    // ADMIN permissions (full access)
    this.rolePermissions.set('ADMIN', {
      canViewTemplates: true,
      canCreateTemplates: true,
      canEditTemplates: true,
      canDeleteTemplates: true,
      canCopyTemplates: true,
      canAccessFFEWorkflow: true,
      canEditFFEItems: true,
      canCompleteFFEPhases: true,
      canManageFeatureFlags: true,
      canAccessLegacyCleanup: true,
      canRunDataMigration: true,
      canViewSystemDiagnostics: true
    });

    // DESIGNER permissions (template and workflow management)
    this.rolePermissions.set('DESIGNER', {
      canViewTemplates: true,
      canCreateTemplates: true,
      canEditTemplates: true,
      canDeleteTemplates: false, // Cannot delete templates
      canCopyTemplates: true,
      canAccessFFEWorkflow: true,
      canEditFFEItems: true,
      canCompleteFFEPhases: true,
      canManageFeatureFlags: false,
      canAccessLegacyCleanup: false,
      canRunDataMigration: false,
      canViewSystemDiagnostics: false
    });

    // FFE role permissions (workflow focused)
    this.rolePermissions.set('FFE', {
      canViewTemplates: true,
      canCreateTemplates: false,
      canEditTemplates: false,
      canDeleteTemplates: false,
      canCopyTemplates: false,
      canAccessFFEWorkflow: true,
      canEditFFEItems: true,
      canCompleteFFEPhases: true,
      canManageFeatureFlags: false,
      canAccessLegacyCleanup: false,
      canRunDataMigration: false,
      canViewSystemDiagnostics: false
    });

    // VIEWER permissions (read-only)
    this.rolePermissions.set('VIEWER', {
      canViewTemplates: true,
      canCreateTemplates: false,
      canEditTemplates: false,
      canDeleteTemplates: false,
      canCopyTemplates: false,
      canAccessFFEWorkflow: false,
      canEditFFEItems: false,
      canCompleteFFEPhases: false,
      canManageFeatureFlags: false,
      canAccessLegacyCleanup: false,
      canRunDataMigration: false,
      canViewSystemDiagnostics: false
    });
  }

  /**
   * Get default feature flags for rollout phases
   */
  public getDefaultFlags(phase: 'BETA' | 'PILOT' | 'PRODUCTION'): FFEFeatureFlags {
    const baseFlags: FFEFeatureFlags = {
      ffeV2Enabled: false,
      templateManagementEnabled: false,
      legacySystemEnabled: true,
      templateSelectorEnabled: false,
      bulkTemplateActionsEnabled: false,
      advancedTemplateEditorEnabled: false,
      v2ApiEnabled: false,
      dataMigrationEnabled: false,
      legacyCleanupEnabled: false,
      systemDiagnosticsEnabled: false
    };

    switch (phase) {
      case 'BETA':
        return {
          ...baseFlags,
          ffeV2Enabled: true,
          templateManagementEnabled: true,
          templateSelectorEnabled: true,
          v2ApiEnabled: true,
          systemDiagnosticsEnabled: true
        };

      case 'PILOT':
        return {
          ...baseFlags,
          ffeV2Enabled: true,
          templateManagementEnabled: true,
          templateSelectorEnabled: true,
          bulkTemplateActionsEnabled: true,
          advancedTemplateEditorEnabled: true,
          v2ApiEnabled: true,
          dataMigrationEnabled: true,
          systemDiagnosticsEnabled: true
        };

      case 'PRODUCTION':
        return {
          ...baseFlags,
          ffeV2Enabled: true,
          templateManagementEnabled: true,
          legacySystemEnabled: false, // Legacy system disabled
          templateSelectorEnabled: true,
          bulkTemplateActionsEnabled: true,
          advancedTemplateEditorEnabled: true,
          v2ApiEnabled: true,
          dataMigrationEnabled: true,
          legacyCleanupEnabled: true
        };

      default:
        return baseFlags;
    }
  }

  /**
   * Get feature flags for a specific context (org, user)
   */
  public getFlags(
    orgId: string, 
    userId?: string, 
    defaultPhase: 'BETA' | 'PILOT' | 'PRODUCTION' = 'BETA'
  ): FFEFeatureFlags {
    // Priority: USER > ORG > GLOBAL
    const userKey = userId ? `USER:${userId}` : null;
    const orgKey = `ORG:${orgId}`;
    const globalKey = 'GLOBAL';

    if (userKey && this.flags.has(userKey)) {
      return this.flags.get(userKey)!;
    }

    if (this.flags.has(orgKey)) {
      return this.flags.get(orgKey)!;
    }

    if (this.flags.has(globalKey)) {
      return this.flags.get(globalKey)!;
    }

    // Return default flags based on phase
    return this.getDefaultFlags(defaultPhase);
  }

  /**
   * Set feature flags for a specific scope
   */
  public setFlags(
    scope: FeatureFlagScope,
    identifier: string,
    flags: Partial<FFEFeatureFlags>
  ) {
    const key = `${scope}:${identifier}`;
    const existingFlags = this.flags.get(key) || this.getDefaultFlags('BETA');
    
    this.flags.set(key, {
      ...existingFlags,
      ...flags
    });
  }

  /**
   * Get role permissions
   */
  public getRolePermissions(role: UserRole): FFERolePermissions {
    return this.rolePermissions.get(role) || this.rolePermissions.get('VIEWER')!;
  }

  /**
   * Check if user has permission for a specific action
   */
  public hasPermission(
    role: UserRole,
    permission: keyof FFERolePermissions
  ): boolean {
    const permissions = this.getRolePermissions(role);
    return permissions[permission];
  }

  /**
   * Check if a feature is enabled for a user/org
   */
  public isFeatureEnabled(
    featureName: keyof FFEFeatureFlags,
    orgId: string,
    userId?: string
  ): boolean {
    const flags = this.getFlags(orgId, userId);
    return flags[featureName];
  }

  /**
   * Get combined access check (both feature flag and permission)
   */
  public canAccess(
    featureName: keyof FFEFeatureFlags,
    permission: keyof FFERolePermissions,
    orgId: string,
    role: UserRole,
    userId?: string
  ): boolean {
    const featureEnabled = this.isFeatureEnabled(featureName, orgId, userId);
    const hasPermission = this.hasPermission(role, permission);
    
    return featureEnabled && hasPermission;
  }

  /**
   * Initialize organization with specific rollout phase
   */
  public initializeOrg(orgId: string, phase: 'BETA' | 'PILOT' | 'PRODUCTION') {
    const flags = this.getDefaultFlags(phase);
    this.setFlags('ORG', orgId, flags);
  }

  /**
   * Get rollout status summary
   */
  public getRolloutStatus() {
    const summary = {
      totalOrgs: 0,
      enabledOrgs: 0,
      betaOrgs: 0,
      pilotOrgs: 0,
      productionOrgs: 0,
      flags: Array.from(this.flags.entries())
    };

    this.flags.forEach((flags, key) => {
      if (key.startsWith('ORG:')) {
        summary.totalOrgs++;
        
        if (flags.ffeV2Enabled) {
          summary.enabledOrgs++;
          
          if (flags.legacySystemEnabled) {
            if (flags.bulkTemplateActionsEnabled) {
              summary.pilotOrgs++;
            } else {
              summary.betaOrgs++;
            }
          } else {
            summary.productionOrgs++;
          }
        }
      }
    });

    return summary;
  }
}

// Singleton instance
export const ffeFeatureFlags = FFEFeatureFlagManager.getInstance();

// Utility hooks and functions for React components
export function useFFEFeatureFlags(orgId: string, userId?: string) {
  return ffeFeatureFlags.getFlags(orgId, userId);
}

export function useFFERolePermissions(role: UserRole) {
  return ffeFeatureFlags.getRolePermissions(role);
}

export function useFFEAccess(
  featureName: keyof FFEFeatureFlags,
  permission: keyof FFERolePermissions,
  orgId: string,
  role: UserRole,
  userId?: string
) {
  return ffeFeatureFlags.canAccess(featureName, permission, orgId, role, userId);
}

// API middleware helpers
export function requireFFEFeature(featureName: keyof FFEFeatureFlags) {
  return (orgId: string, userId?: string) => {
    return ffeFeatureFlags.isFeatureEnabled(featureName, orgId, userId);
  };
}

export function requireFFEPermission(permission: keyof FFERolePermissions) {
  return (role: UserRole) => {
    return ffeFeatureFlags.hasPermission(role, permission);
  };
}

// Environment-based configuration
export function initializeFFEFeatureFlags() {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Global defaults based on environment
  if (isDevelopment) {
    // Development: Enable all features for testing
    ffeFeatureFlags.setFlags('GLOBAL', 'default', {
      ffeV2Enabled: true,
      templateManagementEnabled: true,
      legacySystemEnabled: true,
      templateSelectorEnabled: true,
      bulkTemplateActionsEnabled: true,
      advancedTemplateEditorEnabled: true,
      v2ApiEnabled: true,
      dataMigrationEnabled: true,
      legacyCleanupEnabled: true,
      systemDiagnosticsEnabled: true
    });
  } else if (isProduction) {
    // Production: Conservative defaults
    ffeFeatureFlags.setFlags('GLOBAL', 'default', {
      ffeV2Enabled: false,
      templateManagementEnabled: false,
      legacySystemEnabled: true,
      templateSelectorEnabled: false,
      bulkTemplateActionsEnabled: false,
      advancedTemplateEditorEnabled: false,
      v2ApiEnabled: false,
      dataMigrationEnabled: false,
      legacyCleanupEnabled: false,
      systemDiagnosticsEnabled: false
    });
  }
}

// Initialize on import
initializeFFEFeatureFlags();
