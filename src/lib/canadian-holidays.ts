// Canadian Legal Holiday Utilities
// This module provides Canadian statutory/legal holiday dates

export interface CanadianHoliday {
  id: string
  name: string
  date: Date
  type: 'federal' | 'provincial' | 'both'
  provinces?: string[] // If provincial, which provinces observe it
  isWorkDay: boolean
  description: string
}

// Helper function to get nth weekday of a month (e.g., 2nd Monday)
function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const firstDay = new Date(year, month, 1)
  const firstWeekday = firstDay.getDay()
  let dayOfMonth = 1 + ((weekday - firstWeekday + 7) % 7) + (n - 1) * 7
  return new Date(year, month, dayOfMonth)
}

// Helper function to get last weekday of a month
function getLastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const lastDay = new Date(year, month + 1, 0)
  const lastWeekday = lastDay.getDay()
  const diff = (lastWeekday - weekday + 7) % 7
  return new Date(year, month, lastDay.getDate() - diff)
}

// Helper function to get Monday if holiday falls on weekend (observed date)
function getObservedDate(date: Date): Date {
  const day = date.getDay()
  if (day === 0) { // Sunday
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
  } else if (day === 6) { // Saturday
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 2)
  }
  return date
}

// Get Good Friday (Friday before Easter Sunday)
function getGoodFriday(year: number): Date {
  const easter = getEasterSunday(year)
  return new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() - 2)
}

// Calculate Easter Sunday using the Anonymous Gregorian algorithm
function getEasterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month, day)
}

// Get Canadian holidays for a given year
function getCanadianHolidayDates(year: number): CanadianHoliday[] {
  const holidays: CanadianHoliday[] = []

  // New Year's Day - January 1 (Federal)
  const newYearsDay = new Date(year, 0, 1)
  holidays.push({
    id: `new-years-day-${year}`,
    name: "New Year's Day",
    date: getObservedDate(newYearsDay),
    type: 'federal',
    isWorkDay: false,
    description: "New Year's Day - First day of the year"
  })

  // Family Day - 3rd Monday of February (Provincial - most provinces)
  const familyDay = getNthWeekdayOfMonth(year, 1, 1, 3) // 3rd Monday of February
  holidays.push({
    id: `family-day-${year}`,
    name: 'Family Day',
    date: familyDay,
    type: 'provincial',
    provinces: ['ON', 'AB', 'BC', 'SK', 'NB', 'NS'],
    isWorkDay: false,
    description: 'Family Day - Celebrating family (varies by province)'
  })

  // Good Friday (Federal)
  const goodFriday = getGoodFriday(year)
  holidays.push({
    id: `good-friday-${year}`,
    name: 'Good Friday',
    date: goodFriday,
    type: 'federal',
    isWorkDay: false,
    description: 'Good Friday - Friday before Easter Sunday'
  })

  // Easter Monday (Federal - optional for some)
  const easterMonday = new Date(getEasterSunday(year))
  easterMonday.setDate(easterMonday.getDate() + 1)
  holidays.push({
    id: `easter-monday-${year}`,
    name: 'Easter Monday',
    date: easterMonday,
    type: 'federal',
    isWorkDay: false,
    description: 'Easter Monday - Day after Easter Sunday'
  })

  // Victoria Day - Last Monday before May 25 (Federal)
  let victoriaDay: Date
  const may25 = new Date(year, 4, 25)
  if (may25.getDay() === 1) {
    victoriaDay = new Date(year, 4, 18) // If May 25 is Monday, go back a week
  } else {
    const daysSinceMonday = (may25.getDay() + 6) % 7
    victoriaDay = new Date(year, 4, 25 - daysSinceMonday)
  }
  holidays.push({
    id: `victoria-day-${year}`,
    name: 'Victoria Day',
    date: victoriaDay,
    type: 'federal',
    isWorkDay: false,
    description: "Victoria Day - Queen Victoria's birthday, marks unofficial start of summer"
  })

  // Canada Day - July 1 (Federal)
  const canadaDay = new Date(year, 6, 1)
  holidays.push({
    id: `canada-day-${year}`,
    name: 'Canada Day',
    date: getObservedDate(canadaDay),
    type: 'federal',
    isWorkDay: false,
    description: "Canada Day - Celebrating Canada's confederation"
  })

  // Civic Holiday - 1st Monday of August (Provincial - most provinces)
  const civicHoliday = getNthWeekdayOfMonth(year, 7, 1, 1) // 1st Monday of August
  holidays.push({
    id: `civic-holiday-${year}`,
    name: 'Civic Holiday',
    date: civicHoliday,
    type: 'provincial',
    provinces: ['ON', 'AB', 'BC', 'SK', 'MB', 'NB', 'NS', 'NT', 'NU'],
    isWorkDay: false,
    description: 'Civic Holiday - Provincial holiday (name varies by province)'
  })

  // Labour Day - 1st Monday of September (Federal)
  const labourDay = getNthWeekdayOfMonth(year, 8, 1, 1) // 1st Monday of September
  holidays.push({
    id: `labour-day-${year}`,
    name: 'Labour Day',
    date: labourDay,
    type: 'federal',
    isWorkDay: false,
    description: 'Labour Day - Celebrating workers and the labour movement'
  })

  // National Day for Truth and Reconciliation - September 30 (Federal)
  const truthReconciliation = new Date(year, 8, 30)
  holidays.push({
    id: `truth-reconciliation-${year}`,
    name: 'National Day for Truth and Reconciliation',
    date: getObservedDate(truthReconciliation),
    type: 'federal',
    isWorkDay: false,
    description: 'Honouring Indigenous peoples and residential school survivors'
  })

  // Thanksgiving - 2nd Monday of October (Federal)
  const thanksgiving = getNthWeekdayOfMonth(year, 9, 1, 2) // 2nd Monday of October
  holidays.push({
    id: `thanksgiving-${year}`,
    name: 'Thanksgiving',
    date: thanksgiving,
    type: 'federal',
    isWorkDay: false,
    description: 'Thanksgiving Day - Celebrating the harvest and blessings'
  })

  // Remembrance Day - November 11 (Federal)
  const remembranceDay = new Date(year, 10, 11)
  holidays.push({
    id: `remembrance-day-${year}`,
    name: 'Remembrance Day',
    date: getObservedDate(remembranceDay),
    type: 'federal',
    isWorkDay: false,
    description: 'Remembrance Day - Honouring military veterans'
  })

  // Christmas Day - December 25 (Federal)
  const christmasDay = new Date(year, 11, 25)
  holidays.push({
    id: `christmas-day-${year}`,
    name: 'Christmas Day',
    date: getObservedDate(christmasDay),
    type: 'federal',
    isWorkDay: false,
    description: 'Christmas Day - Celebrating the birth of Jesus Christ'
  })

  // Boxing Day - December 26 (Federal - varies by province)
  const boxingDay = new Date(year, 11, 26)
  holidays.push({
    id: `boxing-day-${year}`,
    name: 'Boxing Day',
    date: getObservedDate(boxingDay),
    type: 'both',
    provinces: ['ON', 'AB', 'BC', 'MB', 'NB', 'NS', 'PE', 'SK'],
    isWorkDay: false,
    description: 'Boxing Day - Day after Christmas'
  })

  return holidays.sort((a, b) => a.date.getTime() - b.date.getTime())
}

// Main function to get Canadian holidays for a given month/year
export function getCanadianHolidaysForMonth(year: number, month: number): CanadianHoliday[] {
  const allHolidays = getCanadianHolidayDates(year)

  return allHolidays.filter(holiday => {
    return holiday.date.getFullYear() === year && holiday.date.getMonth() === month
  })
}

// Get all Canadian holidays for a given year
export function getCanadianHolidaysForYear(year: number): CanadianHoliday[] {
  return getCanadianHolidayDates(year)
}

// Get Canadian holidays for a date range
export function getCanadianHolidaysForDateRange(startDate: Date, endDate: Date): CanadianHoliday[] {
  const startYear = startDate.getFullYear()
  const endYear = endDate.getFullYear()
  const holidays: CanadianHoliday[] = []

  // Get holidays for all years in the range
  for (let year = startYear; year <= endYear; year++) {
    holidays.push(...getCanadianHolidayDates(year))
  }

  // Filter by date range
  return holidays.filter(holiday => {
    return holiday.date >= startDate && holiday.date <= endDate
  })
}

// Helper function to check if a date is a Canadian holiday
export function isCanadianHoliday(date: Date): CanadianHoliday | null {
  const holidays = getCanadianHolidaysForMonth(date.getFullYear(), date.getMonth())
  const holiday = holidays.find(h =>
    h.date.getDate() === date.getDate() &&
    h.date.getMonth() === date.getMonth() &&
    h.date.getFullYear() === date.getFullYear()
  )
  return holiday || null
}
