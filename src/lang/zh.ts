const dict = {
  today: "今天",
  tomorrow: "明天",
  yesterday: "昨天",
  // Formal ("下一個"/"下一个") and short prefix ("下", e.g. "下星期一"/"下周一") forms,
  // covering both Traditional and Simplified script.
  next: "下一個|下一个|下",
  // "最後/最后" ("last" in general), "上一個/上一个" ("previous"), and short "上"
  // (e.g. "上星期一"/"上周一").
  last: "最後|最后|上一個|上一个|上",
  // "這個/这个" (formal) and short "這/这" (e.g. "這星期一"/"这周一").
  this: "這個|这个|這|这",
  in: "在",
  // "禮拜/礼拜" (colloquial, originally "worship day") is also extremely common
  // for weekdays, e.g. "禮拜一"/"礼拜一" for Monday.
  sunday: "星期日|周日|週日|星期天|禮拜日|礼拜日|禮拜天|礼拜天",
  monday: "星期一|周一|週一|禮拜一|礼拜一",
  tuesday: "星期二|周二|週二|禮拜二|礼拜二",
  wednesday: "星期三|周三|週三|禮拜三|礼拜三",
  thursday: "星期四|周四|週四|禮拜四|礼拜四",
  friday: "星期五|周五|週五|禮拜五|礼拜五",
  saturday: "星期六|周六|週六|禮拜六|礼拜六",
  inminutes: "%{timeDelta}分鐘後",
  inhours: "%{timeDelta}小時後",
  indays: "%{timeDelta}天後",
  inweeks: "%{timeDelta}週後",
  inmonths: "%{timeDelta}個月後",
  daysago: "%{timeDelta}天前",
  weeksago: "%{timeDelta}週前",
  monthsago: "%{timeDelta}個月前",
  minutesago: "%{timeDelta}分鐘前",
  hoursago: "%{timeDelta}小時前",
  // Not used for display, only for matching "N unit" + this marker (e.g.
  // "2天後"/"2天后" = "2 days" + "後"/"后" = "2 days later"). Kept separate from
  // the %{timeDelta} templates above (which are also used verbatim in
  // autosuggest labels and don't support "|" alternatives the same way).
  // "之後/之后" and "以後/以后" are equally common alternatives to bare "後/后"
  // (e.g. "2天之後", "3個月以後").
  later: "後|后|之後|之后|以後|以后",
  time: "時間|时间",
  now: "現在|现在",
  plusminutes: "+%{timeDelta}分鐘",
  minusminutes: "-%{timeDelta}分鐘",
  plushour: "+%{timeDelta}小時",
  minushour: "-%{timeDelta}小時",
  minute: "分鐘|分钟|分",
  hour: "小時|小时|時|时",
  day: "天|日",
  week: "週|周|星期|個星期|个星期|禮拜|礼拜|個禮拜|个礼拜",
  month: "月|個月|个月",
  year: "年",
  and: "和",
  at: "在",
  from: "從|从|自",
  to: "到|至",
  of: "的",
  first: "第一|第一個|第一个",
} as const;

export default dict;
