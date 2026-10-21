import type { Anniversary, AnniversaryDraft, AnniversaryType } from '../types'

export const ANNIVERSARY_TYPES: { value: AnniversaryType; label: string; icon: string }[] = [
  { value: 'birthday', label: '生日', icon: '🎂' },
  { value: 'anniversary', label: '纪念日', icon: '❤️' },
  { value: 'important', label: '重要日期', icon: '⭐' },
  { value: 'other', label: '其他', icon: '📌' },
]

export function anniversaryIcon(type: AnniversaryType) {
  return ANNIVERSARY_TYPES.find(item => item.value === type)?.icon ?? '📌'
}

export function emptyAnniversaryDraft(date: Date): AnniversaryDraft {
  return { title:'', type:'birthday', calendar:'solar', year:String(date.getFullYear()), month:date.getMonth()+1, day:date.getDate(), isLeapMonth:false, repeatYearly:true, notes:'' }
}

export function daysInMonth(year:number, month:number) {
  return new Date(year, month, 0).getDate()
}

const chineseCalendarFormatter = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
  month: 'long',
  day: 'numeric',
})

export function lunarParts(date: Date) {
  const parts = chineseCalendarFormatter.formatToParts(date)
  const month = parts.find(part => part.type === 'month')?.value ?? ''
  const day = parts.find(part => part.type === 'day')?.value ?? ''
  return { month, day }
}

export function chineseLunarDayName(day: number) {
  if (!Number.isFinite(day) || day < 1 || day > 30) return ''
  const names = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十',
    '十一','十二','十三','十四','十五','十六','十七','十八','十九','二十',
    '廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十']
  return names[day - 1]
}

export function lunarCalendarLabel(date: Date) {
  const { month, day } = lunarParts(date)
  return day === '1' || day === '初一' ? month : chineseLunarDayName(Number.parseInt(day, 10))
}

export function lunarMonthNumber(monthText: string) {
  const clean = monthText.replace('闰', '').replace('月', '')
  const names: Record<string, number> = {
    '正':1,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'十一':11,'冬':11,'十二':12,'腊':12,
  }
  return names[clean] ?? Number.parseInt(clean, 10)
}

export function isoWeekNumber(date: Date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = target.getUTCDay() || 7
  target.setUTCDate(target.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
  return Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

export function nthWeekdayOfMonth(date: Date, weekday: number, nth: number) {
  if (date.getDay() !== weekday) return false
  return Math.floor((date.getDate() - 1) / 7) + 1 === nth
}

const SOLAR_TERM_NAMES = ['小寒','大寒','立春','雨水','惊蛰','春分','清明','谷雨','立夏','小满','芒种','夏至','小暑','大暑','立秋','处暑','白露','秋分','寒露','霜降','立冬','小雪','大雪','冬至']
const SOLAR_TERM_MINUTES = [0,21208,42467,63836,85337,107014,128867,150921,173149,195551,218072,240693,263343,285989,308563,331033,353350,375494,397447,419210,440795,462224,483532,504758]

export function solarTermForDate(date: Date) {
  const year = date.getFullYear()
  for (let index=0; index<24; index+=1) {
    const utcMs = Date.UTC(1900,0,6,2,5) + 31556925974.7 * (year - 1900) + SOLAR_TERM_MINUTES[index] * 60000
    const china = new Date(utcMs + 8 * 3600000)
    if (china.getUTCMonth() === date.getMonth() && china.getUTCDate() === date.getDate()) return SOLAR_TERM_NAMES[index]
  }
  return undefined
}

export type CalendarAnnotationKind = 'statutory' | 'traditional' | 'international' | 'solar-term' | 'week'
export type CalendarAnnotation = { label: string; kind: CalendarAnnotationKind }

export type LunarDateParts = { year: number; monthText: string; day: number; isLeapMonth: boolean }
export function solarToLunar(date: Date): LunarDateParts {
  const full = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
    year: 'numeric', month: 'long', day: 'numeric'
  }).formatToParts(date)
  const yearText = full.find(part => String(part.type) === 'relatedYear')?.value
    ?? full.find(part => part.type === 'year')?.value ?? String(date.getFullYear())
  const monthText = full.find(part => part.type === 'month')?.value ?? ''
  const dayText = full.find(part => part.type === 'day')?.value ?? ''
  return {
    year: Number.parseInt(yearText, 10),
    monthText,
    day: Number.parseInt(dayText, 10),
    isLeapMonth: monthText.includes('闰'),
  }
}

export function calendarFestival(date: Date): CalendarAnnotation | undefined {
  const month = date.getMonth() + 1, day = date.getDate()
  const lunar = solarToLunar(date)
  const lunarMonth = lunarMonthNumber(lunar.monthText)
  const lunarDay = lunar.day
  const lunarKey = `${lunarMonth}-${lunarDay}`
  const solarKey = `${month}-${day}`

  const statutorySolar: Record<string,string> = {'1-1':'元旦','5-1':'劳动节','10-1':'国庆节'}
  const statutoryLunar: Record<string,string> = {'1-1':'春节','5-5':'端午节','8-15':'中秋节'}
  if (statutorySolar[solarKey]) return {label:statutorySolar[solarKey],kind:'statutory'}
  if (statutoryLunar[lunarKey] && !lunar.isLeapMonth) return {label:statutoryLunar[lunarKey],kind:'statutory'}
  if (solarTermForDate(date) === '清明') return {label:'清明节',kind:'statutory'}

  const traditionalLunar: Record<string,string> = {
    '1-15':'元宵节','2-2':'龙抬头','3-3':'上巳节','7-7':'七夕','7-15':'中元节','9-9':'重阳节','10-15':'下元节','12-8':'腊八节',
  }
  if (traditionalLunar[lunarKey] && !lunar.isLeapMonth) return {label:traditionalLunar[lunarKey],kind:'traditional'}
  const tomorrow = new Date(date.getFullYear(), date.getMonth(), date.getDate()+1)
  const tomorrowLunar = solarToLunar(tomorrow)
  if (lunarMonth === 12 && tomorrowLunar.day === 1 && lunarMonthNumber(tomorrowLunar.monthText) === 1) return {label:'除夕',kind:'traditional'}

  const internationalFixed: Record<string,string> = {
    '2-14':'情人节','3-8':'妇女节','3-12':'植树节','4-1':'愚人节','5-4':'青年节','6-1':'儿童节','9-10':'教师节',
    '10-31':'万圣夜','12-24':'平安夜','12-25':'圣诞节','12-31':'跨年夜',
  }
  if (internationalFixed[solarKey]) return {label:internationalFixed[solarKey],kind:'international'}
  if (month===5 && nthWeekdayOfMonth(date,0,2)) return {label:'母亲节',kind:'international'}
  if (month===6 && nthWeekdayOfMonth(date,0,3)) return {label:'父亲节',kind:'international'}
  if (month===11 && nthWeekdayOfMonth(date,4,4)) return {label:'感恩节',kind:'international'}

  return undefined
}

export function calendarAnnotation(date: Date, weekStartsMonday: boolean): CalendarAnnotation | undefined {
  const festival = calendarFestival(date)
  if (festival) return festival
  const term = solarTermForDate(date)
  if (term) return {label:term,kind:'solar-term'}
  const firstWeekday = weekStartsMonday ? 1 : 0
  if (date.getDay() === firstWeekday) return {label:`${isoWeekNumber(date)}周`,kind:'week'}
  return undefined
}

export function lunarFullLabel(date: Date) {
  const { month, day } = lunarParts(date)
  const numericDay = Number.parseInt(day, 10)
  return `${month}${chineseLunarDayName(numericDay) || day}`
}

export function lunarOccurrence(ann: Anniversary, solarYear: number): Date | null {
  const start=new Date(solarYear,0,1), end=new Date(solarYear,11,31)
  let normalFallback: Date | null = null
  for (let d=new Date(start); d<=end; d.setDate(d.getDate()+1)) {
    const lunar=solarToLunar(d)
    const monthNumber=Number.parseInt(lunar.monthText.replace(/[^0-9]/g,''),10)
    const rawMonth=lunar.monthText
    const cnMonths=['正月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月']
    const clean=rawMonth.replace('闰','')
    const m=Number.isFinite(monthNumber) ? monthNumber : cnMonths.indexOf(clean)+1
    if (m!==ann.month || lunar.day!==ann.day) continue
    if (ann.isLeapMonth && lunar.isLeapMonth) return new Date(d)
    if (!ann.isLeapMonth && !lunar.isLeapMonth) return new Date(d)
    if (ann.isLeapMonth && !lunar.isLeapMonth) normalFallback=new Date(d)
  }
  return ann.isLeapMonth ? normalFallback : null
}

export function anniversaryDayLimit(calendar: 'solar' | 'lunar', month: number, year?: number) {
  if (calendar === 'lunar') return 30
  if (month === 2 && year === undefined) return 29
  const safeYear = year ?? 2024
  return new Date(safeYear, month, 0).getDate()
}

export function anniversaryOccurrence(ann: Anniversary, solarYear:number): Date | null {
  if (ann.repeatYearly && ann.year && solarYear < ann.year) return null
  if (ann.calendar==='solar') {
    const year=ann.repeatYearly ? solarYear : (ann.year ?? solarYear)
    if (!ann.repeatYearly && ann.year!==solarYear) return null
    const max=daysInMonth(year,ann.month)
    if (ann.day>max) return null
    return new Date(year,ann.month-1,ann.day)
  }
  if (!ann.repeatYearly && ann.year && ann.year!==solarYear) return null
  return lunarOccurrence(ann,solarYear)
}

export function anniversaryMeta(ann: Anniversary, occurrence: Date) {
  if (!ann.year) return ann.calendar==='lunar' ? '农历' : ''
  const n=occurrence.getFullYear()-ann.year
  if (ann.type==='birthday') return n>=0 ? `${n}岁` : ''
  return n>0 ? `${n}周年` : ''
}


export type AnniversaryPageRow = { anniversary: Anniversary; occurrence: Date | null }

export function buildAnniversaryPageRows(activeAnniversaries: Anniversary[], today: Date): AnniversaryPageRow[] {
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return activeAnniversaries.map(anniversary => {
    let occurrence: Date | null = null
    if (anniversary.repeatYearly) {
      const candidateYear = Math.max(today.getFullYear(), anniversary.year ?? today.getFullYear())
      occurrence = anniversaryOccurrence(anniversary, candidateYear)
      if (!occurrence || occurrence < todayStart) occurrence = anniversaryOccurrence(anniversary, candidateYear + 1)
    } else if (anniversary.year) {
      occurrence = anniversaryOccurrence(anniversary, anniversary.year)
    }
    return { anniversary, occurrence }
  }).sort((a,b) => {
    if (!a.occurrence) return 1
    if (!b.occurrence) return -1

    const aPastOneOff = !a.anniversary.repeatYearly && a.occurrence < todayStart
    const bPastOneOff = !b.anniversary.repeatYearly && b.occurrence < todayStart
    if (aPastOneOff !== bPastOneOff) return aPastOneOff ? 1 : -1
    if (aPastOneOff && bPastOneOff) return b.occurrence.getTime() - a.occurrence.getTime()
    return a.occurrence.getTime() - b.occurrence.getTime()
  })
}

export function anniversaryDistanceLabel(anniversary: Anniversary, occurrence: Date | null, today: Date): string {
  if (!occurrence) return ''
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const occurrenceStart = new Date(occurrence.getFullYear(), occurrence.getMonth(), occurrence.getDate())
  const days = Math.round((occurrenceStart.getTime() - todayStart.getTime()) / 86400000)
  if (days === 0) return '今天'
  if (anniversary.repeatYearly) return `还有 ${days} 天`
  return days > 0 ? `还有 ${days} 天` : `过去 ${Math.abs(days)} 天`
}
