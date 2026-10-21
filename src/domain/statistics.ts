import type { DailyEnergy, DailyMood, FocusSession, JournalEntry, JournalImpact, MoodLevel, EnergyLevel, RecurrenceException, Tag, Task, TaskPriority } from '../types'
import { addDaysKey, combinedFocusSecondsByDate, dayDiff, expandTasks, taskEndDate, toDateKey } from './task'
import { DEFAULT_TAG, DEFAULT_TAG_ID, isImportSourceTagId } from './preferences'
import { tagColorRank } from './tags'

export type StatisticsRange = 'week' | 'month' | '30d' | 'year' | 'all'

export interface StatisticsInput {
  today: Date
  statsRange: StatisticsRange
  weekStartsMonday: boolean
  activeTasks: Task[]
  activeJournalEntries: JournalEntry[]
  dailyMoods: DailyMood[]
  dailyEnergy: DailyEnergy[]
  managedTags: Tag[]
  tags: Tag[]
  focusSessions: FocusSession[]
  wordCloudIgnored: string[]
  timerNow: number
  excludeDefaultFocusStats: boolean
}

export function buildStatistics({
  today, statsRange, weekStartsMonday, activeTasks, activeJournalEntries, dailyMoods, dailyEnergy,
  managedTags, tags, focusSessions, wordCloudIgnored, timerNow, excludeDefaultFocusStats,
}: StatisticsInput) {
  const todayKey = toDateKey(today)
  const startOfMonth = toDateKey(new Date(today.getFullYear(), today.getMonth(), 1))
  const weekOffset = weekStartsMonday ? (today.getDay()+6)%7 : today.getDay()
  const startOfWeek = toDateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate()-weekOffset))
  const start30 = toDateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29))
  const startYear = `${today.getFullYear()}-01-01`
  const rangeStart = statsRange==='week' ? startOfWeek : statsRange==='month' ? startOfMonth : statsRange==='30d' ? start30 : statsRange==='year' ? startYear : '0000-01-01'
  const inRange = (key?:string) => Boolean(key && key >= rangeStart && key <= todayKey)
  const taskOrigin = (task:Task) => task.occurrenceDate ?? task.originalDate ?? task.date ?? ''
  const taskOriginalEnd = (task:Task) => {
    const origin = taskOrigin(task)
    if (!origin || !task.date) return origin ?? todayKey
    const duration = Math.max(0, dayDiff(task.date, taskEndDate(task)))
    return addDaysKey(origin, duration)
  }

  // Expand recurring tasks only across the selected historical window, then use original planned date as cohort.
  const scheduledTasks = activeTasks.filter((task): task is Task & { date:string } => Boolean(task.date))
  const earliestTaskDate = scheduledTasks.length ? scheduledTasks.reduce((min,task)=>task.date<min?task.date:min,scheduledTasks[0]?.date ?? todayKey) : todayKey
  const statsTasks = expandTasks(scheduledTasks, rangeStart==='0000-01-01' ? earliestTaskDate : rangeStart, todayKey)
    .filter(task => inRange(taskOrigin(task)))
  const eligibleTasks = statsTasks.filter(task => task.status!=='todo' || taskEndDate(task) <= todayKey)
  const completed = eligibleTasks.filter(task=>task.status==='completed').length
  const abandoned = eligibleTasks.filter(task=>task.status==='abandoned').length
  const overdue = eligibleTasks.filter(task=>task.status==='todo').length
  const completionRate = eligibleTasks.length ? completed/eligibleTasks.length : 0

  const postponedTasks = eligibleTasks.filter(task=>(task.postponeHistory?.length ?? 0)>0)
  const postponeEvents = eligibleTasks.flatMap(task=>task.postponeHistory ?? [])
  const postponeRate = eligibleTasks.length ? postponedTasks.length/eligibleTasks.length : 0
  const maxPostponeCount = eligibleTasks.reduce((max,task)=>Math.max(max,task.postponeHistory?.length ?? 0),0)
  const postponeDays = (task:Task) => Math.max(0, dayDiff(taskOriginalEnd(task), taskEndDate(task)))
  const maxPostponeDays = eligibleTasks.reduce((max,task)=>Math.max(max,postponeDays(task)),0)

  const completedByDay = new Map<string,number>()
  // Completion trend is an event timeline: range membership and grouping both use the actual completedAt date.
  // Do not pre-filter by the task's planned/original date, otherwise the same calendar day can show different
  // completion counts when switching between week/month/30-day ranges.
  activeTasks.forEach(task => {
    if (!task.recurrence) {
      if (!task.completedAt) return
      const key = toDateKey(new Date(task.completedAt))
      if (inRange(key)) completedByDay.set(key, (completedByDay.get(key) ?? 0) + 1)
      return
    }
    (Object.entries(task.recurrenceExceptions ?? {}) as [string,RecurrenceException][]).forEach(([occurrenceDate,exception]) => {
      if ((task.trashFuture && occurrenceDate >= task.trashFuture.from) || exception.deleted || exception.trashedAt || exception.status !== 'completed' || !exception.completedAt) return
      const key = toDateKey(new Date(exception.completedAt))
      if (inRange(key)) completedByDay.set(key, (completedByDay.get(key) ?? 0) + 1)
    })
  })
  const rawCompletedTrend = [...completedByDay.entries()].sort((a,b)=>a[0].localeCompare(b[0]))
  const completionTrend = (() => {
    if (statsRange==='all') {
      if (!rawCompletedTrend.length) return []
      const first=rawCompletedTrend[0][0], last=todayKey
      const totalDays=Math.max(1,dayDiff(first,last)+1)
      const bucketCount=Math.max(10,Math.min(20,Math.ceil(totalDays/75)))
      const bucketDays=Math.max(1,Math.ceil(totalDays/bucketCount))
      const buckets=Array.from({length:bucketCount},(_,index)=>{
        const start=addDaysKey(first,index*bucketDays)
        const end=index===bucketCount-1 ? last : addDaysKey(first,Math.min(totalDays-1,(index+1)*bucketDays-1))
        return {key:`${start}:${end}`,start,end,count:0,label:`${Number(start.slice(5,7))}/${Number(start.slice(8,10))}`}
      }).filter(bucket=>bucket.start<=last)
      rawCompletedTrend.forEach(([date,count])=>{
        const index=Math.min(buckets.length-1,Math.max(0,Math.floor(dayDiff(first,date)/bucketDays)))
        if(buckets[index]) buckets[index].count+=count
      })
      return buckets
    }
    const grouped=new Map<string,number>()
    rawCompletedTrend.forEach(([date,count])=>{
      const key = statsRange==='year' ? date.slice(0,7) : date
      grouped.set(key,(grouped.get(key)??0)+count)
    })
    return [...grouped.entries()].map(([key,count])=>({
      key,count,
      label: statsRange==='year' ? `${Number(key.slice(5,7))}月` : `${Number(key.slice(5,7))}/${Number(key.slice(8,10))}`
    }))
  })()
  const focusTagForStats = (ids?:string[]) => {
    const ordinaryId=(ids??[]).find(id=>id!==DEFAULT_TAG_ID&&!isImportSourceTagId(id))
    return tags.find(tag=>tag.id===(ordinaryId??DEFAULT_TAG_ID)) ?? DEFAULT_TAG
  }
  const includeFocusTagIds = (ids?:string[]) => !excludeDefaultFocusStats || focusTagForStats(ids).id !== DEFAULT_TAG_ID
  const focusByDay = combinedFocusSecondsByDate(activeTasks, focusSessions, timerNow, includeFocusTagIds)
  const focusTagMap = new Map<string,{tag:Tag,seconds:number,sessions:number}>()
  const focusTagForIds = (ids?:string[]) => {
    const ordinaryId=(ids??[]).find(id=>id!==DEFAULT_TAG_ID&&!isImportSourceTagId(id))
    return tags.find(tag=>tag.id===(ordinaryId??DEFAULT_TAG_ID)) ?? DEFAULT_TAG
  }
  const addFocusTagValue = (tag:Tag, seconds:number, sessions:number) => {
    if(excludeDefaultFocusStats && tag.id===DEFAULT_TAG_ID) return
    if(seconds<=0&&sessions<=0) return
    const row=focusTagMap.get(tag.id)??{tag,seconds:0,sessions:0}
    row.seconds+=seconds; row.sessions+=sessions; focusTagMap.set(tag.id,row)
  }
  activeTasks.forEach(task=>{
    const tag=focusTagForIds(task.tagIds)
    if(!task.recurrence){
      const focusDate=task.date ?? toDateKey(new Date(task.completedAt ?? task.timerSessions?.at(-1)?.endedAt ?? task.updatedAt))
      if(inRange(focusDate)){const value=Math.max(0,Number(task.actualDurationMinutes??0)*60);addFocusTagValue(tag,value,value>0?(task.timerSessions?.length||1):0)}
      return
    }
    Object.entries(task.recurrenceExceptions??{}).forEach(([date,exception]:[string,RecurrenceException])=>{
      if(!inRange(date)||exception.deleted||exception.trashedAt)return
      const value=Math.max(0,Number(exception.actualDurationMinutes??0)*60)
      addFocusTagValue(focusTagForIds(exception.tagIds??task.tagIds),value,value>0?(exception.timerSessions?.length||1):0)
    })
  })
  focusSessions.forEach(session=>{
    if(session.trashedAt)return
    const date=toDateKey(new Date(session.startedAt)); if(!inRange(date))return
    const start=new Date(session.startedAt).getTime(),end=session.endedAt?new Date(session.endedAt).getTime():timerNow
    const cap=session.mode==='countdown'&&session.plannedSeconds?start+session.plannedSeconds*1000:end
    const value=Math.max(0,Math.round((Math.min(end,cap)-start)/1000))
    addFocusTagValue(focusTagForIds(session.tagIds),value,1)
  })
  const focusColorRank=(color:string)=>tagColorRank(color)
  const focusTagRows=[...focusTagMap.values()].sort((a,b)=>focusColorRank(a.tag.color)-focusColorRank(b.tag.color)||b.seconds-a.seconds||a.tag.name.localeCompare(b.tag.name))
  const focusColorMap=new Map<string,{color:string;seconds:number;sessions:number;tags:typeof focusTagRows}>()
  focusTagRows.forEach(row=>{const key=row.tag.color.toLowerCase();const bucket=focusColorMap.get(key)??{color:row.tag.color,seconds:0,sessions:0,tags:[]};bucket.seconds+=row.seconds;bucket.sessions+=row.sessions;bucket.tags.push(row);focusColorMap.set(key,bucket)})
  const focusColorTotal=focusTagRows.reduce((sum,row)=>sum+row.seconds,0)
  const focusColorRows=[...focusColorMap.values()].sort((a,b)=>b.seconds-a.seconds||focusColorRank(a.color)-focusColorRank(b.color)).map(row=>({...row,percent:focusColorTotal?row.seconds/focusColorTotal*100:0}))
  const focusPieGradient=(()=>{if(!focusColorTotal)return '';let cursor=0;return `conic-gradient(${focusColorRows.map(row=>{const from=cursor;cursor+=row.percent;return `${row.color} ${from.toFixed(3)}% ${cursor.toFixed(3)}%`}).join(',')})`})()
  let focusPieCursor=0
  const focusPieLabels=focusColorRows.map(row=>{const mid=focusPieCursor+row.percent/2;focusPieCursor+=row.percent;const angle=(mid/100*360-90)*Math.PI/180;return {...row,x:50+Math.cos(angle)*35,y:50+Math.sin(angle)*35}}).filter(row=>row.percent>=5)
  const rawFocusTrend = [...focusByDay.entries()].filter(([date])=>inRange(date)).sort((a,b)=>a[0].localeCompare(b[0]))
  const focusSeconds = rawFocusTrend.reduce((sum,[,seconds])=>sum+seconds,0)
  const focusTrend = (() => {
    if (statsRange==='all') {
      if (!rawFocusTrend.length) return []
      const first=rawFocusTrend[0][0], last=todayKey
      const totalDays=Math.max(1,dayDiff(first,last)+1)
      const bucketCount=Math.max(10,Math.min(20,Math.ceil(totalDays/75)))
      const bucketDays=Math.max(1,Math.ceil(totalDays/bucketCount))
      const buckets=Array.from({length:bucketCount},(_,index)=>{
        const start=addDaysKey(first,index*bucketDays)
        const end=index===bucketCount-1 ? last : addDaysKey(first,Math.min(totalDays-1,(index+1)*bucketDays-1))
        return {key:`${start}:${end}`,start,end,seconds:0,label:`${Number(start.slice(5,7))}/${Number(start.slice(8,10))}`}
      }).filter(bucket=>bucket.start<=last)
      rawFocusTrend.forEach(([date,seconds])=>{
        const index=Math.min(buckets.length-1,Math.max(0,Math.floor(dayDiff(first,date)/bucketDays)))
        if(buckets[index]) buckets[index].seconds+=seconds
      })
      return buckets
    }
    const grouped=new Map<string,number>()
    rawFocusTrend.forEach(([date,seconds])=>{
      const key = statsRange==='year' ? date.slice(0,7) : date
      grouped.set(key,(grouped.get(key)??0)+seconds)
    })
    return [...grouped.entries()].map(([key,seconds])=>({
      key,seconds,
      label: statsRange==='year' ? `${Number(key.slice(5,7))}月` : `${Number(key.slice(5,7))}/${Number(key.slice(8,10))}`
    }))
  })()

  const mostPostponedTask = [...eligibleTasks].sort((a,b)=>(b.postponeHistory?.length??0)-(a.postponeHistory?.length??0))[0]
  const longestPostponedTask = [...eligibleTasks].sort((a,b)=>postponeDays(b)-postponeDays(a))[0]

  const journals = activeJournalEntries.filter(entry=>inRange(entry.date))
  const moods = dailyMoods.filter(mood=>inRange(mood.date))
  const energies = dailyEnergy.filter(energy=>inRange(energy.date))
  const journalDays = new Set(journals.map(entry=>entry.date)).size
  const moodDays = new Set(moods.map(mood=>mood.date)).size
  const energyDays = new Set(energies.map(energy=>energy.date)).size
  const statusDays = new Set([...moods.map(mood=>mood.date), ...energies.map(energy=>energy.date)]).size
  const impactCounts = [-2,-1,0,1,2].map(value=>({value:value as JournalImpact,count:journals.filter(j=>j.impact===value).length}))
  const moodCounts = [1,2,3,4,5].map(value=>({value:value as MoodLevel,count:moods.filter(m=>m.level===value).length}))
  const energyCounts = [1,2,3,4,5].map(value=>({value:value as EnergyLevel,count:energies.filter(e=>e.level===value).length}))
  const priorityCounts = [3,2,1,0].map(value=>({value:value as TaskPriority,count:eligibleTasks.filter(t=>t.priority===value).length}))
  const defaultTagJournals = journals.filter(entry=>(entry.tagIds??[DEFAULT_TAG_ID]).includes(DEFAULT_TAG_ID))
  const defaultTagImpactRow = {
    tag: DEFAULT_TAG,
    journals: defaultTagJournals.length,
    impacts: [-2,-1,0,1,2].map(value=>({value:value as JournalImpact,count:defaultTagJournals.filter(j=>j.impact===value).length}))
  }

  const tagRows = managedTags.map(tag=>{
    const tagTasks=eligibleTasks.filter(task=>(task.tagIds??[DEFAULT_TAG_ID]).includes(tag.id))
    const tagJournals=journals.filter(entry=>(entry.tagIds??[DEFAULT_TAG_ID]).includes(tag.id))
    const tagPostponed=tagTasks.filter(task=>(task.postponeHistory?.length??0)>0)
    const impacts=[-2,-1,0,1,2].map(value=>({value:value as JournalImpact,count:tagJournals.filter(j=>j.impact===value).length}))
    const days=new Set<string>()
    tagTasks.forEach(task=>days.add(taskOrigin(task)))
    tagJournals.forEach(entry=>days.add(entry.date))
    const tagCompleted=tagTasks.filter(t=>t.status==='completed').length
    const tagMoodDates=new Set(tagJournals.map(entry=>entry.date))
    const tagMoods=moods.filter(mood=>tagMoodDates.has(mood.date))
    const moodDistribution=[1,2,3,4,5].map(value=>({value:value as MoodLevel,count:tagMoods.filter(m=>m.level===value).length}))
    return {
      tag, tasks:tagTasks.length, journals:tagJournals.length, days:days.size,
      completed:tagCompleted,
      completionRate:tagTasks.length ? tagCompleted/tagTasks.length : 0,
      postponeTasks:tagPostponed.length,
      postponeRate:tagTasks.length ? tagPostponed.length/tagTasks.length : 0,
      postponeCount:tagTasks.reduce((sum,t)=>sum+(t.postponeHistory?.length??0),0),
      maxPostponeDays:tagTasks.reduce((max,t)=>Math.max(max,postponeDays(t)),0),
      impacts,moodDistribution,moodSample:tagMoods.length,
    }
  }).filter(row=>row.tasks||row.journals)
  const mostPostponedTag = [...tagRows]
    .filter(row=>row.tasks>=3 && row.postponeTasks>0)
    .sort((a,b)=>b.postponeRate-a.postponeRate || b.postponeTasks-a.postponeTasks)[0]


  // Tag × Task has two modes:
  // "全部" = lifecycle view; shorter ranges = activity only inside the selected range.
  const tagTimelineAll = statsRange === 'all'
  const timelineStart = tagTimelineAll ? earliestTaskDate : rangeStart
  const timelineEnd = todayKey
  const timelineTasks = expandTasks(activeTasks, timelineStart, timelineEnd).filter(task=>taskOrigin(task)<=todayKey)
  const tagTaskTimelines = managedTags.map(tag=>{
    const archiveEnd = tag.archived && tag.archivedAt && tag.archivedAt < todayKey ? tag.archivedAt : todayKey
    const endKey = tagTimelineAll ? archiveEnd : (archiveEnd < todayKey ? archiveEnd : todayKey)
    const tagged = timelineTasks.filter((task): task is Task & { date:string } => {
      if (!(task.tagIds??[DEFAULT_TAG_ID]).includes(tag.id)) return false
      if (!task.date) return false
      const taskStart = task.date
      const taskEnd = taskEndDate(task)
      return taskStart <= endKey && taskEnd >= timelineStart
    })
    if (!tagged.length) return {tag, completed:0, firstDate:'', endKey, days:[] as {date:string,count:number}[]}
    const historicalFirst = tagged.reduce((min,task)=>taskOrigin(task)<min?taskOrigin(task):min,taskOrigin(tagged[0]!))
    const firstDate = tagTimelineAll ? historicalFirst : timelineStart
    const counts=new Map<string,number>()
    tagged.forEach(task=>{
      const start = task.date < timelineStart ? timelineStart : task.date
      const end = taskEndDate(task) > endKey ? endKey : taskEndDate(task)
      if(start>end) return
      for(let key=start; key<=end; key=addDaysKey(key,1)) counts.set(key,(counts.get(key)??0)+1)
    })
    const completed = tagged.filter(task=>task.status==='completed' && inRange(taskOrigin(task))).length
    return {tag, completed, firstDate, endKey, days:[...counts].map(([date,count])=>({date,count}))}
  }).filter(row=>row.firstDate && row.days.length)
  const effectiveTimelineStart = tagTimelineAll && tagTaskTimelines.length
    ? tagTaskTimelines.reduce((min,row)=>(row.firstDate ?? '')<min?(row.firstDate ?? min):min,tagTaskTimelines[0]?.firstDate ?? timelineStart)
    : timelineStart
  const timelineSpan = Math.max(1,dayDiff(effectiveTimelineStart,todayKey))

  // Word cloud tokenizer: prefer the browser's mature Intl.Segmenter for Chinese word boundaries.
  // Fallback avoids the old overlapping-bigram behaviour that produced fragments such as “始前 / 程没”.
  const stop = new Set([
    '今天','然后','就是','这个','那个','一个','还是','但是','因为','所以','感觉','觉得','可以','没有','不是','自己','我们','你们','他们','她们',
    '现在','时候','什么','怎么','已经','可能','其实','比较','非常','一下','一些','一点','这样','那样','这里','那里','起来','的话','东西','事情',
    '之前','之后','前面','后面','开始','最后','真的','应该','需要','还有','以及','而且','或者','如果','虽然','不过','只是','一直','一次','有点',
    'and','the','that','this','with','have','was','were','but','for','you','your','are'
  ])
  wordCloudIgnored.forEach(word=>stop.add(word.trim().toLowerCase()))
  const fallbackWords = new Set([
    '记录','任务','科研','论文','数据','实验','英语','学习','小说','工作','医院','临床','报告','病人','医生','老师','师妹','师姐','导师',
    '心情','睡觉','睡眠','游戏','电脑','网站','代码','标签','日历','统计','词云','完成','延期','优先级','时间','今天','明天','昨天',
    '生活','运动','阅读','求职','毕业','投稿','修改','整理','分析','结果','问题','功能','设置','同步','备份','恢复','导入','导出'
  ])
  const fallbackChinese = (run:string) => {
    const result:string[]=[]; let index=0
    while(index<run.length){
      let matched=''
      for(let size=Math.min(4,run.length-index);size>=2;size--){
        const candidate=run.slice(index,index+size)
        if(fallbackWords.has(candidate)){matched=candidate;break}
      }
      if(matched){result.push(matched);index+=matched.length}
      else index+=1
    }
    return result
  }
  const segmentChinese = (source:string) => {
    const tokens:string[]=[]
    const SegmenterCtor=(Intl as any).Segmenter
    if(SegmenterCtor){
      const segmenter=new SegmenterCtor('zh-CN',{granularity:'word'})
      for(const item of segmenter.segment(source)){
        const word=String(item.segment).trim().toLowerCase()
        if(item.isWordLike && /[\u4e00-\u9fff]/.test(word) && word.length>=2) tokens.push(word)
      }
      return tokens
    }
    ;(source.match(/[\u4e00-\u9fff]{2,}/g)??[]).forEach(run=>tokens.push(...fallbackChinese(run)))
    return tokens
  }
  const wordCounts=new Map<string,number>()
  journals.forEach(entry=>{
    const source=`${entry.title} ${entry.content}`.replace(/[#>*_`~\[\]()!]/g,' ')
    const latin=source.toLowerCase().match(/[a-z][a-z'-]{2,}/g)??[]
    latin.forEach(word=>{if(!stop.has(word))wordCounts.set(word,(wordCounts.get(word)??0)+1)})
    segmentChinese(source).forEach(word=>{if(!stop.has(word))wordCounts.set(word,(wordCounts.get(word)??0)+1)})
  })
  const words=[...wordCounts.entries()].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0],'zh-CN')).slice(0,36).map(([word,count])=>({word,count}))

  const pointForStatus = <T extends {date:string;level:number}>(row:T) => {
    const span = Math.max(1, dayDiff(rangeStart==='0000-01-01' ? row.date : rangeStart, todayKey))
    const offset = rangeStart==='0000-01-01' ? 0 : Math.max(0, dayDiff(rangeStart, row.date))
    return { ...row, x: rangeStart==='0000-01-01' ? 50 : 6+(offset/span)*92, y: 36 - ((row.level-1)/4)*32 }
  }
  const moodLinePoints = [...moods].sort((a,b)=>a.date.localeCompare(b.date)).map(pointForStatus)
  const energyLinePoints = [...energies].sort((a,b)=>a.date.localeCompare(b.date)).map(pointForStatus)
  const yearStartDate = new Date(today.getFullYear(),0,1)
  const heatmapLeading = weekStartsMonday ? (yearStartDate.getDay()+6)%7 : yearStartDate.getDay()
  const moodByDate = new Map(dailyMoods.map(item=>[item.date,item.level]))
  const energyByStatDate = new Map(dailyEnergy.map(item=>[item.date,item.level]))
  const yearHeatmap = Array.from({length:365 + (new Date(today.getFullYear(),1,29).getMonth()===1 ? 1 : 0)},(_,index)=>{
    const date=new Date(today.getFullYear(),0,index+1)
    const key=toDateKey(date)
    return {key,level:moodByDate.get(key),energyLevel:energyByStatDate.get(key),future:key>todayKey}
  })
  const allMoodYears = dailyMoods.length || dailyEnergy.length
    ? Array.from(new Set([...dailyMoods,...dailyEnergy].map(item=>Number(item.date.slice(0,4))))).sort((a,b)=>a-b)
    : [today.getFullYear()]
  const allHeatmapYears = allMoodYears.map(year=>{
    const first=new Date(year,0,1)
    const leading=weekStartsMonday ? (first.getDay()+6)%7 : first.getDay()
    const leap=new Date(year,1,29).getMonth()===1
    const days=Array.from({length:365+(leap?1:0)},(_,index)=>{
      const date=new Date(year,0,index+1)
      const key=toDateKey(date)
      return {key,level:moodByDate.get(key),energyLevel:energyByStatDate.get(key),future:key>todayKey}
    })
    return {year,leading,days}
  })

  return {rangeStart,todayKey,eligibleTasks,completed,abandoned,overdue,completionRate,postponedTasks:postponedTasks.length,
    postponeEvents:postponeEvents.length,postponeRate,maxPostponeCount,maxPostponeDays,completedByDay,completionTrend,focusSeconds,focusTrend,focusTagRows,focusColorRows,focusPieGradient,focusPieLabels,mostPostponedTag,mostPostponedTask,longestPostponedTask,journals,journalDays,moods,moodDays,energyDays,statusDays,
    impactCounts,moodCounts,energyCounts,priorityCounts,tagRows,defaultTagImpactRow,tagTaskTimelines,timelineStart:effectiveTimelineStart,timelineSpan,tagTimelineAll,words,moodLinePoints,energyLinePoints,heatmapLeading,yearHeatmap,allHeatmapYears}
}
