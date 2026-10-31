# Squeek Keeper Console design system

## Overview

A compact workbench for Squeekchain keepers and holders. Warm paper, forest-green actions, and locally drawn pixel hamsters carry the requested hamster-pixel style. The primary task appears before supporting history and account tools. Display type supplies the pixel character; ordinary interface copy stays readable in a sans serif.

`src/styles.css` is the token and layout source of truth. `src/components.tsx` provides shared controls; `src/App.tsx` composes this one-page console. There is one light appearance and no theme switch.

## Colors

CSS uses hex primitives with semantic aliases. Components reference role tokens; illustration colors stay local to the artwork.

| Semantic token | Implemented value | Use |
| --- | --- | --- |
| `--color-bg-page` | `#faf8f1` | Warm page and dialog background |
| `--color-bg-subtle` | `#f2f0e7` | Telemetry strip, input/disabled areas, ping section |
| `--color-bg-surface` | `#fffef9` | Secondary buttons and fields |
| `--color-text-primary` | `#293626` | Main copy and headings |
| `--color-text-secondary` | `#515e4b` | Supporting copy and labels |
| `--color-text-disabled` | `#65705e` | Disabled controls |
| `--color-border` | `#c7cbbc` | Control and dialog boundaries |
| `--color-separator` | `#e5e3d6` | Rows and section dividers |
| `--color-accent-subtle` | `#eaf0db` | Keeper panel, selection, hover |
| `--color-accent-art` | `#e0e8c4` | Wheel illustration plane |
| `--color-accent-solid` / `--color-focus` | `#304f36` | Primary button, progress fill, focus ring |
| `--color-accent-solid-hover` | `#233d29` | Primary hover |
| `--color-accent-highlight` | `#d5ed8b` | Selection and spinning status accent |
| `--color-text-on-accent` | `#fffef9` | Primary action text |
| `--color-status-success` | `#3f6142` | Confirmed status and available-data dots |
| `--color-status-danger` / `--color-status-danger-bg` | `#943c29` / `#f9e8e0` | Errors and reverted state |

The disabled Keeper action intentionally uses `#536048` on `#d5dec2`. The scrim is `#17201280`. The decorative grid uses `#63764b0a` over the artwork plane. Status always includes text or an icon. Contrast measurement results and unmeasured cases are in the validation record.

## Typography

Locally bundled font packages provide DM Sans Variable (normal weight axis) and Pixelify Sans 500. System monospace is reserved for addresses, hashes, code, ranks, and hardware data. No font is fetched at runtime.

| Token | Size at 16px root | Role |
| --- | --- | --- |
| `--text-small` | 14px | Dense UI, labels, captions, addresses |
| `--text-body` | 16px | Base copy, inputs, subsection titles |
| `--text-subheading` | 20px | Balances and dialog result headings |
| `--text-heading` | 24px | Section headings, brand |
| `--text-display` | 36px | Main heading |
| `--text-metric` | 64px | Pending round count |

Weights are 400, 500, and 600. Body line height is 1.5; display headings use 1.15, subsection headings 1.3, and the single-line pending count 1. Numbers use tabular numerals. Display tracking is `-.025em`; regular copy uses natural spacing. Prose is capped at 68ch. Addresses/hashes wrap rather than being clipped; compact addresses retain their full value in the accessible name, title, and explorer destination. Inputs remain at least 16px at the default mobile text size. `SPINNING`, `IDLE`, `RPM`, `SQK`, and the hardware label retain their domain-specific casing.

## Layout

The outer maximum width is 1184px, including 32px side padding on desktop, giving 1120px of content. Header, navigation, telemetry, desks, and footer share those edges. Spacing is primarily 4px-based, with 6/10/14/18px optical adjustments. Common control gaps are 12px, inner padding 20–32px, and section gaps 32–44px. There are no separate spacing-variable tokens.

The Keeper panel and wheel illustration use a `1.15fr 1fr` grid. Holder and SQK desks use `1.3fr 1fr` grids; statistics use four columns. Source reading order is preserved when columns collapse. Details and history expand vertically, with no sticky content covering actions.

- **960px:** telemetry loses its refresh caption; workbench padding shrinks; account columns become `1.15fr 1fr`.
- **720px:** content insets become 20px, desk suffixes/docs navigation disappear, account desks stack, statistics become two columns, and the wheel illustration uses a narrower companion column.
- **640px:** dialogs become full-width bottom sheets, with safe-area padding and bounded viewport height.
- **520px:** content insets become 16px; telemetry forms two rows; decorative wheel art is hidden, bringing the transaction action forward; the leaderboard wraps dates; wallet controls are compact.
- **359px:** content insets become 12px, the main heading uses 24px, the header hamster is omitted, and paired transaction controls stack.

The header/navigation wrap when enlarged text needs more room. Section-title children have `min-width: 0`, and table cells can wrap. Browser checks covered 320, 390, 720, 960, and 1440px and 200% application text sizing. Native browser zoom is a separate unperformed check.

## Elevation & Depth

The interface is flat: tonal areas establish hierarchy; 1px borders define controls and separators. There are no box shadows, gradient text, nested surface cards, or floating chrome. The dialog uses the browser top layer and a half-opacity dark scrim. The only grid texture belongs to the decorative wheel scene.

## Shapes

Controls use 5px radii, small structural areas 6px, and the joined Keeper workbench 10px outer corners. Bottom sheets use 12px top corners. Pixel artwork uses stepped paths and crisp edges; it is never substituted for functional labels or controls.

## Components

- **`Action` (`src/components.tsx`):** label, callback, optional disabled reason, and `primary` emphasis. Shared `.button` states cover hover, pressed, focus, disabled, and pending text. Disabled reasons remain beside the control and are linked with `aria-describedby`. Buttons are at least 48px tall.
- **`Wallet` (`src/Wallet.tsx`):** one connect control, named EIP-6963 rows, Coinbase row, mobile wallet-browser links, address/ETH menu, disconnect, and Sepolia switch. Each wallet row has its mark and a pending state; rejection leaves a recoverable inline note.
- **`Modal` (`src/components.tsx`):** native `dialog.showModal()` supplies background inertness and keyboard focus containment. Escape/backdrop/close dismiss when idle; focus returns to the opener. Active wallet submission temporarily prevents dismissal. Content scrolls with `overscroll-behavior: contain`.
- **`ReviewTransaction` (`src/ReviewTransaction.tsx`):** simulating, simulation error/retry, review, awaiting wallet, and submitted states. A definition list makes full transaction parameters readable. Only its confirmation button sends; success exposes the whole hash.
- **`AddressLink`, `.hash-link`:** compact addresses have full accessible values; transaction previews and hashes expose wrapping full strings. Explorer destinations are always Sepolia.
- **`Notice`:** neutral contextual information or an error variant with an icon. Untied errors use an alert; routine wallet feedback uses a status region.
- **`WheelStrip` / `WheelScene` (`src/App.tsx`):** live text/progress data is separate from decorative pixel art. No continuous animation is required to understand the wheel status.
- **`Leaderboard` / `.keeper-row`:** one aligned three-column shape, semantic table/row/cell roles, true links inside cells, tabular counts, top-five disclosure, and loading/error/empty states.
- **`.nft-row`:** a native labeled checkbox, token ID, level, custody text, and an explorer link. Deposited NFTs remain visible but cannot be selected for a second deposit.
- **Amount field:** persistent label, decimal keyboard, 18-decimal validation, inline help, and Max. Approval and stake remain separate actions.
- **`Hamster` and `Icon`:** reusable original SVG artwork and one small outline icon set. Decorative SVGs are hidden from assistive technology. Wallet marks retain their vendor colors.

Motion is limited to 120ms background/border transitions and a `scale(.96)` press response, inside `prefers-reduced-motion: no-preference`. Focus uses a 2px forest-green outline with 4px offset, plus system Highlight in forced colors. There are no entrance sequences or endless animations.

## Do's and Don'ts

- Start a new desk with `.desk-section`, `.desk-title`, and the existing grid patterns; keep the actionable content before supporting prose.
- Reuse `Action`, `Modal`, and the semantic color tokens. Keep the filled primary treatment for the leading task or active confirmation.
- Keep honest loading, empty, stale, error, pending, confirmed, and reverted states. Never turn an unavailable read into a zero or seed a leaderboard.
- Preserve full amounts, addresses, and transaction details in reviews. Use the six-size scale and existing locally bundled fonts.
- Keep the pixel style in headings and art; retain sans-serif prose. Do not introduce glows, heavy shadows, marketing sections, or motion that competes with a transaction.
- New transaction actions belong in the typed intent/preparation flow, with simulation, explicit review, wallet confirmation, and the shared activity log.
