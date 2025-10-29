// Hebrew Holiday Utilities
// This module provides Hebrew/Jewish holiday dates and calculations

export interface HebrewHoliday {
  id: string
  name: string
  hebrewName: string
  date: Date
  type: 'major' | 'minor' | 'fast' | 'modern'
  isWorkDay?: boolean
  description: string
  duration: number // days
}

// Helper function to calculate Hebrew calendar dates
// Note: This is a simplified version. For production, consider using a library like 'hebcal'
function getHebrewHolidayDates(year: number): HebrewHoliday[] {
  // For accurate Hebrew calendar calculations, we'll use approximate Gregorian dates
  // In a production environment, you might want to use a proper Hebrew calendar library
  
  const holidays: HebrewHoliday[] = []
  
  // Rosh Hashanah (varies each year, usually September/October)
  const roshHashanahStart = getRoshHashanahDate(year)
  holidays.push({
    id: `rosh-hashanah-${year}-1`,
    name: 'Rosh Hashanah (Day 1)',
    hebrewName: 'ראש השנה',
    date: roshHashanahStart,
    type: 'major',
    isWorkDay: false,
    description: 'Jewish New Year - First day',
    duration: 1
  })
  
  const roshHashanahDay2 = new Date(roshHashanahStart)
  roshHashanahDay2.setDate(roshHashanahDay2.getDate() + 1)
  holidays.push({
    id: `rosh-hashanah-${year}-2`,
    name: 'Rosh Hashanah (Day 2)',
    hebrewName: 'ראש השנה',
    date: roshHashanahDay2,
    type: 'major',
    isWorkDay: false,
    description: 'Jewish New Year - Second day',
    duration: 1
  })
  
  // Yom Kippur (10 days after Rosh Hashanah)
  const yomKippur = new Date(roshHashanahStart)
  yomKippur.setDate(yomKippur.getDate() + 9)
  holidays.push({
    id: `yom-kippur-${year}`,
    name: 'Yom Kippur',
    hebrewName: 'יום כיפור',
    date: yomKippur,
    type: 'major',
    isWorkDay: false,
    description: 'Day of Atonement - Holiest day in Judaism',
    duration: 1
  })
  
  // Sukkot (5 days after Yom Kippur)
  const sukkotStart = new Date(yomKippur)
  sukkotStart.setDate(sukkotStart.getDate() + 4)
  holidays.push({
    id: `sukkot-${year}`,
    name: 'Sukkot (First Day)',
    hebrewName: 'סוכות',
    date: sukkotStart,
    type: 'major',
    isWorkDay: false,
    description: 'Festival of Booths - First day',
    duration: 1
  })
  
  // Simchat Torah (after Sukkot)
  const simchatTorah = new Date(sukkotStart)
  simchatTorah.setDate(simchatTorah.getDate() + 7)
  holidays.push({
    id: `simchat-torah-${year}`,
    name: 'Simchat Torah',
    hebrewName: 'שמחת תורה',
    date: simchatTorah,
    type: 'major',
    isWorkDay: false,
    description: 'Celebrating the Torah',
    duration: 1
  })
  
  // Hanukkah (usually November/December)
  const hanukkahStart = getHanukkahDate(year)
  for (let i = 0; i < 8; i++) {
    const hanukkahDay = new Date(hanukkahStart)
    hanukkahDay.setDate(hanukkahDay.getDate() + i)
    holidays.push({
      id: `hanukkah-${year}-${i + 1}`,
      name: `Hanukkah (Day ${i + 1})`,
      hebrewName: 'חנוכה',
      date: hanukkahDay,
      type: 'minor',
      isWorkDay: true,
      description: `Festival of Lights - Day ${i + 1} of 8`,
      duration: 1
    })
  }
  
  // Tu BiShvat (New Year of the Trees)
  const tuBiShvat = getTuBiShvatDate(year)
  holidays.push({
    id: `tu-bishvat-${year}`,
    name: 'Tu BiShvat',
    hebrewName: 'ט״ו בשבט',
    date: tuBiShvat,
    type: 'minor',
    isWorkDay: true,
    description: 'New Year of the Trees',
    duration: 1
  })
  
  // Purim
  const purim = getPurimDate(year)
  holidays.push({
    id: `purim-${year}`,
    name: 'Purim',
    hebrewName: 'פורים',
    date: purim,
    type: 'minor',
    isWorkDay: true,
    description: 'Festival celebrating the salvation of the Jewish people',
    duration: 1
  })
  
  // Passover (Pesach)
  const passoverStart = getPassoverDate(year)
  holidays.push({
    id: `passover-${year}-1`,
    name: 'Passover (First Day)',
    hebrewName: 'פסח',
    date: passoverStart,
    type: 'major',
    isWorkDay: false,
    description: 'Festival of Freedom - First day',
    duration: 1
  })
  
  const passoverLast = new Date(passoverStart)
  passoverLast.setDate(passoverLast.getDate() + 7)
  holidays.push({
    id: `passover-${year}-8`,
    name: 'Passover (Last Day)',
    hebrewName: 'פסח',
    date: passoverLast,
    type: 'major',
    isWorkDay: false,
    description: 'Festival of Freedom - Last day',
    duration: 1
  })
  
  // Holocaust Remembrance Day
  const holocaustDay = getHolocaustRemembranceDate(year)
  holidays.push({
    id: `holocaust-remembrance-${year}`,
    name: 'Holocaust Remembrance Day',
    hebrewName: 'יום השואה',
    date: holocaustDay,
    type: 'modern',
    isWorkDay: true,
    description: 'Day of remembrance for Holocaust victims',
    duration: 1
  })
  
  // Israeli Independence Day
  const independenceDay = getIndependenceDayDate(year)
  holidays.push({
    id: `independence-day-${year}`,
    name: 'Israeli Independence Day',
    hebrewName: 'יום העצמאות',
    date: independenceDay,
    type: 'modern',
    isWorkDay: false,
    description: 'Celebrating Israeli independence',
    duration: 1
  })
  
  // Lag BaOmer
  const lagBaOmer = getLagBaOmerDate(year)
  holidays.push({
    id: `lag-baomer-${year}`,
    name: 'Lag BaOmer',
    hebrewName: 'ל״ג בעומר',
    date: lagBaOmer,
    type: 'minor',
    isWorkDay: true,
    description: 'Minor holiday during the Omer period',
    duration: 1
  })
  
  // Shavot
  const shavot = getShavotDate(year)
  holidays.push({
    id: `shavot-${year}`,
    name: 'Shavot',
    hebrewName: 'שבועות',
    date: shavot,
    type: 'major',
    isWorkDay: false,
    description: 'Festival of Weeks, celebrating the giving of the Torah',
    duration: 1
  })
  
  // Tisha B'Av
  const tishaBAv = getTishaBAvDate(year)
  holidays.push({
    id: `tisha-bav-${year}`,
    name: 'Tisha B\'Av',
    hebrewName: 'תשעה באב',
    date: tishaBAv,
    type: 'fast',
    isWorkDay: true,
    description: 'Day of mourning and fasting',
    duration: 1
  })
  
  return holidays.sort((a, b) => a.date.getTime() - b.date.getTime())
}

// Approximate date calculations for Hebrew holidays
// These are simplified calculations. For precise dates, use a proper Hebrew calendar library

function getRoshHashanahDate(gregorianYear: number): Date {
  // Approximate dates - Rosh Hashanah typically falls between Sep 5 and Oct 5
  const approximateDates: { [year: number]: Date } = {
    2024: new Date(2024, 9, 3), // Oct 3, 2024
    2025: new Date(2025, 8, 23), // Sep 23, 2025
    2026: new Date(2026, 8, 12), // Sep 12, 2026
    2027: new Date(2027, 9, 2), // Oct 2, 2027
    2028: new Date(2028, 8, 21), // Sep 21, 2028
    2029: new Date(2029, 8, 10), // Sep 10, 2029
    2030: new Date(2030, 8, 28), // Sep 28, 2030
  }
  return approximateDates[gregorianYear] || new Date(gregorianYear, 8, 15) // Default to Sep 15
}

function getHanukkahDate(gregorianYear: number): Date {
  // Hanukkah typically falls in November/December
  const approximateDates: { [year: number]: Date } = {
    2024: new Date(2024, 11, 26), // Dec 26, 2024
    2025: new Date(2025, 11, 15), // Dec 15, 2025
    2026: new Date(2026, 11, 5), // Dec 5, 2026
    2027: new Date(2027, 11, 25), // Dec 25, 2027
    2028: new Date(2028, 11, 13), // Dec 13, 2028
    2029: new Date(2029, 11, 2), // Dec 2, 2029
    2030: new Date(2030, 11, 21), // Dec 21, 2030
  }
  return approximateDates[gregorianYear] || new Date(gregorianYear, 11, 10) // Default to Dec 10
}

function getTuBiShvatDate(gregorianYear: number): Date {
  // Tu BiShvat typically falls in January/February
  const approximateDates: { [year: number]: Date } = {
    2024: new Date(2024, 0, 25), // Jan 25, 2024
    2025: new Date(2025, 1, 13), // Feb 13, 2025
    2026: new Date(2026, 1, 3), // Feb 3, 2026
    2027: new Date(2027, 0, 23), // Jan 23, 2027
    2028: new Date(2028, 1, 12), // Feb 12, 2028
    2029: new Date(2029, 0, 31), // Jan 31, 2029
    2030: new Date(2030, 0, 20), // Jan 20, 2030
  }
  return approximateDates[gregorianYear] || new Date(gregorianYear, 1, 1) // Default to Feb 1
}

function getPurimDate(gregorianYear: number): Date {
  // Purim typically falls in February/March
  const approximateDates: { [year: number]: Date } = {
    2024: new Date(2024, 2, 24), // Mar 24, 2024
    2025: new Date(2025, 2, 14), // Mar 14, 2025
    2026: new Date(2026, 2, 3), // Mar 3, 2026
    2027: new Date(2027, 2, 23), // Mar 23, 2027
    2028: new Date(2028, 2, 12), // Mar 12, 2028
    2029: new Date(2029, 2, 1), // Mar 1, 2029
    2030: new Date(2030, 2, 20), // Mar 20, 2030
  }
  return approximateDates[gregorianYear] || new Date(gregorianYear, 2, 15) // Default to Mar 15
}

function getPassoverDate(gregorianYear: number): Date {
  // Passover typically falls in March/April
  const approximateDates: { [year: number]: Date } = {
    2024: new Date(2024, 3, 23), // Apr 23, 2024
    2025: new Date(2025, 3, 13), // Apr 13, 2025
    2026: new Date(2026, 3, 2), // Apr 2, 2026
    2027: new Date(2027, 3, 22), // Apr 22, 2027
    2028: new Date(2028, 3, 11), // Apr 11, 2028
    2029: new Date(2029, 2, 31), // Mar 31, 2029
    2030: new Date(2030, 3, 18), // Apr 18, 2030
  }
  return approximateDates[gregorianYear] || new Date(gregorianYear, 3, 15) // Default to Apr 15
}

function getHolocaustRemembranceDate(gregorianYear: number): Date {
  // Yom HaShoah - typically in April/May
  const approximateDates: { [year: number]: Date } = {
    2024: new Date(2024, 4, 6), // May 6, 2024
    2025: new Date(2025, 3, 24), // Apr 24, 2025
    2026: new Date(2026, 3, 14), // Apr 14, 2026
    2027: new Date(2027, 4, 3), // May 3, 2027
    2028: new Date(2028, 3, 24), // Apr 24, 2028
    2029: new Date(2029, 3, 12), // Apr 12, 2029
    2030: new Date(2030, 4, 1), // May 1, 2030
  }
  return approximateDates[gregorianYear] || new Date(gregorianYear, 3, 27) // Default to Apr 27
}

function getIndependenceDayDate(gregorianYear: number): Date {
  // Yom Ha'atzmaut - typically in April/May
  const approximateDates: { [year: number]: Date } = {
    2024: new Date(2024, 4, 14), // May 14, 2024
    2025: new Date(2025, 4, 2), // May 2, 2025
    2026: new Date(2026, 3, 22), // Apr 22, 2026
    2027: new Date(2027, 4, 11), // May 11, 2027
    2028: new Date(2028, 4, 1), // May 1, 2028
    2029: new Date(2029, 3, 20), // Apr 20, 2029
    2030: new Date(2030, 4, 9), // May 9, 2030
  }
  return approximateDates[gregorianYear] || new Date(gregorianYear, 4, 5) // Default to May 5
}

function getLagBaOmerDate(gregorianYear: number): Date {
  // Lag BaOmer - 33 days after Passover
  const passover = getPassoverDate(gregorianYear)
  const lagBaOmer = new Date(passover)
  lagBaOmer.setDate(lagBaOmer.getDate() + 33)
  return lagBaOmer
}

function getShavotDate(gregorianYear: number): Date {
  // Shavot - 50 days after Passover
  const passover = getPassoverDate(gregorianYear)
  const shavot = new Date(passover)
  shavot.setDate(shavot.getDate() + 50)
  return shavot
}

function getTishaBAvDate(gregorianYear: number): Date {
  // Tisha B'Av typically falls in July/August
  const approximateDates: { [year: number]: Date } = {
    2024: new Date(2024, 7, 13), // Aug 13, 2024
    2025: new Date(2025, 7, 3), // Aug 3, 2025
    2026: new Date(2026, 6, 23), // Jul 23, 2026
    2027: new Date(2027, 7, 12), // Aug 12, 2027
    2028: new Date(2028, 7, 1), // Aug 1, 2028
    2029: new Date(2029, 6, 21), // Jul 21, 2029
    2030: new Date(2030, 7, 9), // Aug 9, 2030
  }
  return approximateDates[gregorianYear] || new Date(gregorianYear, 7, 1) // Default to Aug 1
}

// Main function to get Hebrew holidays for a given month/year
export function getHebrewHolidaysForMonth(year: number, month: number): HebrewHoliday[] {
  const allHolidays = getHebrewHolidayDates(year)
  
  return allHolidays.filter(holiday => {
    return holiday.date.getFullYear() === year && holiday.date.getMonth() === month
  })
}

// Get all Hebrew holidays for a given year
export function getHebrewHolidaysForYear(year: number): HebrewHoliday[] {
  return getHebrewHolidayDates(year)
}

// Get Hebrew holidays for a date range
export function getHebrewHolidaysForDateRange(startDate: Date, endDate: Date): HebrewHoliday[] {
  const startYear = startDate.getFullYear()
  const endYear = endDate.getFullYear()
  const holidays: HebrewHoliday[] = []
  
  // Get holidays for all years in the range
  for (let year = startYear; year <= endYear; year++) {
    holidays.push(...getHebrewHolidayDates(year))
  }
  
  // Filter by date range
  return holidays.filter(holiday => {
    return holiday.date >= startDate && holiday.date <= endDate
  })
}

// Helper function to check if a date is a Hebrew holiday
export function isHebrewHoliday(date: Date): HebrewHoliday | null {
  const holidays = getHebrewHolidaysForMonth(date.getFullYear(), date.getMonth())
  const holiday = holidays.find(h => 
    h.date.getDate() === date.getDate() &&
    h.date.getMonth() === date.getMonth() &&
    h.date.getFullYear() === date.getFullYear()
  )
  return holiday || null
}
