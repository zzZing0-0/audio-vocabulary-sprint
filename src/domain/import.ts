import type { RecurrenceEnd, RecurrenceRule, RecurrenceUnit } from '../types'

export function stableImportHash(value:string) {
  let a=2166136261, b=0x9e3779b9
  for(let i=0;i<value.length;i++){
    const code=value.charCodeAt(i)
    a=Math.imul(a^code,16777619)>>>0
    b=Math.imul(b^code,2246822519)>>>0
  }
  return `${a.toString(36)}${b.toString(36)}`
}

export function forestDate(value:string) {
  const normalized=value.trim().replace(/([+-]\d{2})(\d{2})$/, '$1:$2')
  const date=new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

export function parseCsvRows(text:string): string[][] {
  const rows:string[][]=[]; let row:string[]=[], field='', quoted=false
  const pushField=()=>{ row.push(field); field='' }
  const pushRow=()=>{ pushField(); if(row.some(cell=>cell.length>0)) rows.push(row); row=[] }
  for(let i=0;i<text.length;i++){
    const ch=text[i]
    if(quoted){
      if(ch==='"' && text[i+1]==='"'){ field+='"'; i++ }
      else if(ch==='"') quoted=false
      else field+=ch
    } else {
      if(ch==='"') quoted=true
      else if(ch===',') pushField()
      else if(ch==='\n') pushRow()
      else if(ch==='\r') { if(text[i+1]==='\n') i++; pushRow() }
      else field+=ch
    }
  }
  if(field.length || row.length) pushRow()
  return rows
}

export function genericDate(value:string) {
  const raw=value.trim()
  if(!raw) return ''
  const direct=raw.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/)
  if(direct) return `${direct[1]}-${direct[2].padStart(2,'0')}-${direct[3].padStart(2,'0')}`
  const parsed=new Date(raw)
  if(Number.isNaN(parsed.getTime())) return ''
  return `${parsed.getFullYear()}-${String(parsed.getMonth()+1).padStart(2,'0')}-${String(parsed.getDate()).padStart(2,'0')}`
}

export function genericHeaderIndex(header:string[], aliases:string[]) {
  const normalized=header.map(cell=>cell.trim().toLowerCase().replace(/[\s_-]+/g,''))
  for(const alias of aliases){
    const index=normalized.indexOf(alias.toLowerCase().replace(/[\s_-]+/g,''))
    if(index>=0) return index
  }
  return -1
}

export function didaIso(value:string) {
  if(!value) return ''
  return value.replace(/([+-]\d{2})(\d{2})$/, '$1:$2')
}

export function zonedParts(value:string, timeZone:string) {
  if(!value) return null
  const date=new Date(didaIso(value))
  if(Number.isNaN(date.getTime())) return null
  try {
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timeZone||'UTC',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date)
    const get=(type:string)=>parts.find(part=>part.type===type)?.value ?? ''
    return { date:`${get('year')}-${get('month')}-${get('day')}`, time:`${get('hour')}:${get('minute')}` }
  } catch {
    return { date:date.toISOString().slice(0,10), time:date.toISOString().slice(11,16) }
  }
}

export function cleanDidaContent(value:string) {
  const attachmentPattern=/!\[[^\]]*\]\([^)]*\)/g
  const matches=value.match(attachmentPattern)?.length ?? 0
  const text=value.replace(attachmentPattern,'').replace(/\r\n?/g,'\n').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim()
  return { text, removed:matches }
}

export function parseDidaRecurrence(value:string): RecurrenceRule | undefined {
  if(!value) return undefined
  const parts=Object.fromEntries(value.split(';').map(piece=>{ const [key,...rest]=piece.split('='); return [key,rest.join('=')] }))
  const freq=(parts.FREQ||'').toUpperCase()
  const unit:RecurrenceUnit|undefined=freq==='DAILY'?'day':freq==='WEEKLY'?'week':freq==='MONTHLY'?'month':freq==='YEARLY'?'year':undefined
  if(!unit) return undefined
  const count=Number.parseInt(parts.COUNT||'',10)
  if(Number.isFinite(count) && count<=1) return undefined
  const interval=Math.max(1,Number.parseInt(parts.INTERVAL||'1',10)||1)
  const dayMap:Record<string,number>={MO:1,TU:2,WE:3,TH:4,FR:5,SA:6,SU:0}
  const weekdays=parts.BYDAY?.split(',').map(day=>dayMap[day]).filter(day=>day!==undefined)
  let end:RecurrenceEnd|undefined
  if(Number.isFinite(count) && count>1) end={type:'count',count}
  else if(/^\d{8}$/.test(parts.UNTIL||'')) end={type:'date',date:`${parts.UNTIL.slice(0,4)}-${parts.UNTIL.slice(4,6)}-${parts.UNTIL.slice(6,8)}`}
  return {unit,interval,...(weekdays?.length?{weekdays}:{}),...(end?{end}:{})}
}

export function splitImportedTagNames(value:string) {
  return value.split(/[;,\n]+/).map(item=>item.trim()).filter(Boolean)
}
