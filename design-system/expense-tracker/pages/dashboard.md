# Dashboard & Auth Page Overrides

> Overrides `MASTER.md` where Personal Finance domain precision and WCAG 2.2 AA accessibility require stricter tokens.

## Verified Overrides
- **Typography (`--domain typography`: Financial Trust):** Replaced `MASTER.md` cursive pairing (`Caveat` + `Quicksand`) with `IBM Plex Sans` (headings/UI) and `IBM Plex Mono` (tabular currency amounts, dates, percentages) for financial legibility.
- **Accessible Light & Dark Theme Tokens (`pro-rules.md`):**
  - Light Surface: `#F1F5F9` (avoids stark pure-white page background), Card `#FFFFFF`, Foreground `#0F172A` (>15:1), Muted `#475569` (7.2:1).
  - Dark Surface: `#0B1120`, Glass Card `rgba(22, 32, 50, 0.78)` over `#0B1120`, Foreground `#F8FAFC` (>15:1), Muted `#94A3B8` (6.4:1).
  - Primary CTA: `#047857` + `#FFFFFF` text in light mode (5.1:1); `#10B981` + `#022C22` text in dark mode (6.6:1).
- **Mobile Bento Hierarchy (375px safe):** Featured full-width Monthly card + 2-column Today/This Week cards on mobile (`lg:grid-cols-3` on desktop) so long IDR amounts (`Rp1.500.000`) never clip.
- **Touch & A11y:** All interactive controls enforce `min-h-11` (`44px`), `gap-2` (`8px`) minimum separation, visible `<label>` elements, SVG vector icons (`strokeWidth={1.75}`), `prefers-reduced-motion` support, and `<details>` table fallbacks for charts.
