# Concept-to-render fidelity ledger

Approved references: `nico-desktop-approved.png` and `nico-mobile-approved.png`.
QA viewports: 1440×1000, 1024×768, and 390×844.

## Desktop shell

| Surface | Approved intent | Production render | Result |
| --- | --- | --- | --- |
| Header | Deep navy lockup, synthetic-data note, source link | Same hierarchy, colors, authorship, and source action | Match |
| Hero | Editorial serif headline with two persona actions | Same message, CTA hierarchy, and ivory editorial field | Match |
| Pipeline story | Five-stage source-to-BI flow | Same five-stage sequence with restrained icons and gold connectors | Match |
| Navigation | Navy rail with persona control and grouped evidence | Same rail; global item order follows the active persona journey | Match |
| Data surfaces | Square, report-like cards with restrained borders | Same low-shadow report treatment across every page | Match |
| Visual language | Navy, ivory, gold, green/red semantics | Same palette, contrast, serif/sans pairing, and status semantics | Match |
| Responsive behavior | Preserve information hierarchy through laptop | 1024×768 browser suite passes with no page overflow | Match |

## Mobile shell

| Surface | Approved intent | Production render | Result |
| --- | --- | --- | --- |
| Header | Compact mark plus menu trigger | Same compact lockup and accessible menu button | Match |
| Hero | Centered headline and persona choice | Same centered headline and stacked full-width actions | Match |
| Persona control | Compact selector plus Explore drawer action | Same two-control bar; selection persists in the URL | Match |
| Quick actions | Start tour and Run pipeline | Same paired actions with touch-sized targets | Match |
| Content flow | Single-column report surfaces | All principal pages stack without page-level horizontal overflow | Match |
| Dense tables | Keep analytical detail without shrinking text | Tables scroll inside bounded cards; page width remains fixed | Adapted intentionally |
| Tours | Replayable three-step mobile journey | Both persona tours complete and persist for the browser session | Match |

## Verification evidence

- Automated browser coverage exercises every principal page at 390×844 and the primary journeys at 1024×768 and 1440×1000.
- The acceptance suite reaches 10/10, rating deep links preserve tested inputs, and navigation preserves exact persona order.
- Visual QA compared approved references with local rendered captures in the same review pass.
