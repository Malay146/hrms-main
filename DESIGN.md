# Design System: HRMS

**Product:** HRMS (Human Resource Management System)  
**Source of truth:** this file. All new UI must match the screens already in this repo. Do not invent a second visual language.

---

## 1. Visual theme and atmosphere

HRMS is a **neutral, zinc-first operations product**. The mood is dense, precise, and calm — closer to an internal tools console than a colorful SaaS marketing site.

- **Palette philosophy:** almost no brand hue. Primary actions are near-black (`#18181B` / `#171717`) on white. Color is reserved for status (green / amber / red / sky).
- **Density:** data-heavy. Tables, KPI strips, and nested cards sit close together with 16–24px gaps, not large marketing whitespace.
- **Surfaces:** white cards on a cool off-white canvas (`#FAFAFA`). Nested cards stay white with a 1px hairline, not drop shadows.
- **Corners:** generous on page shells (`rounded-2xl` = 16px), slightly tighter on controls (`rounded-lg` = 8px) and KPI tiles (`rounded-xl` = 12px).
- **Depth:** mostly flat. Elevation comes from 1px borders (`--border`) and hairline inner shadows on logo/auth chrome. Marketing/auth CTAs may use a soft black shadow; app tables do not.
- **Motion:** short and physical — 150–200ms color/border transitions, `active:scale-[0.98]` on buttons, `animate-in fade-in slide-in-from-top-2` on popovers. Landing uses Motion with a 3D stair of product screenshots. In-app pages do not use large entrance animations.

**Do not** introduce saturated blues as the primary button, purple gradients, glassmorphism on app pages, or colorful chart palettes. Charts are grayscale zinc bars and zinc pie slices.

---

## 2. Brand marks

### Wordmark

- Product name: **HRMS**
- Sidebar: 16px (h4) bold, `tracking-tight`, `text-text-primary`, next to an 32×32 logo tile
- Landing navbar: 18px (`text-lg`) bold, zinc-950 / white in dark mode
- Never restyle as “H.R.M.S.”, never add a tagline inside the app chrome

### Logo mark

Custom SVG in [`components/icons/logo.tsx`](components/icons/logo.tsx): two interlocking offset blocks.

- Left/upper fills: muted stone `#737373`
- Right/lower fills: charcoal `#404040`
- Default viewBox: 16×16
- Sizes in use: 16px (sidebar tile), 24px (landing nav), 32px (auth home button)

**Logo tile (sidebar / auth):** `w-8 h-8` (or `p-3` wrapping `size-8` on auth), `rounded-lg` or `rounded-xl`, `border border-border` / `border-zinc-200/80`, `bg-surface` / white, optional inset highlight shadow on auth:

`shadow-[0px_1px_3px_0px_#00000015,inset_0px_1px_1px_0px_#ffffff40,inset_0px_-1px_3px_0px_#00000025]`

---

## 3. Color palette and roles

Prefer semantic tokens (`bg-surface`, `text-text-primary`, `border-border`) over raw zinc when adding app chrome. Existing pages often still use `zinc-*`; new work should use tokens so dark mode keeps working. Hardcoded zinc utilities are remapped in [`.dark` overrides in `app/globals.css`](app/globals.css).

### Light mode (default)

| Token | Hex / value | Role |
| --- | --- | --- |
| `--background` | `#FAFAFA` | App canvas behind the page card |
| `--surface` | `#FFFFFF` | Page card, sidebar, popovers, table body |
| `--surface-secondary` | `#F5F5F5` | Slightly sunken chips (⌘K badge) |
| `--surface-hover` | `#F3F4F6` | Row / button hover |
| `--text-primary` | `#171717` | Titles, names, KPI values |
| `--text-secondary` | `#525252` | Supporting copy, axis-adjacent labels |
| `--text-tertiary` | `#737373` | Search placeholder, captions, role under name |
| `--text-disabled` | `#A3A3A3` | Empty states, Y-axis ticks |
| `--text-inverse` | `#FFFFFF` | Text on near-black fills |
| `--border` | `oklch(0.922 0 0)` ≈ zinc-200 | Default hairline |
| `--border-strong` | `#D4D4D4` | Hovered inputs, focused filters |
| `--divider` | `#F0F0F0` | Chart grid, nested splits |
| `--icon-primary` | `#404040` | Emphasized icons |
| `--icon-secondary` | `#737373` | Default nav / action icons |
| `--icon-disabled` | `#A3A3A3` | Inactive icons |
| `--primary` | `oklch(0.205 0 0)` ≈ `#171717` | Active sidebar item, shadcn default button |
| `--primary-hover` | `#1D4ED8` | Token exists; **app CTAs do not use this blue**. App primary buttons stay zinc-900 |
| `--primary-active` | `#1E40AF` | Same — do not use for app CTAs |
| `--primary-soft` | `#DBEAFE` | Soft info wash (rarely used) |
| `--success` | `#16A34A` | Positive deltas, Approved |
| `--success-soft` | `#DCFCE7` | Success badge fill |
| `--warning` | `#D97706` | Pending, Late, On Leave |
| `--warning-soft` | `#FEF3C7` | Warning badge fill |
| `--error` | `#DC2626` | Logout, Rejected, Clock Out |
| `--error-soft` | `#FEE2E2` | Error badge fill |
| `--info` | `#0284C7` | Informational badges |
| `--info-soft` | `#E0F2FE` | Info badge fill |
| `--overlay` | `rgba(0,0,0,0.40)` | Modal scrim (if added) |
| `--focus-ring` | `#93C5FD` | Focus ring at 40% opacity |
| `--sidebar` | `oklch(0.985 0 0)` | Sidebar background |

**KPI icon tile (default / total counts):** gradient `#18181B` → `#71717A`, 1px outline `rgba(39,39,42,0.5)`, shadow `rgba(24,24,27,0.15)`.

**Chart bars:** linear gradient `#E4E4E7` (top) → `#18181B` (bottom), stroke fade from zinc-950 at 40% to transparent. Pie slices: `#18181B`, `#D4D4D8`, `#525252`, `#737373`, `#A3A3A3`.

### Dark mode (`.dark` on `<html>`, toggled in sidebar)

| Token | Hex / value | Role |
| --- | --- | --- |
| `--background` | `oklch(0.129 0 0)` | Canvas |
| `--surface` | `#141416` | Page shell |
| `--surface-secondary` | `#1E1E20` | Nested cards, table body |
| `--surface-hover` | `#2C2C2E` | Hover |
| `--text-primary` | `#FAFAFA` | Headings |
| `--text-secondary` | `#D4D4D8` | Body |
| `--text-tertiary` | `#A1A1AA` | Captions |
| `--text-disabled` | `#52525B` | Disabled |
| `--text-inverse` | `#141416` | On inverted (light) buttons |
| `--border` | `#242426` | Outer shells |
| `--border-strong` | `#3F3F46` | Nested / hover |
| `--divider` | `#202022` | Grid |
| `--primary` | `oklch(0.98 0 0)` | Inverted primary fill |
| `--success` | `#4ADE80` | Badges |
| `--success-soft` | `rgba(22,163,74,0.15)` | Badge wash |
| `--warning` | `#FBBF24` | Badges |
| `--warning-soft` | `rgba(217,119,6,0.15)` | Badge wash |
| `--error` | `#F87171` | Badges |
| `--error-soft` | `rgba(220,38,38,0.15)` | Badge wash |
| `--info` | `#38BDF8` | Badges |
| `--info-soft` | `rgba(2,132,199,0.15)` | Badge wash |

Nested `.bg-surface` inside `.bg-surface` becomes `#1E1E20` with `#3F3F46` border. Table `th` is `#161618`. Do not fight these overrides by adding new hardcoded light-only greens/blues; use token or emerald/amber/red classes that already remap.

**Dark-mode inversion rule:** `bg-zinc-900` / `bg-zinc-950` primary buttons become **light** (`#FAFAFA` on `#141416` text). Keep using `bg-zinc-900` for primary app buttons so this mapping continues to work.

---

## 4. Typography

**Family:** Geist Sans (`next/font/google` → `--font-geist-sans`). Fallback: `ui-sans-serif, system-ui, sans-serif`.  
**Mono:** Geist Mono — landing window chrome labels only (`text-xs font-mono`). Never use mono for app body copy.  
**Smoothing:** `antialiased` on `html` and marketing/auth shells.

### Scale (from `@theme` in `globals.css`)

| Token | Size | Line-height | Tracking | Use |
| --- | --- | --- | --- | --- |
| `text-display` | 36px / 2.25rem | 44px | -0.02em | Not used in-app; landing H1 is larger custom |
| `text-h1` | 28px / 1.75rem | 36px | -0.01em | Page titles (`font-medium`) |
| `text-h2` | 24px / 1.5rem | 32px | -0.01em | Rare; landing metrics |
| `text-h3` | 20px / 1.25rem | 28px | -0.005em | Section titles, greeting |
| `text-h4` | 18px / 1.125rem | 26px | 0 | Sidebar product name |
| `text-body-lg` | 16px / 1rem | 24px | 0 | Page subtitles (`font-medium text-zinc-500`) |
| `text-body` / `text-body-md` | 14px / 0.875rem | 20px | 0 | Nav, table cells, buttons |
| `text-small` | 13px / 0.8125rem | 18px | 0 | Dense UI |
| `text-caption` / `text-label` | 12px / 0.75rem | 16px | 0.01em | Role under name, table headers (headers also +0.02em via `text-table-header`) |
| `text-button` | 14px | 20px | 0 | Button labels |

### Weight rules

- Page H1: `font-medium` (not bold)
- Greeting H3: `font-semibold`; muted prefix `text-zinc-500`, name `text-black` / `dark:text-white`
- KPI numbers: `font-bold` `text-h1` or `text-2xl`
- Table headers: `text-xs font-semibold uppercase tracking-wider text-zinc-500`
- Auth labels: `text-xs font-semibold uppercase tracking-wide text-zinc-500`
- Primary CTA: `font-semibold` (app) or `font-semibold` with ArrowRight (auth/landing)
- Destructive / logout: `font-bold` or `font-medium` + `text-error`

### Landing type (exception)

Hero H1: `text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tight leading-[1.1] text-zinc-950`.  
Hero body: `text-base sm:text-lg text-zinc-600 leading-relaxed`.  
Auth title: `text-3xl sm:text-4xl font-medium tracking-tight`.

---

## 5. Geometry, spacing, elevation

### Radius

`--radius` = `0.625rem` (10px). Derived: sm 6px, md 8px, lg 10px, xl 14px, 2xl 18px, 3xl 22px, 4xl 26px.

**What the product actually uses (follow these, not the unused shadcn card radius):**

| Element | Class | Approx |
| --- | --- | --- |
| App page shell | `rounded-2xl` | 16px |
| Nested chart / list cards | `rounded-2xl` | 16px |
| KPI / stat tiles | `rounded-xl` | 12px |
| Tables | `rounded-xl overflow-hidden` | 12px |
| Inputs, filters, icon buttons, sidebar items | `rounded-lg` | 8px |
| Auth card, auth inputs, auth CTA | `rounded-2xl` / `rounded-xl` | 16 / 12px |
| Landing nav, landing CTA | `rounded-xl` / `rounded-md` | 12 / 6px |
| Status badges | `rounded-full` | pill |
| Avatars (list) | `rounded-full` | circle |
| Navbar avatar | `rounded-md` 32×32 | 6px square-ish |
| Coming Soon chip | `rounded-full` | pill |
| Date chip on dashboard | `rounded-sm` | 2–4px |

### Spacing

- App main: `px-6 pt-[72px] pb-4` (72px clears 60px navbar)
- Page shell padding: `p-6` (dashboard uses `p-4`)
- Vertical stack inside a page: `flex flex-col gap-6`
- KPI / stat grids: `gap-4`
- Two-column content: `gap-6`
- Header actions: `gap-3`
- Sidebar: expanded `w-64`, collapsed `w-[72px]`, header `h-[60px]`, nav `px-3 py-4 space-y-1`

### Shadows

- App chrome: `shadow-2xs` / `shadow-3xs` (hairline) on search, icon buttons, primary table actions
- Popovers: `shadow-lg`
- Auth / landing primary CTA: `shadow-lg shadow-zinc-950/10`
- Landing stacked screenshots: `shadow-xl` / `shadow-2xl` / `shadow-[0_30px_70px_-15px_rgba(0,0,0,0.35)]`
- **Do not** add `shadow-xl` to in-app tables or KPI cards. KPI hover may use `hover:shadow-sm`

---

## 6. Layout principles

### Three shells (never mix)

1. **Marketing** (`/`): full-viewport gradient canvas, **fixed floating pill navbar** (`top-4`, `w-[90%]/max-w-6xl`, `rounded-xl`, `bg-white/80 backdrop-blur-md`). Hero is two-column on `lg`.
2. **Auth** (`/login`, `/sign-up`): same gradient canvas, **no app sidebar**. Centered column `max-w-xl`, logo → title → frosted card → footer link.
3. **App** (`/admin/*`, `/employee/*`): `h-screen w-screen overflow-hidden`. Left sidebar + column with **absolute 60px frosted navbar** + scrollable main. Content is **one full-height bordered page card** (`border border-border rounded-2xl bg-surface`).

### App chrome measurements

- Sidebar expanded 256px, collapsed 72px, `border-r border-border`, `bg-sidebar`
- Navbar `h-[60px]`, `px-6`, `bg-background/80 backdrop-blur-md`, `border-b`, `z-50`, `absolute top-0 left-0 right-0`
- Search field: width 280px, height 40px
- Icon action buttons: 40×40, `rounded-lg`, bordered surface
- Profile chip: height 40px, `pl-1 pr-3`

### Page anatomy (every app route)

```
[H1 medium]                    [optional secondary btn] [primary btn]
[subtitle body-lg zinc-500]
[optional KPI grid]
[filters row]
[table or nested cards]
```

Title left-aligned. Actions top-right, primary on the right. Do not center in-app titles.

### Grids

- Admin dashboard KPIs: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-5`
- Standard stats: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
- Dashboard split: `grid-cols-12` → chart `lg:col-span-6` (or 8/4 on employee)
- Filters: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-5`

---

## 7. Navigation and chrome

### Sidebar ([`components/layout/sidebar.tsx`](components/layout/sidebar.tsx))

- Role is **URL-based**: `/admin` vs `/employee` (until real auth lands)
- **Admin items:** Dashboard, People (Employees, Department, Attendance, Leave), HR (Recruitment, Payroll, Performance), AI Analytics, divider, Notification, Settings
- **Employee items:** Dashboard, My Profile, My Attendance, My Leave, divider, Notification, Settings
- Collapsed: icons only, 72px, collapse chevron rotates 180°
- Top-level item: `px-3 py-2 gap-3`, `rounded-lg`, `text-body font-medium`
- **Active:** `bg-text-primary text-text-inverse` (near-black pill, white icon+label)
- Inactive: `text-text-primary hover:bg-surface-hover`
- Icons: 20×20, inactive `text-icon-secondary`, active `text-text-inverse`
- Nested links: `h-8 pl-[32px]`, active `font-semibold text-text-primary`, inactive `text-text-secondary`
- Branch connector SVG: zinc-200 tracks, `text-text-primary` for the active branch
- People and HR start **expanded**
- Divider: `border-divider my-4`
- Footer: dark-mode label + 36×20 toggle (`h-5 w-9`), then Logout in `text-error` with `hover:bg-error-soft/30`
- Toggle on: `bg-primary`; off: `bg-border-strong`. Thumb `h-4 w-4` white/dark accordingly
- Theme: `localStorage.theme` = `dark` | `light`, class `dark` on `documentElement`

### App navbar

- Left: fake search “Find Something” + ⌘K chip (`text-[10px]`)
- Right: notification 40×40 (unread = `size-1.5` zinc-950 dot with white ring) + profile chip
- Notification popover: 360px, `rounded-2xl`, header + All/Unread pills + 300px scroll list + “View all”
- Unread row: `bg-zinc-50/20`, unread title `font-bold`, tiny zinc-950 dot
- Notification type icons are emoji in a 36px circle (`📅 💼 📊 ⚙️`)
- Profile popover: 240px, name + email + role chip (`text-[10px] font-bold bg-zinc-100`), Settings, then Logout in error color
- Avatar image: `/person.jpg`, 32×32 `object-cover`

### Landing navbar

- Floating, not full-bleed. Sign in = ghost text. Sign up = zinc-950 + ArrowRight, `rounded-md`, `active:scale-95`

---

## 8. Component catalog

### Buttons

**In-app primary (most pages):**  
`px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98`  
Icon 16px, gap-2. Plus / Play / Download sit on the left.

**In-app secondary / outline:**  
`px-3 py-2 border border-border rounded-lg bg-surface hover:bg-surface-hover hover:border-border-strong text-sm font-semibold text-zinc-700 shadow-2xs active:scale-98`

**Auth / landing primary:** full-width or inline `rounded-xl` or `rounded-md`, `bg-zinc-950 text-white dark:bg-white dark:text-zinc-950`, `py-3`, ArrowRight that `translate-x-1` on hover, `active:scale-[0.98]`, `duration-200`

**Destructive / Clock Out:** `bg-red-50 text-red-700 border border-red-200/50 hover:bg-red-100/50`

**Clock In (when clocked out):** same as primary zinc-900

**Icon-only (navbar):** 40×40 bordered surface, `active:scale-95`, focus `ring-2 ring-focus-ring/40`

**Clear filters:** dashed border, `text-xs`, FilterX 14px, `bg-zinc-50/50`

**Do not** use the unused shadcn `primary-hover` blue (`#1D4ED8`) for these CTAs.

### Inputs and filters

- Height 40px (`h-10`)
- `border border-border rounded-lg bg-surface text-sm`
- Focus: `focus:outline-none focus:border-border-strong` (filters) or `focus:ring-2 focus:ring-zinc-950/5` (auth)
- Auth inputs: `px-4 py-2.5 rounded-xl border-zinc-200/80`, hairline `shadow-[0_0_1px_rgba(0,0,0,0.5)]`
- Native `<select>`: `appearance-none` + absolute `ChevronDown` 16px `text-zinc-400` at `right-3 top-3`
- Search in tables: icon left, `pl-9`
- Checkboxes: `size-4 rounded text-zinc-950`

### Status badges

Pill: `px-2 py-0.5` or `px-2.5 py-0.5`, `text-[10px]` or `text-xs`, `font-bold`, `rounded-full`, 1px border.

| Status | Classes (light; dark remaps automatically) |
| --- | --- |
| Active / Approved / On Time / Paid | `bg-emerald-50 text-emerald-700 border-emerald-200/50` |
| Pending / Late / On Leave / Processing | `bg-amber-50 text-amber-700 border-amber-200/50` |
| Rejected / Inactive (destructive) | `bg-red-50 text-red-700 border-red-200/50` |
| Neutral / Inactive / Coming Soon | `bg-zinc-50` or `bg-zinc-100 text-zinc-500 border-zinc-200` |
| Dashboard leave chips (token form) | `bg-success-soft border-success/30 text-success` (and warning/error equivalents) |

### KPI / metric tiles

- Container: `border border-border rounded-xl p-5 bg-surface min-h-[140px]` (employee stats skip the icon tile)
- Icon well: `size-12 rounded-lg`, white glyph, vertical zinc (or semantic) gradient as in §3
- Value: `text-h1 font-bold text-zinc-950 leading-none`
- Delta: `text-sm font-semibold` in `#16A34A` / `#DC2626` / `#1D4ED8` / `#D97706`
- Label: `text-body-lg font-medium text-primary` (dashboard) or `text-sm font-medium text-zinc-500` above the value (employee)

Semantic icon gradients already in product:

- Neutral / total: `#18181B` → `#71717A`
- Success / present / active: `#059669` → `#34D399`
- Warning / leave: `#D97706` → `#FBBF24`
- Inactive: `#71717A` → `#A1A1AA`

### Tables

- Outer: `border border-border rounded-xl overflow-hidden`
- Header row: `bg-zinc-50/80 border-b`, `py-3.5` or `py-4`, `px-6`, uppercase tracking
- Body: `divide-y divide-border`, row `hover:bg-zinc-50/50`
- Employee cell: 32px circular initials (`bg-zinc-100 text-zinc-700 font-bold text-xs`) + name `font-semibold text-zinc-900` + email `text-xs text-zinc-400`
- Row actions: `MoreHorizontal` 16px, menu `rounded-xl border shadow-lg`
- Empty: `py-12 text-center text-sm font-medium text-zinc-400`
- Horizontal scroll on small screens: `overflow-x-auto`

### Charts (Recharts)

- Hide until mounted; placeholder `bg-zinc-50 rounded-xl animate-pulse` at chart height (200–250px)
- Grid: horizontal only, `strokeDasharray="3 3"`, `stroke="var(--divider)"` or `#F4F4F5`
- No axis lines or tick lines
- X ticks: 11–12px, `var(--text-secondary)` or `#A1A1AA`, weight 600 on employee
- Y ticks: `var(--text-disabled)`
- Bar radius `[12,12,0,0]` (dashboard) or `[4,4,0,0]` (employee hours), `maxBarSize` 40–60
- Tooltip: `bg-surface border border-border rounded-md shadow-md px-3 py-1.5 text-xs font-semibold`
- Cursor fill `rgba(0,0,0,0.04)` radius 6
- Pie: zinc grayscale only; legend uses the same hexes as slices

### Empty / coming soon

- Centered column, `py-24`
- 64×64 `rounded-2xl` zinc gradient icon well (same as KPI)
- `text-h3 font-semibold` title
- `text-sm text-zinc-500 font-medium max-w-sm` body
- Pill: `Coming Soon` (`text-xs font-bold bg-zinc-100 text-zinc-500 border`)

Used on Performance and AI Analytics. Reuse this exact block for any unfinished module.

### Toast ([`components/ui/toast.tsx`](components/ui/toast.tsx))

- Fixed `bottom-6 right-6`, `rounded-xl`, `bg-surface/90 backdrop-blur-md shadow-lg`
- Auto-dismiss 3000ms
- Types: success / warning / error / info with matching lucide icon colors
- Message: `text-xs font-bold`

### Avatars

- List/table: `size-8 rounded-full` initials, 2-letter uppercase
- Navbar: 32×32 `rounded-md` photo
- Profile page: `size-20 rounded-full` initials, `text-2xl font-bold`

### Dropdowns / popovers

- `rounded-2xl`, `border-border`, `shadow-lg`, `animate-in fade-in slide-in-from-top-2 duration-150`
- Click-outside to close
- Menu rows: `px-3 py-2 text-xs font-semibold rounded-lg hover:bg-surface-hover`

### Auth field labels

Uppercase, 12px, semibold, wide tracking, left-aligned even though the shell is centered.

### Password field

Eye / EyeOff 16px, `absolute right-3`, `text-zinc-400 hover:text-zinc-600`

---

## 9. Iconography

- **In-product custom icons:** [`components/icons/`](components/icons/) (sidebar, KPI, navbar). Stroke inherits `currentColor`. Default size 20px in nav, 30px in KPI wells, 32px in empty states.
- **Lucide** for functional chrome: Search, Plus, Upload, Download, ChevronDown, MoreHorizontal, FilterX, Clock, Calendar, ArrowRight, CheckCircle, etc. Default 16px (`size-4`) in buttons, 20px in empty headers.
- Do not mix a third icon set (Heroicons, Font Awesome).
- Sidebar custom set is required for Dashboard / People / HR / AI — do not replace with Lucide equivalents.

---

## 10. Motion

| Moment | Spec |
| --- | --- |
| Color / border hover | `transition-all duration-150` or `duration-200` |
| Button press | `active:scale-98` or `active:scale-[0.98]` or `active:scale-95` (icon) |
| Auth ArrowRight | `group-hover:translate-x-1` |
| Sidebar width | `duration-300 ease-in-out` |
| Landing hero copy | Motion `opacity 0→1`, `y 20→0`, 0.6s easeOut |
| Landing screenshots | Motion 0.8s delay 0.2; 3D `perspective:1400px`, rotateY -18°, rotateX 12°; hover eases toward less tilt |
| Popovers | `animate-in fade-in slide-in-from-top-2 duration-150` |
| Toast | `slide-in-from-bottom-4 duration-300` |
| Logout spinner | `animate-spin` on ring, 1.5s then redirect |
| Chart mount | pulse skeleton until `mounted` |

No page-level fade on admin/employee routes.

---

## 11. Copy and voice

- Product speaks like an HR operator: short, concrete, present tense.
- Page titles are nouns or “My …” for employee self-service (`Employees`, `Leave Management`, `My Attendance Logs`).
- Subtitles explain the job in one sentence, `font-medium`, zinc-500. Example: “Manage and view all employees in your organization.”
- Greetings: “Good Morning, William” / “Welcome Back, William” — first name, optional wave emoji on admin only.
- Primary verbs: Add, Import, Export, Approve, Reject, Clock In, Clock Out, Sign in, Get Started.
- Empty: “No … found” or “This section is coming soon.”
- Logout: “Signing Out…” / “Securing your session…”
- Do not use playful slang, exclamation-heavy marketing, or rainbow emoji in app chrome (notification list is the only emoji exception).

---

## 12. Screen-specific patterns

Reuse these layouts instead of inventing new ones.

| Screen | Pattern |
| --- | --- |
| Admin dashboard | 5 KPI tiles + 12-col: bar chart card + leave table card + pie + activity list |
| Employee dashboard | Header + clock CTAs, 4 stats, shift clock band, hours chart, tasks, announcements/holidays |
| Directory (employees, attendance, leave, payroll) | Header + stats + filter bar + table + row menu |
| Employee detail | Back link, identity header, tab strip (Overview / Attendance / Leave / Payroll / …) |
| Recruitment | Kanban columns + table + pie; cards `rounded-xl` with rating stars |
| Notifications | List + category filters + preference toggles |
| Settings | Left mini-nav (security) + form cards |
| Auth | Logo tile, large title, frosted `rounded-2xl` form, footer switch link |
| Logout | Centered `max-w-md` card, spinning logo ring, 40×4px progress bar |
| Coming soon | Centered gradient icon + pill |

---

## 13. Implementation rules (non-negotiable)

1. Wrap every app page in the **page shell**: `w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6`.
2. Keep **zinc / near-black** as the only primary fill. Status color is badges and deltas only.
3. Charts stay **grayscale zinc**. No categorical rainbow.
4. New components go in existing folders: `components/layout`, `components/auth`, `components/ui`, `components/icons`.
5. Use `cn()` from `@/utils/cn` or `@/lib/utils` (both exist; match the file you are editing).
6. Prefer already-used class strings over new abstractions unless you are repeating a block 3+ times.
7. Support **light and dark**. If you must use `zinc-*`, pick classes already remapped in `globals.css`.
8. Do not add a second typeface, a blue primary theme, heavy drop shadows on tables, or a mobile bottom-nav unless the guidelines are updated first.
9. Cursor: `cursor-pointer` on all clickable non-link controls (existing convention).
10. `select-none` on chrome (sidebar, navbar, KPI icon tiles), not on form fields or table text the user may copy.

---

## 14. Token cheat sheet for new UI

```tsx
// Page
<div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
  <div className="flex items-start justify-between">
    <div className="flex flex-col text-left">
      <h1 className="text-h1 font-medium">Title</h1>
      <p className="text-body-lg text-zinc-500 font-medium">One-line subtitle.</p>
    </div>
    <div className="flex items-center gap-3">
      <button className="cursor-pointer flex items-center gap-2 px-3 py-2 border border-border rounded-lg bg-surface hover:bg-surface-hover hover:border-border-strong text-sm font-semibold text-zinc-700 shadow-2xs active:scale-98 transition-all">
        Secondary
      </button>
      <button className="cursor-pointer flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98 transition-all">
        Primary
      </button>
    </div>
  </div>
</div>
```

Canonical files to copy from: [`app/admin/people/employees/page.tsx`](app/admin/people/employees/page.tsx) (directory), [`components/section/dashboard.tsx`](components/section/dashboard.tsx) (KPIs + charts), [`components/layout/sidebar.tsx`](components/layout/sidebar.tsx) (chrome), [`components/auth/auth-shell.tsx`](components/auth/auth-shell.tsx) (marketing/auth).
