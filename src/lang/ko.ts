// Korean support. Vocabulary for today/tomorrow/yesterday, weekdays,
// this/next/last, the hour/minute/day/week/month/year units, and the
// "later"/"agosuffix" relative-expression markers is taken directly from
// CreamNuts' translateKoreanToEnglish() dictionary
// (https://github.com/CreamNuts/nldates-obsidian-korean, MIT), since it's
// vocabulary a real Korean-speaking user base has already been using.
//
// Korean phrases numbers in a suffix position (number + unit + marker, e.g.
// "3일 후" = "3 days" + "후" ("later") = "in 3 days"), not English's prefix
// "in 3 days" -- so inminutes/indays/etc. and daysago/weeksago/etc. below are
// built suffix-style, the same mechanism already used for Chinese (see
// zh.ts's "later"/"agosuffix" comments), rather than mirroring the English
// template literally.
//
// UNVERIFIED: "and"/"at"/"from"/"to"/"of" below don't have an equivalent in
// CreamNuts' file (his translator doesn't support combined durations,
// weekday+time, or date ranges) and are my own best-effort picks, not
// checked by a Korean speaker. Korean normally attaches particles like 에
// ("at")/부터("from")/까지("to")/의("of") directly to the previous word with
// no space, while this plugin's regex patterns require them as a
// space-separated standalone word -- so "next Monday at 3pm"-, "from Monday
// to Friday"-, "in 2 weeks and 3 days"-, and "the 15th of next month"-style
// combined expressions may not match natural Korean phrasing even though the
// simple expressions above do. Tracked in #40.
const dict = {
  today: "오늘",
  tomorrow: "내일",
  yesterday: "어제",
  next: "다음",
  last: "지난",
  this: "이번",
  in: "이내",
  sunday: "일요일",
  monday: "월요일",
  tuesday: "화요일",
  wednesday: "수요일",
  thursday: "목요일",
  friday: "금요일",
  saturday: "토요일",
  inminutes: "%{timeDelta}분 후",
  inhours: "%{timeDelta}시간 후",
  indays: "%{timeDelta}일 후",
  inweeks: "%{timeDelta}주 후",
  inmonths: "%{timeDelta}개월 후",
  daysago: "%{timeDelta}일 전",
  weeksago: "%{timeDelta}주 전",
  monthsago: "%{timeDelta}개월 전",
  minutesago: "%{timeDelta}분 전",
  hoursago: "%{timeDelta}시간 전",
  // Suffix markers for "N unit" + marker (e.g. "3일 후" = "in 3 days",
  // "2주 전" = "2 weeks ago") -- verified against CreamNuts' handleNativeDateExpressions()/processNumberPattern().
  later: "후|뒤",
  agosuffix: "전|앞",
  time: "시간",
  now: "지금",
  plusminutes: "+%{timeDelta}분",
  minusminutes: "-%{timeDelta}분",
  plushour: "+%{timeDelta}시간",
  minushour: "-%{timeDelta}시간",
  minute: "분",
  hour: "시간",
  day: "일",
  week: "주",
  month: "개월|달",
  year: "년",
  and: "그리고",
  at: "에",
  from: "부터",
  to: "까지",
  of: "의",
  first: "첫",
} as const;

export default dict;
