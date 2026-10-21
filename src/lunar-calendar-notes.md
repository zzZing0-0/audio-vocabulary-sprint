# Zing dual-calendar foundation (v0.6.17)

- Main calendar remains Gregorian.
- Task / Journal / Mood storage remains Gregorian `YYYY-MM-DD`.
- Lunar text is derived at render time with the browser `Intl.DateTimeFormat('zh-CN-u-ca-chinese')`.
- `solarToLunar()` is the conversion boundary reserved for Anniversary.
- Anniversary lunar recurrence still needs reverse lunar→solar conversion and explicit leap-month policy; do not infer it by string matching.
- No almanac / zodiac / auspicious-day data is introduced.
