# Strings Audit — Kurdish Imposter

All user-facing strings in the codebase. This is the input for Phase 2 i18n.

Conventions:
- Keys use dot.separated.snake_case, namespaced by screen.
- "Kurdish (Sorani)" column = exact text in source today.
- "English" column = English translation/equivalent (not always present in source — for SUBTITLE strings the source already supplies an English line).
- Dynamic interpolations use `{var}` placeholders.

Generated 2026-04-24 against the post-change codebase.

---

## App metadata — `app.json`

| Key | Kurdish (Sorani) | English | Location |
| --- | --- | --- | --- |
| `app.os_name` | — | `Kurdish Imposter` | app.json:3 |

---

## Home screen — `App.tsx`

| Key | Kurdish (Sorani) | English | Location |
| --- | --- | --- | --- |
| `home.title` | `کوردی ئیمپۆستەر` | `KURDISH IMPOSTER` | App.tsx:93 / 95 |
| `home.tagline` | `یاری ناسینی ئیمپۆستەر بە وشەی نهێنی — ٣ تا ١٠ یاریزان، تەنها یەک مۆبایل.` | (no English in source) | App.tsx:97 |
| `home.btn.new_game` | `یاری نوێ` | `NEW GAME` | App.tsx:100 |
| `home.btn.how_to_play` | `چۆنیەتی یاری` | `HOW TO PLAY` | App.tsx:103-104 |
| `home.howto.title` | `چۆنیەتی یاری` | (no English) | App.tsx:108 |
| `home.howto.step_1` | `١. هەڵبژاردنی ژمارەی یاریزانان` | (no English) | App.tsx:109 |
| `home.howto.step_2` | `٢. هەر یاریزان بە نۆرە مۆبایل وەردەگرێت و وشەی خۆی دەبینێت` | (no English) | App.tsx:110 |
| `home.howto.step_3` | `٣. یەک یاریزان ئیمپۆستەرە — وشەی «ئیمپۆستەر» دەبینێت` | (no English) | App.tsx:111 |
| `home.howto.step_4` | `٤. بە نۆرە هەرکەس یەک کلیدێک دەربارەی وشەکە دەڵێت` | (no English) | App.tsx:112 |
| `home.howto.step_5` | `٥. لە کۆتایی، دەنگ بە کەسێک دەدەن` | (no English) | App.tsx:113 |
| `home.howto.step_6` | `٦. ئەگەر ئیمپۆستەر دۆزرایەوە — یاریزانان براون` | (no English) | App.tsx:114 |

---

## Setup screen — `App.tsx`

| Key | Kurdish (Sorani) | English | Location |
| --- | --- | --- | --- |
| `setup.title` | `ڕێکخستنی یاری` | `SETUP` | App.tsx:136-137 |
| `setup.players_count` | `ژمارەی یاریزانان` | (no English) | App.tsx:140 |
| `setup.player_names` | `ناوی یاریزانان` | `PLAYER NAMES` | App.tsx:163-165 |
| `setup.player_name_placeholder` | (uses default `Player {n}`) | `Player {n}` | App.tsx:181 (via `defaultPlayerName`, game.ts:33) |
| `setup.imposter_count` | `ژمارەی ئیمپۆستەر` | (no English) | App.tsx:190 |
| `setup.category_label` | `بەش` | (no English) | App.tsx:200 |
| `setup.category_pairs_suffix` | `جووت` ("pairs") | — | App.tsx:213 |
| `setup.round_seconds` | `کاتی گفتوگۆ` | (no English) | App.tsx:221 |
| `setup.btn.start` | `دەستپێکردن` | `START` | App.tsx:235 |
| `setup.btn.back` | `گەڕانەوە` | `BACK` | App.tsx:237 |

Category labels (`label_ku`) live in `assets/word_pairs.json`, not in code. They render at App.tsx:211. Audit those separately when content moves to i18n.

---

## Deal screen — `App.tsx`

| Key | Kurdish (Sorani) | English | Location |
| --- | --- | --- | --- |
| `deal.pass.headline` | `مۆبایلەکە بدە بە` | (no English) | App.tsx:296 |
| `deal.pass.seat_subtitle` | `(یاریزان ژمارە {n})` | — | App.tsx:302 |
| `deal.pass.instructions` | `مۆبایلەکە بدە بە یاریزان و ئەو کلیک بکات تا وشەکەی ببینێت` | (no English) | App.tsx:305 |
| `deal.pass.btn.ready` | `ئامادەم — وشەکەم نیشان بدە` | `I'M READY — SHOW MY WORD` | App.tsx:309-310 |
| `deal.pass.btn.cancel` | `پاشگەزبوونەوە` | (no English) | App.tsx:314 |
| `deal.reveal.your_word_label` | `وشەکەت` | (no English) | App.tsx:326 |
| `deal.reveal.imposter_word` | `ئیمپۆستەر` | `Imposter` | game.ts:38 (`IMPOSTER_WORD_KU`) — rendered at App.tsx:335 |
| `deal.reveal.secret_warning` | `ئەم وشەیە لە کەسی تر مەشارە. پاش تەواوبوون، مۆبایلەکە بگەڕێنەوە.` | (no English) | App.tsx:339 |
| `deal.reveal.btn.start_discussion` | `دەستپێکردنی گفتوگۆ` | `START DISCUSSION` | App.tsx:343-344 |
| `deal.reveal.btn.next_player` | `تەواو — بۆ یاریزانی داهاتوو` | `DONE — NEXT PLAYER` | App.tsx:343-344 |

---

## Discuss screen — `App.tsx`

| Key | Kurdish (Sorani) | English | Location |
| --- | --- | --- | --- |
| `discuss.timer_label` | `کاتی گفتوگۆ` | (no English) | App.tsx:394 |
| `discuss.instructions` | `بە نۆرە هەرکەس یەک کلیدێک (یەک وشە) دەربارەی وشەکەی خۆی دەڵێت.` | (no English) | App.tsx:415 |
| `discuss.category_prefix` | `بەشی: {category}` | — | App.tsx:418 |
| `discuss.btn.pause` | `وەستان` | `PAUSE` | App.tsx:423-424 |
| `discuss.btn.resume` | `بەردەوام بە` | `RESUME` | App.tsx:423-424 |
| `discuss.btn.go_to_vote` | `بۆ دەنگدان` | `GO TO VOTE` | App.tsx:429 |
| `discuss.btn.cancel` | `پاشگەزبوونەوە` | (no English) | App.tsx:431 |

---

## Vote screen — `App.tsx`

| Key | Kurdish (Sorani) | English | Location |
| --- | --- | --- | --- |
| `vote.title` | `دەنگدان` | `WHO IS THE IMPOSTER?` | App.tsx:449-450 |
| `vote.subtitle` | `گشت یاریزانان لێرە دەنگی خۆیان دەدەن — کامیان گومانی لەسەرە؟` | (no English) | App.tsx:452 |
| `vote.btn.confirm` | `پاڵپشتیکردنی دەنگەکە` | `CONFIRM VOTE` | App.tsx:476-477 |
| `vote.btn.back` | `گەڕانەوە` | (no English) | App.tsx:482 |

---

## Reveal screen — `App.tsx`

| Key | Kurdish (Sorani) | English | Location |
| --- | --- | --- | --- |
| `reveal.crew_wins` | `یاریزانان براون!` | `CREW WINS` | App.tsx:515 / 518 |
| `reveal.imposter_wins` | `ئیمپۆستەر براوە!` | `IMPOSTER WINS` | App.tsx:515 / 518 |
| `reveal.imposter_label_singular` | `ئیمپۆستەرەکە:` | — | App.tsx:523 |
| `reveal.imposter_label_plural` | `ئیمپۆستەرەکەکان:` | — | App.tsx:523 (suffix `کان` appended for plural) |
| `reveal.words_label` | `وشەکانی ئەم گەمە` | — | App.tsx:537 |
| `reveal.tag.crew` | — | `CREW` | App.tsx:541 |
| `reveal.tag.imposter` | — | `IMPOSTER` | App.tsx:546 |
| `reveal.btn.play_again` | `یارییەکی نوێ بکە` | `PLAY AGAIN` | App.tsx:553 |
| `reveal.btn.home` | `گەڕانەوە بۆ سەرەکی` | (no English) | App.tsx:555 |

---

## Game logic — `game.ts`

| Key | Kurdish (Sorani) | English | Location |
| --- | --- | --- | --- |
| `imposter_word` | `ئیمپۆستەر` | `Imposter` | game.ts:38 (`IMPOSTER_WORD_KU`) |
| `default_player_name` | (none — English only) | `Player {n}` | game.ts:42 (`defaultPlayerName`) |

---

## Notes for Phase 2

- Category labels and word pairs live in `assets/word_pairs.json` — they are content, not chrome. Plan: rename `label_ku` to a key, add per-locale tables (`label.ku`, `label.en`, `label.ar`...) and wire `categoryLabel` in `dealGame` to the active locale.
- `IMPOSTER_WORD_KU` should become `t('imposter_word')` once an i18n provider is in place. The constant name flags it as a temporary hard-code.
- Plural suffix `کان` at App.tsx:523 is morphological; do not concatenate strings in i18n — use ICU `plural` or two distinct keys.
- The arabic-indic digits `١-٦` in the howto steps are preserved; for non-Sorani locales these should switch to ASCII `1-6`.
- `defaultPlayerName` is currently English-only by design — once i18n ships, swap to a localized template like `t('default_player_name', { n: i + 1 })`.
