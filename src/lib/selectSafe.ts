/**
 * Safe Select Value Utilities
 * 
 * These utilities ensure that Select components never receive empty strings as values,
 * which causes runtime errors in Radix UI Select components.
 */

// Sentinel values for Select components - must be non-empty strings
export const NONE_UNASSIGNED = '__NONE_UNASSIGNED__'
export const ALL_ANY = '__ALL_ANY__'

/**
 * Converts a potentially falsy value to a safe select value
 * @param value - The value that might be undefined, null, or empty string
 * @returns A non-empty string safe for Select components
 */
export function toSafeSelectValue(value: string | undefined | null): string {
  if (!value || value === '') {
    return NONE_UNASSIGNED
  }
  return value
}

/**
 * Converts a safe select value back to undefined for API calls
 * @param value - The select value that might be a sentinel
 * @returns undefined if it's a sentinel value, otherwise the original value
 */
export function fromSafeSelectValue(value: string): string | undefined {
  if (value === NONE_UNASSIGNED || value === ALL_ANY) {
    return undefined
  }
  return value
}

/**
 * Converts a value to a safe select value for filters (uses ALL_ANY for falsy values)
 * @param value - The filter value that might be undefined, null, or empty string
 * @returns A non-empty string safe for Select components
 */
export function toSafeFilterValue(value: string | undefined | null): string {
  if (!value || value === '') {
    return ALL_ANY
  }
  return value
}

/**
 * Converts a safe filter value back to empty string for filter logic
 * @param value - The select value that might be a sentinel
 * @returns empty string if it's ALL_ANY, otherwise the original value
 */
export function fromSafeFilterValue(value: string): string {
  if (value === ALL_ANY) {
    return ''
  }
  return value
}