# Lumina Design System Analysis

> Extracted from 31 SuperDesign HTML prototypes in `designs/`.
> Every value below is the **exact** value found in the source files.

---

## 1. Color Palette

### 1.1 Page Backgrounds

| Token | Value | Tailwind | Used In |
|-------|-------|----------|---------|
| Page background (primary) | `#F1F5F9` | `bg-[#F1F5F9]` | Files 01-31 (all screens) |
| Page background (alternate) | `#F8FAFC` | `bg-[#F8FAFC]` | File 03 (Create Visitor Invite) |
| HTML background | `#F1F5F9` | N/A (set via `html { background-color }`) | Files 02, 28 |

### 1.2 Card / Surface Backgrounds

| Token | Value | Tailwind | Used In |
|-------|-------|----------|---------|
| White card | `#FFFFFF` | `bg-white` | All screens - primary card surface |
| Dark card | `#1E293B` | `bg-[#1E293B]` | Balance cards (02, 17), security panels |
| Dark card gradient from | `slate-900` | `bg-gradient-to-br from-slate-900 to-slate-800` | File 06 (Payment balance) |
| Dark card hover | `#0F172A` | `bg-[#0F172A]` / `hover:bg-[#0F172A]` | Button hover states |
| Muted card | `white/60` | `bg-white/60` | Scheduled/draft cards (28) |
| Slate light card | `#F8FAFC` | `bg-slate-50` | Input backgrounds in modals |

### 1.3 Glass Panel Backgrounds

| Variant | `background` | `backdrop-filter` | `border` | Files |
|---------|-------------|-------------------|----------|-------|
| Standard | `rgba(255, 255, 255, 0.7)` | `blur(20px)` | `1px solid rgba(255, 255, 255, 0.5)` | 01, 02, 03, 04, 05, 06, 08, 12, 14, 15, 18, 19, 20, 21, 22, 29, 30, 31 |
| Enhanced | `rgba(255, 255, 255, 0.75)` | `blur(20px)` | `1px solid rgba(255, 255, 255, 0.5)` | 10, 11, 16, 17, 28 |
| Guard variant | `rgba(255, 255, 255, 0.75)` | `blur(24px)` | `1px solid rgba(255, 255, 255, 0.5)` | 17 |
| Opaque | `rgba(255, 255, 255, 0.8)` | `blur(20px)` | `1px solid rgba(255, 255, 255, 0.5)` | 07, 09 |
| Tab bar | `rgba(255, 255, 255, 0.85)` | `blur(15px)` | `border-top: 1px solid rgba(0, 0, 0, 0.05)` | 06 |

### 1.4 Text Colors

| Token | Tailwind Class | Hex Equivalent | Usage |
|-------|---------------|----------------|-------|
| Heading primary | `text-slate-900` | `#0F172A` | Page titles, card titles, bold text |
| Heading secondary | `text-slate-800` | `#1E293B` | Sub-headings, list item titles |
| Body text | `text-slate-600` | `#475569` | Post content, card body text |
| Body muted | `text-slate-500` | `#64748B` | Subtitles, descriptions, helper text |
| Caption / meta | `text-slate-400` | `#94A3B8` | Timestamps, labels, nav inactive, micro text |
| Disabled text | `text-slate-300` | `#CBD5E1` | Placeholders, chevron arrows, inactive icons |
| On-dark primary | `text-white` | `#FFFFFF` | Text on dark cards/buttons |
| On-dark muted | `text-slate-400` | `#94A3B8` | Labels on dark cards |

### 1.5 Accent / Brand Colors

| Token | Tailwind | Hex | Usage |
|-------|----------|-----|-------|
| Primary blue | `text-blue-600` / `bg-blue-600` | `#2563EB` | Active nav, CTA buttons, links, focus rings |
| Blue hover | `bg-blue-700` / `hover:bg-blue-700` | `#1D4ED8` | Button hover |
| Blue light bg | `bg-blue-50` / `bg-blue-100` | `#EFF6FF` / `#DBEAFE` | Icon circles, badge backgrounds |
| Teal accent | `text-teal-600` / `bg-teal-500` | `#0D9488` / `#14B8A6` | Success states, visitor icons, pool amenity |
| Teal light bg | `bg-teal-50` / `bg-teal-100` | `#F0FDFA` / `#CCFBF1` | Icon backgrounds |
| Gradient start | `from-blue-600` | `#2563EB` | App icon gradient |
| Gradient end | `to-teal-400` | `#2DD4BF` | App icon gradient |

### 1.6 Status Colors

| Status | Text | Background | Border | Usage |
|--------|------|------------|--------|-------|
| Success / Active | `text-green-600` / `text-green-700` | `bg-green-100` / `bg-green-500/10` | - | Active badges, approved states |
| Warning / Pending | `text-amber-600` / `text-amber-500` | `bg-amber-50` / `bg-amber-100` / `bg-amber-500/20` | `border-l-amber-400` | Pending items, scheduled |
| Error / Denied | `text-rose-500` / `text-rose-600` | `bg-rose-50` / `bg-rose-100` / `bg-rose-500/20` | - | Denied badges, urgent alerts, errors |
| Info | `text-blue-600` | `bg-blue-50` / `bg-blue-100` | - | Info badges, category tags |
| Neutral | `text-slate-500` / `text-slate-400` | `bg-slate-100` | - | Inactive states, disabled |
| Delivered | `text-emerald-600` | `bg-emerald-100` | - | Package delivered |
| Stored | `text-blue-600` | `bg-blue-100` | - | Package stored |
| Indigo | `text-indigo-600` / `text-indigo-500` | `bg-indigo-50` / `bg-indigo-100` | - | Alerts icon, credit amounts |
| Orange | `text-orange-600` | `bg-orange-100` | - | BBQ/fire amenity icon |

### 1.7 Border Colors

| Token | Tailwind | Value | Usage |
|-------|----------|-------|-------|
| Card border | `border-slate-100` | `#F1F5F9` | Standard card borders |
| Input border | `border-slate-200` | `#E2E8F0` | Input fields, secondary buttons |
| Divider | `border-slate-200` | `#E2E8F0` | Horizontal rules, separators |
| Nav border | `border-slate-200/60` | `rgba(226, 232, 240, 0.6)` | Bottom nav top border |
| Glass border | `rgba(255, 255, 255, 0.5)` | - | Glass panel borders |
| Dashed | `border-dashed border-slate-300` | `#CBD5E1` | Scheduled/draft card borders |
| Dark card inner | `border-white/10` | `rgba(255, 255, 255, 0.1)` | Buttons on dark backgrounds |
| Amber accent | `border-l-4 border-l-amber-400` | - | Pending transaction left accent |
| Profile ring | `border-2 border-white` | - | Avatar borders, stacked avatars |

### 1.8 Ambient Background Gradient Colors

| Element | Tailwind Classes | Usage |
|---------|-----------------|-------|
| Top gradient | `bg-gradient-to-b from-blue-100/50 via-teal-50/30 to-transparent blur-3xl` | Main ambient wash |
| Right orb | `bg-blue-400/10 rounded-full blur-[80px]` | Right-side ambient orb |
| Left orb | `bg-teal-300/10 rounded-full blur-[90px]` | Left-side ambient orb |
| Dark card orb | `bg-blue-500/10 rounded-full blur-3xl` | Decorative orb inside dark cards |

---

## 2. Typography System

### 2.1 Font Family

```css
font-family: 'Satoshi', sans-serif;
-webkit-font-smoothing: antialiased;
```

**Source:** `https://api.fontshare.com/v2/css?f[]=satoshi@900,700,500,400&display=swap`
**Loaded weights:** 400 (Regular), 500 (Medium), 700 (Bold), 900 (Black)

### 2.2 Type Scale

| Tailwind Class | CSS Value | Font Weight(s) Used | Usage Examples |
|----------------|-----------|---------------------|----------------|
| `text-[10px]` | `10px` | `font-bold` (700), `font-extrabold` (800), `font-black` (900), `font-medium` (500) | Nav labels, timestamps, micro badges, stat labels |
| `text-[11px]` | `11px` | `font-bold` (700) | Quick action labels, "See All" links, sub-labels |
| `text-xs` | `12px` (0.75rem) | `font-bold` (700), `font-medium` (500), `font-semibold` (600) | Section headers, metadata, labels, badge text |
| `text-sm` | `14px` (0.875rem) | `font-bold` (700), `font-medium` (500) | Body text, card titles, descriptions |
| `text-base` | `16px` (1rem) | `font-medium` (500), `font-semibold` (600) | Input text, body paragraphs |
| `text-lg` | `18px` (1.125rem) | `font-bold` (700), `font-semibold` (600) | Button text, section titles, facility names |
| `text-xl` | `20px` (1.25rem) | N/A (icons only) | Page sub-headers (rare), icons |
| `text-2xl` | `24px` (1.5rem) | `font-bold` (700), `font-black` (900) | Page titles, stat numbers, icons |
| `text-3xl` | `30px` (1.875rem) | `font-bold` (700) | Hero titles, balance amounts |
| `text-4xl` | `36px` (2.25rem) | `font-bold` (700) | Large balance amounts (file 06) |
| `text-5xl` | `48px` (3rem) | N/A (icons only) | Guard dashboard stat icon (success check) |

### 2.3 Font Weight Map

| Tailwind Class | CSS `font-weight` | Satoshi Weight | Usage |
|----------------|-------------------|----------------|-------|
| `font-medium` | 500 | Medium | Input text, body, timestamps, helper text |
| `font-semibold` | 600 | (interpolated) | Button text, form labels |
| `font-bold` | 700 | Bold | Titles, headings, badges, nav text, card titles |
| `font-extrabold` | 800 | (interpolated) | Bottom nav labels |
| `font-black` | 900 | Black | Hero stat numbers, dashboard counters |

### 2.4 Letter Spacing

| Tailwind Class | CSS Value | Usage |
|----------------|-----------|-------|
| `tracking-tight` | `-0.025em` | Page titles (h1), large headings |
| `tracking-tighter` | `-0.05em` | Bottom nav labels, compact meta text |
| `tracking-wider` | `0.05em` | Uppercase labels, status badges |
| `tracking-widest` | `0.1em` | Section headers (uppercase), stat labels |
| (default) | `0` | Body text, descriptions |

### 2.5 Text Transform

| Tailwind Class | CSS Value | Usage |
|----------------|-----------|-------|
| `uppercase` | `text-transform: uppercase` | Section headers, labels, badge text, nav labels, stat labels |
| (none) | `text-transform: none` | Body text, titles, descriptions |

### 2.6 Line Height

| Tailwind Class | CSS Value | Usage |
|----------------|-----------|-------|
| `leading-relaxed` | `1.625` | Body text, descriptions, paragraphs |
| (default) | varies by size | Most other text |

### 2.7 Common Typography Combos

```
Page Title:       text-2xl font-bold text-slate-900 tracking-tight
                  text-3xl font-bold text-slate-900 tracking-tight  (auth screens)
Section Header:   text-sm font-bold text-slate-400 uppercase tracking-widest
Card Title:       text-sm font-bold text-slate-800
                  text-base font-bold text-slate-900
Body:             text-sm text-slate-500 leading-relaxed
                  text-sm text-slate-600 leading-relaxed
Micro Label:      text-[10px] font-bold text-slate-400 uppercase tracking-widest
Timestamp:        text-[10px] text-slate-400
Nav Label:        text-[10px] font-extrabold uppercase tracking-tighter
                  text-[10px] font-bold
Input Placeholder: placeholder:text-slate-300 text-base font-medium
Link:             text-blue-600 font-bold
```

---

## 3. Spacing System

### 3.1 Page-Level Spacing

| Property | Tailwind | CSS Value | Usage |
|----------|----------|-----------|-------|
| Safe area top | `pt-14` | `padding-top: 3.5rem (56px)` | Status bar offset (all screens) |
| Page horizontal | `px-6` | `padding: 0 1.5rem (24px)` | All screen content |
| Page horizontal (nav) | `px-8` | `padding: 0 2rem (32px)` | Some bottom navs (file 02) |
| Bottom safe area | `pb-[34px]` | `padding-bottom: 34px` | Bottom nav safe area, auth footers |
| Bottom content padding | `pb-24` / `pb-28` / `pb-[100px]` | `96px / 112px / 100px` | Main content bottom (for nav clearance) |

### 3.2 Section Spacing

| Tailwind | CSS Value | Usage |
|----------|-----------|-------|
| `mb-2` | `8px` | Tight heading-to-subtitle |
| `mb-3` | `12px` | Between badge/meta and content |
| `mb-4` | `16px` | Between sub-sections, between elements |
| `mb-6` | `24px` | Between major sections |
| `mb-8` | `32px` | Between distinct content blocks |
| `mb-10` | `40px` | Large section gaps |
| `mb-12` | `48px` | Extra-large separation |

### 3.3 Internal Component Spacing

| Tailwind | CSS Value | Usage |
|----------|-----------|-------|
| `p-4` | `16px` | Standard card padding, list items |
| `p-5` | `20px` | Enhanced card padding |
| `p-6` | `24px` | Large card padding, balance cards |
| `p-8` | `32px` | Modal padding |
| `px-4` | `16px horizontal` | Input horizontal padding |
| `px-5` | `20px horizontal` | Modal input padding |
| `px-6` | `24px horizontal` | Page horizontal padding |
| `py-2` | `8px vertical` | Small button padding |
| `py-2.5` | `10px vertical` | Medium button padding |
| `py-4` | `16px vertical` | Bottom nav vertical padding |

### 3.4 Gap Values

| Tailwind | CSS Value | Usage |
|----------|-----------|-------|
| `gap-1` | `4px` | Icon-to-label in nav |
| `gap-1.5` | `6px` | Password strength bar segments |
| `gap-2` | `8px` | Button icon gap, small group spacing |
| `gap-3` | `12px` | Card header items, grid gap |
| `gap-4` | `16px` | List item gaps, grid gap, content sections |
| `gap-6` | `24px` | Form section gaps |

### 3.5 List / Stack Spacing

| Tailwind | CSS Value | Usage |
|----------|-----------|-------|
| `space-y-1` | `4px` | Tight stacks (label + input) |
| `space-y-2` | `8px` | Progress bar groups |
| `space-y-3` | `12px` | Activity/notification lists |
| `space-y-4` | `16px` | Card lists, form fields |
| `space-y-6` | `24px` | Major form sections |

---

## 4. Border Radius

### 4.1 All Border Radius Values

| Tailwind Class | CSS Value | Usage |
|----------------|-----------|-------|
| `rounded-lg` | `8px` | Small badges, inner tags |
| `rounded-xl` | `12px` | Buttons (secondary), input selects, icon containers, nav buttons |
| `rounded-2xl` | `16px` | Cards (standard), inputs, primary buttons, glass panels, segmented controls |
| `rounded-3xl` | `24px` | Large facility cards, glass panel containers |
| `rounded-full` | `9999px` | Avatars, pill badges, FAB, status dots, nav icon buttons, progress bars |
| `rounded-[20px]` | `20px` | Transaction cards (file 06), glass stat cards |
| `rounded-[24px]` | `24px` | Enhanced content cards (files 09, 14, 28, 29) |
| `rounded-[28px]` | `28px` | Balance cards, featured cards |
| `rounded-[32px]` | `32px` | Bottom nav top corners, guard stats panel |
| `rounded-[40px]` | `40px` | Bottom sheet modal (file 28) |
| `rounded-t-[32px]` | `32px` (top only) | Bottom navigation bar |
| `rounded-t-[40px]` | `40px` (top only) | Bottom sheet modals |

---

## 5. Shadow System

### 5.1 All Box Shadows

| Tailwind Class | CSS Value | Usage |
|----------------|-----------|-------|
| `shadow-sm` | `0 1px 2px 0 rgb(0 0 0 / 0.05)` | Glass panels, quick action icons, stat cards |
| `shadow-md` | `0 4px 6px -1px rgb(0 0 0 / 0.1)` | App icon, profile avatar |
| `shadow-lg` | `0 10px 15px -3px rgb(0 0 0 / 0.1)` | Buttons, elevated panels |
| `shadow-xl` | `0 20px 25px -5px rgb(0 0 0 / 0.1)` | Primary CTA buttons, large cards |
| `shadow-2xl` | `0 25px 50px -12px rgb(0 0 0 / 0.25)` | Success checkmark (file 30) |

### 5.2 Colored Shadows

| Tailwind Class | Usage |
|----------------|-------|
| `shadow-blue-500/10` | App icon glow |
| `shadow-blue-500/20` | Blue CTA buttons, FAB |
| `shadow-blue-500/30` | Prominent blue buttons, FAB |
| `shadow-slate-900/10` | Dark CTA buttons, balance cards |
| `shadow-teal-500/30` | Success checkmark glow |

### 5.3 Custom Shadows

| CSS Value | Usage |
|-----------|-------|
| `0 -10px 40px rgba(0,0,0,0.05)` | Bottom nav (glass panel variant) |
| `0 -10px 30px rgba(0,0,0,0.03)` | Bottom nav (file 02 variant) |
| `0 2px 10px rgba(0,0,0,0.05)` | Active tab in segmented control |

### 5.4 iOS Input Focus Shadow

```css
box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
```

---

## 6. Glass Morphism System

### 6.1 Primary Glass Panel (most common)

```css
.glass-panel {
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.5);
}
```

**Used in:** 18 of 31 files. Default for stat cards, activity items, list containers, bottom navigation.

### 6.2 Enhanced Glass Panel

```css
.glass-panel {
    background: rgba(255, 255, 255, 0.75);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.5);
}
```

**Used in:** Files 10, 11, 16, 28. Slightly more opaque for better readability.

### 6.3 Guard Dashboard Glass Panel

```css
.glass-panel {
    background: rgba(255, 255, 255, 0.75);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(255, 255, 255, 0.5);
}
```

**Used in:** File 17. Extra blur for the guard dashboard.

### 6.4 Dense Glass Panel

```css
.glass-panel {
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.5);
}
```

**Used in:** Files 07, 09. More opaque for content-heavy screens.

### 6.5 Tab Bar Glass

```css
.tab-bar {
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(15px);
    border-top: 1px solid rgba(0, 0, 0, 0.05);
}
```

**Used in:** File 06. iOS-style tab bar with minimal blur.

### 6.6 Ambient Background (applied to all screens)

```html
<div class="fixed inset-0 overflow-hidden pointer-events-none z-0">
    <div class="absolute -top-[10%] left-[-10%] w-[120%] h-[60%]
         bg-gradient-to-b from-blue-100/50 via-teal-50/30 to-transparent blur-3xl"></div>
    <div class="absolute top-[10%] right-[-20%] w-[300px] h-[300px]
         bg-blue-400/10 rounded-full blur-[80px]"></div>
    <div class="absolute bottom-[20%] left-[-10%] w-[350px] h-[350px]
         bg-teal-300/10 rounded-full blur-[90px]"></div>
</div>
```

Some files omit the bottom orb (e.g., file 27). The pattern is consistent across all 31 files.

---

## 7. Component Patterns

### 7.1 Cards

#### Standard Content Card
```html
<div class="bg-white rounded-[24px] border border-slate-100 p-5 shadow-sm">
    <!-- content -->
</div>
```

#### Glass Stat Card
```html
<div class="glass-panel p-4 rounded-2xl flex items-center gap-3">
    <div class="w-10 h-10 rounded-xl bg-{color}-100 text-{color}-600 flex items-center justify-center">
        <iconify-icon icon="lucide:{icon}" class="text-xl"></iconify-icon>
    </div>
    <div>
        <p class="text-[10px] font-bold text-slate-400 uppercase">Label</p>
        <p class="text-sm font-bold text-slate-800">Value</p>
    </div>
</div>
```

#### Dark Balance Card
```html
<div class="p-6 bg-[#1E293B] rounded-[28px] text-white shadow-xl shadow-slate-900/10 relative overflow-hidden">
    <div class="absolute -right-12 -bottom-12 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl"></div>
    <div class="relative z-10">
        <p class="text-slate-400 text-xs font-medium uppercase tracking-widest mb-1">Label</p>
        <h2 class="text-3xl font-bold">$1,240.00</h2>
    </div>
</div>
```

Alternate dark gradient variant (file 06):
```html
<div class="p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-[28px] text-white shadow-xl shadow-slate-900/10 relative overflow-hidden">
```

#### Transaction Row Card
```html
<div class="flex items-center gap-4 p-4 bg-white rounded-[20px] border border-slate-100 shadow-sm">
    <div class="w-11 h-11 rounded-full bg-{color}-50 text-{color}-500 flex items-center justify-center">
        <iconify-icon icon="lucide:{icon}" class="text-xl"></iconify-icon>
    </div>
    <div class="flex-1">
        <p class="text-sm font-bold text-slate-800">Title</p>
        <p class="text-xs text-slate-400">Subtitle</p>
    </div>
    <p class="text-sm font-bold text-slate-900">$Amount</p>
</div>
```

#### Activity / Notification Card
```html
<div class="glass-panel p-4 rounded-2xl flex items-start gap-4">
    <div class="w-10 h-10 rounded-full bg-{color}-100 text-{color}-600 flex items-center justify-center shrink-0">
        <iconify-icon icon="lucide:{icon}" class="text-lg"></iconify-icon>
    </div>
    <div class="flex-1">
        <div class="flex justify-between items-start">
            <h4 class="text-sm font-bold text-slate-800">Title</h4>
            <span class="text-[10px] text-slate-400">2h ago</span>
        </div>
        <p class="text-xs text-slate-500 mt-1 leading-relaxed">Description text.</p>
    </div>
</div>
```

#### Alert / Warning Banner
```html
<div class="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-4">
    <div class="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center">
        <iconify-icon icon="lucide:shield-alert" class="text-xl"></iconify-icon>
    </div>
    <div>
        <h4 class="text-sm font-bold text-rose-900">Alert Title</h4>
        <p class="text-xs text-rose-600 font-medium">Description.</p>
    </div>
    <iconify-icon icon="lucide:chevron-right" class="ml-auto text-rose-300 text-xl"></iconify-icon>
</div>
```

### 7.2 Buttons

#### Primary Dark Button (h-14)
```html
<button class="w-full h-14 bg-[#1E293B] hover:bg-[#0F172A] active:scale-[0.98] transition-all rounded-2xl text-white font-semibold text-lg shadow-xl shadow-slate-900/10 flex items-center justify-center gap-2">
    <span>Button Text</span>
    <iconify-icon icon="lucide:arrow-right" class="text-xl opacity-80"></iconify-icon>
</button>
```

#### Primary Dark Button (alternate - `bg-slate-900`)
```html
<button class="w-full h-14 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] transition-all rounded-2xl text-white font-semibold text-lg shadow-xl shadow-slate-900/10 flex items-center justify-center gap-2">
```

#### Primary Blue Button (h-14)
```html
<button class="w-full h-14 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition-all rounded-2xl text-white font-semibold text-lg shadow-xl shadow-blue-500/20">
    Button Text
</button>
```

#### Secondary / Ghost Button (h-14)
```html
<button class="flex-1 h-14 bg-slate-100 text-slate-600 rounded-2xl font-bold">
    Cancel
</button>
```

#### Small Action Button (h-12)
```html
<button class="h-12 bg-slate-900 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all">
    <iconify-icon icon="lucide:check-circle" class="text-lg"></iconify-icon>
    Approve
</button>
```

#### Small Secondary Button (h-12)
```html
<button class="h-12 bg-white border border-slate-200 rounded-xl text-slate-600 text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all">
    <iconify-icon icon="lucide:x-circle" class="text-lg"></iconify-icon>
    Reject
</button>
```

#### Small Inline Button (h-10)
```html
<button class="flex-1 h-10 bg-white border border-slate-100 rounded-xl text-xs font-bold text-slate-700 active:scale-95 transition-all">
    Edit
</button>
<button class="flex-1 h-10 bg-slate-900 rounded-xl text-xs font-bold text-white active:scale-95 transition-all">
    Manage
</button>
```

#### Floating Action Button (FAB)
```html
<button class="w-14 h-14 bg-blue-600 rounded-full text-white flex items-center justify-center shadow-xl shadow-blue-500/30 active:scale-90 transition-transform">
    <iconify-icon icon="lucide:plus" class="text-2xl"></iconify-icon>
</button>
```

Smaller FAB variant:
```html
<button class="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-500/20 active:scale-90 transition-transform">
    <iconify-icon icon="lucide:plus" class="text-xl"></iconify-icon>
</button>
```

#### Circular Icon Button (back nav)
```html
<a class="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 shadow-sm hover:bg-slate-50 transition-colors active:scale-95">
    <iconify-icon icon="lucide:chevron-left" class="text-xl"></iconify-icon>
</a>
```

Alternate (no border):
```html
<a class="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-900 shadow-sm">
    <iconify-icon icon="lucide:chevron-left" class="text-xl"></iconify-icon>
</a>
```

#### Pill Filter Buttons
```html
<!-- Active -->
<button class="px-4 py-2 bg-slate-900 text-white rounded-full text-xs font-bold">All</button>
<!-- Inactive -->
<button class="px-4 py-2 bg-white text-slate-500 border border-slate-200 rounded-full text-xs font-bold hover:bg-slate-50">Category</button>
```

### 7.3 Inputs

#### Standard Text Input
```html
<div class="space-y-1">
    <label class="text-xs font-semibold text-slate-500 ml-1 uppercase tracking-wider">Label</label>
    <div class="ios-input group flex items-center bg-white rounded-2xl border border-slate-200 px-4 h-14 transition-all duration-300">
        <iconify-icon icon="lucide:{icon}" class="text-slate-400 text-xl mr-3 group-focus-within:text-blue-500 transition-colors"></iconify-icon>
        <input type="text" placeholder="Placeholder" class="flex-1 bg-transparent border-none outline-none text-slate-900 placeholder:text-slate-300 text-base font-medium h-full">
    </div>
</div>
```

#### Password Input (with toggle)
```html
<div class="ios-input group flex items-center bg-white rounded-2xl border border-slate-200 px-4 h-14">
    <iconify-icon icon="lucide:lock" class="text-slate-400 text-xl mr-3"></iconify-icon>
    <input type="password" placeholder="Min. 8 characters" class="flex-1 bg-transparent border-none outline-none text-slate-900 font-medium">
    <button class="text-slate-300">
        <iconify-icon icon="lucide:eye" class="text-lg"></iconify-icon>
    </button>
</div>
```

#### iOS Input Focus CSS
```css
.ios-input:focus-within {
    border-color: #2563EB;
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
    transform: translateY(-1px);
}
```

#### OTP Code Input
```html
<input type="text" maxlength="1"
    class="code-input w-16 h-16 bg-white border border-slate-200 rounded-2xl text-center text-2xl font-bold text-slate-900 outline-none transition-all">
```

```css
.code-input:focus {
    border-color: #2563EB;
    background: #EFF6FF;
}
```

#### Select Input
```html
<select class="w-full h-12 bg-slate-50 rounded-xl px-4 border border-slate-100 outline-none font-bold text-sm">
    <option>Option 1</option>
</select>
```

#### Textarea
```html
<textarea placeholder="Write your message..." rows="4"
    class="w-full bg-slate-50 rounded-2xl p-5 border border-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20 font-medium resize-none">
</textarea>
```

#### Modal Input (full-width)
```html
<input type="text" placeholder="Title" class="w-full h-14 bg-slate-50 rounded-2xl px-5 border border-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20 font-medium">
```

### 7.4 Badges / Tags

#### Category Badge (light)
```html
<div class="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold">Events</div>
```

#### Status Badge (pill)
```html
<span class="px-2.5 py-1 bg-rose-50 text-rose-600 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
    <iconify-icon icon="lucide:alert-triangle"></iconify-icon>
    Urgent
</span>
```

#### Status Badge (small rect)
```html
<span class="text-[10px] px-2 py-1 bg-green-100 text-green-700 rounded-lg font-bold">PAID</span>
```

#### On-Dark Badge
```html
<span class="px-2.5 py-1 bg-amber-500/20 text-amber-400 text-[10px] font-bold rounded-lg border border-amber-500/30 backdrop-blur-sm">
    DUE IN 3 DAYS
</span>
```

#### Active Status Indicator
```html
<span class="px-3 py-1 bg-green-500/10 text-green-600 rounded-full text-[10px] font-bold tracking-wider uppercase flex items-center gap-1">
    <span class="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> Active
</span>
```

#### Status Dot
```html
<div class="w-2 h-2 rounded-full bg-green-500"></div>  <!-- Open -->
<div class="w-2 h-2 rounded-full bg-amber-500"></div>  <!-- Maintenance -->
```

### 7.5 Segmented Controls / Tab Bars

#### Segmented Control (in-page)
```html
<div class="flex p-1 bg-slate-200/50 backdrop-blur-md rounded-2xl mb-6">
    <button class="flex-1 h-10 bg-white rounded-xl shadow-sm text-xs font-bold text-slate-900">Active</button>
    <button class="flex-1 h-10 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors">Inactive</button>
</div>
```

Alternate variant (smaller):
```html
<div class="bg-slate-200/50 p-1 rounded-xl flex mb-6">
    <button class="flex-1 py-1.5 text-xs font-bold text-slate-900 ios-tab-active rounded-lg transition-all">Active</button>
    <button class="flex-1 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 rounded-lg transition-all">Other</button>
</div>
```

iOS Tab Active CSS:
```css
.ios-tab-active {
    background: white;
    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
}
```

### 7.6 Icon Circles

| Size | Classes | Usage |
|------|---------|-------|
| Large | `w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-teal-400` | App branding icon (auth) |
| Medium | `w-12 h-12 rounded-2xl bg-{color}-100 text-{color}-600` | Facility card icons (file 27) |
| Standard | `w-10 h-10 rounded-full bg-{color}-100 text-{color}-600` | Activity items, notification icons |
| Standard square | `w-10 h-10 rounded-xl bg-{color}-100 text-{color}-600` | Dashboard stat icons, quick action grid |
| Small | `w-8 h-8 rounded-full bg-{color}-50 text-{color}-600` | Inline option icons (file 31) |
| Action grid | `w-14 h-14 rounded-2xl bg-white shadow-sm border border-slate-100 text-{color}-600` | Quick action grid (file 02) |

### 7.7 Headers

#### Resident Dashboard Header
```html
<header class="relative z-20 shrink-0 pt-14 px-6 flex justify-between items-center">
    <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-gradient-to-tr from-blue-600 to-teal-400 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/10">
            <iconify-icon icon="lucide:building-2" class="text-white text-xl"></iconify-icon>
        </div>
        <div>
            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Community Name</p>
            <p class="text-sm font-bold text-slate-800">Unit 402B</p>
        </div>
    </div>
    <a class="w-10 h-10 rounded-full border-2 border-white shadow-sm overflow-hidden">
        <img src="..." alt="Profile" class="w-full h-full object-cover">
    </a>
</header>
```

#### Section Page Header (with back button)
```html
<header class="px-6 flex items-center justify-between mb-8">
    <a class="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 shadow-sm active:scale-90 transition-transform">
        <iconify-icon icon="lucide:chevron-left" class="text-xl"></iconify-icon>
    </a>
    <h1 class="text-xl font-bold text-slate-900 tracking-tight">Page Title</h1>
    <div class="w-10"></div> <!-- spacer -->
</header>
```

#### Admin Page Header (title + action)
```html
<div class="flex justify-between items-center mb-6">
    <div>
        <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Page Title</h1>
        <p class="text-slate-500 text-sm">Subtitle description</p>
    </div>
    <button class="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-500/20 active:scale-90 transition-transform">
        <iconify-icon icon="lucide:plus" class="text-xl"></iconify-icon>
    </button>
</div>
```

### 7.8 Bottom Navigation

#### Glass Panel Variant (most common - Admin/Guard/Community screens)
```html
<div class="fixed bottom-0 left-0 right-0 glass-panel border-t border-slate-200/60 px-6 py-4 flex justify-between items-center z-50 rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.05)]"
     style="view-transition-name: main-nav;">
    <a class="flex flex-col items-center gap-1 text-blue-600"> <!-- active -->
        <iconify-icon icon="lucide:home" class="text-2xl"></iconify-icon>
        <span class="text-[10px] font-extrabold uppercase tracking-tighter">Home</span>
    </a>
    <a class="flex flex-col items-center gap-1 text-slate-400 hover:text-blue-500 transition-colors"> <!-- inactive -->
        <iconify-icon icon="lucide:users" class="text-2xl"></iconify-icon>
        <span class="text-[10px] font-extrabold uppercase tracking-tighter">Users</span>
    </a>
</div>
```

#### Resident Dashboard Variant (file 02)
```html
<footer class="fixed bottom-0 left-0 right-0 z-50 glass-panel border-t-0 shadow-[0_-10px_30px_rgba(0,0,0,0.03)] px-8 pb-[34px] pt-4"
        style="view-transition-name: bottom-nav">
    <div class="flex justify-between items-center">
        <a class="flex flex-col items-center gap-1 text-blue-600">
            <iconify-icon icon="lucide:home" class="text-2xl"></iconify-icon>
            <span class="text-[10px] font-bold">Home</span>
        </a>
        <a class="flex flex-col items-center gap-1 text-slate-400">
            <iconify-icon icon="lucide:users" class="text-2xl"></iconify-icon>
            <span class="text-[10px] font-bold">Visitors</span>
        </a>
    </div>
</footer>
```

#### Tab Bar Variant (file 06)
```html
<nav class="tab-bar fixed bottom-0 left-0 right-0 h-[84px] pb-[34px] px-6 flex justify-between items-center z-50"
     style="view-transition-name: bottom-nav">
```

### 7.9 Progress Bars

#### Linear Progress
```html
<div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
    <div class="w-[92%] h-full bg-blue-600 rounded-full"></div>
</div>
```

#### Password Strength Indicator
```html
<div class="flex gap-1.5 mt-3 px-1">
    <div class="h-1.5 flex-1 rounded-full bg-blue-500"></div>  <!-- filled -->
    <div class="h-1.5 flex-1 rounded-full bg-blue-500"></div>  <!-- filled -->
    <div class="h-1.5 flex-1 rounded-full bg-blue-500"></div>  <!-- filled -->
    <div class="h-1.5 flex-1 rounded-full bg-slate-200"></div> <!-- unfilled -->
</div>
```

### 7.10 Dividers / Separators

#### Text Divider
```html
<div class="relative py-4">
    <div class="absolute inset-0 flex items-center">
        <div class="w-full border-t border-slate-200"></div>
    </div>
    <div class="relative flex justify-center">
        <span class="bg-[#F1F5F9] px-4 text-xs text-slate-400 font-bold uppercase tracking-widest">Or</span>
    </div>
</div>
```

### 7.11 Bottom Sheet Modal

```html
<div class="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-sm">
    <div class="w-full bg-white rounded-t-[40px] p-8 animate-slide-up">
        <div class="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-8"></div>
        <!-- content -->
        <div class="flex gap-4 pb-[34px]">
            <button class="flex-1 h-14 bg-slate-100 text-slate-600 rounded-2xl font-bold">Cancel</button>
            <button class="flex-[2] h-14 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/20">Confirm</button>
        </div>
    </div>
</div>
```

```css
@keyframes slide-up {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
}
.animate-slide-up {
    animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
```

### 7.12 Stacked Avatars

```html
<div class="flex -space-x-2">
    <img src="..." class="w-6 h-6 rounded-full border-2 border-white">
    <img src="..." class="w-6 h-6 rounded-full border-2 border-white">
    <img src="..." class="w-6 h-6 rounded-full border-2 border-white">
    <div class="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[8px] font-bold text-slate-500">+142</div>
</div>
```

---

## 8. Screen-by-Screen Layout Summary

### File 01: `01-lumina-community-auth-flow.html`
**Screen:** Auth flow - Login, Register, Onboarding, Dashboard Hub (multi-step SPA)
**Structure:**
- Full-screen with ambient background
- Step-based views toggled with JS (login -> register -> onboarding -> hub)
- Login: Logo icon + title + email/password inputs + dark CTA + divider + "Sign Up" link
- Register: Name/email/phone/password inputs + blue CTA
- Onboarding: Community code input with pill-code fields
- Dashboard Hub: Role-selection cards (Resident / Guard / Admin)
**Key Patterns:** `ios-input`, step transitions with `goToStep()`, `glass-panel` role cards, gradient app icon

### File 02: `02-lumina-resident-dashboard.html`
**Screen:** Resident Dashboard (home)
**Structure:**
- Persistent header: community icon + name/unit + profile avatar
- Greeting: `text-2xl font-bold`
- Dark balance card (`bg-[#1E293B] rounded-[28px]`)
- 2-column stat grid (glass-panel cards)
- Quick actions grid (4 columns, icon + label)
- Recent activity list (glass-panel notification cards)
- Persistent bottom nav (5 tabs: Home, Visitors, Social, Booking, Profile)
**Key Patterns:** `view-transition-name` on header, nav, content; dark balance card with blur orb

### File 03: `03-lumina-create-visitor-invite.html`
**Screen:** Create Visitor Invitation form
**Structure:**
- Back button header
- Title + subtitle
- Form: visitor name, phone, date picker, visit type selector, notes textarea
- Full-width blue CTA button
**Key Patterns:** `ios-input` fields, `bg-[#F8FAFC]` page background (unique)

### File 04: `04-active-invitations.html`
**Screen:** Active Visitor Invitations list
**Structure:**
- Header with back button + title
- Filter pills row (All, Today, Upcoming)
- Invitation cards with: avatar + name/unit + status badge + QR icon button
- Empty state messaging area
**Key Patterns:** Pill filter active/inactive states, invitation card pattern

### File 05: `05-lumina-resident-visitor-history.html`
**Screen:** Visitor History log
**Structure:**
- Header with title
- Search input
- Date group headers
- History row items: avatar + name + time + status (Checked In / Checked Out / Denied)
**Key Patterns:** Date-grouped list, status badges with color coding

### File 06: `06-payment-dashboard-lumina.html`
**Screen:** Payment / Billing Dashboard
**Structure:**
- Header: title + profile widget
- Dark gradient balance card (`from-slate-900 to-slate-800 rounded-[28px]`)
- Pay Now + upload proof buttons inside card
- Quick actions section (upload receipt row)
- Transaction history: pending receipt (with progress bar), history rows
- Tab bar bottom nav (`.tab-bar` variant)
**Key Patterns:** `tab-bar` CSS class, `border-l-4 border-l-amber-400` accent, transaction row cards

### File 07: `07-maintenance-tickets.html`
**Screen:** Maintenance Tickets list
**Structure:**
- Header with title + FAB (create)
- Segmented control (Active / Resolved / All)
- Ticket cards: priority badge + title + description + meta (unit, timestamp) + status
- Priority colors: High (rose), Medium (amber), Low (blue)
**Key Patterns:** Glass panel 0.8 opacity, segmented control, priority color system

### File 08: `08-lumina-announcements-feed.html`
**Screen:** Resident Announcements feed
**Structure:**
- Header with community name
- Urgent announcement banner (rose themed)
- Announcement cards: category badge + title + body + timestamp + read indicator
- Stacked avatar "acknowledged by" row
**Key Patterns:** Urgency badge system, stacked avatars, read-receipt progress bar

### File 09: `09-lumina-community-social-feed.html`
**Screen:** Community Social Feed
**Structure:**
- Header with title + create post FAB
- Post cards: author avatar + name/unit + timestamp + body text + optional image + reaction bar + comment count
- Reaction bar: like/comment/share icons with counts
**Key Patterns:** Post card pattern, reaction bar, `glass-panel` 0.8 opacity

### File 10: `10-amenities-explorer.html`
**Screen:** Amenities Explorer (resident view)
**Structure:**
- Header with title
- Category filter pills (All, Pools, Gym, Courts, etc.)
- Amenity cards: hero image + name + availability status + book button
- Glass panel enhanced variant (0.75)
**Key Patterns:** Category filter pills, image-topped cards, availability status indicators

### File 11: `11-lumina-user-profile-settings.html`
**Screen:** User Profile & Settings
**Structure:**
- Profile header: large avatar + name + unit + edit button
- Settings sections: Account, Preferences, Security, About
- Setting rows: icon circle + label + chevron-right / toggle switch
- Logout button (rose text)
**Key Patterns:** Settings row pattern, toggle switches, destructive action styling

### File 12: `12-lumina-vehicle-management.html`
**Screen:** Vehicle Management
**Structure:**
- Header with back button + title + add vehicle FAB
- Vehicle cards: icon + make/model + plate number + status badge
- Card actions: edit / delete buttons
**Key Patterns:** Vehicle card pattern, `ios-input` for add vehicle form

### File 13: `13-lumina-documents-signatures.html`
**Screen:** Documents & Signatures
**Structure:**
- Header with title
- Segmented control (Documents / Signatures)
- Document cards: file type icon + name + date + download/view actions
- Signature request cards with sign CTA
**Key Patterns:** Document card pattern, signature modal overlay

### File 14: `14-lumina-community-marketplace.html`
**Screen:** Community Marketplace
**Structure:**
- Header with title + create listing FAB
- Category filter pills
- Listing cards: image + title + price + seller avatar/name + condition badge
- Grid layout (2 columns for listing thumbnails in some variants)
**Key Patterns:** Marketplace card with price badge, seller info row

### File 15: `15-package-delivery-lumina.html`
**Screen:** Package Delivery tracking
**Structure:**
- Header with title
- Package status summary cards (Awaiting, Stored, Collected)
- Package list items: carrier icon + tracking info + status badge + timestamp
- Status: Awaiting (`bg-amber-100`), Stored (`bg-blue-100`), Delivered (`bg-emerald-100`)
**Key Patterns:** Package card pattern, triple-status summary grid

### File 16: `16-notifications-center.html`
**Screen:** Notifications Center
**Structure:**
- Header with title + mark-all-read button
- Date group headers (Today, Yesterday, Earlier)
- Notification items: icon circle + title + body + timestamp + unread dot
- Unread indicator: small blue dot
**Key Patterns:** Notification list pattern, date grouping, unread dot (`w-2 h-2 bg-blue-500 rounded-full`)

### File 17: `17-lumina-guard-dashboard.html`
**Screen:** Guard Dashboard
**Structure:**
- Header: gate name + shift status badge (Active with pulse dot) + shift end time
- Glass stats panel (`rounded-[32px]`): visitor count, checked-in, pending
- Large QR scan button (dark, full-width, `rounded-[24px]`)
- Quick action grid: Manual Entry, Visitor Queue, Access Logs, Alerts
- Recent activity list
- Persistent bottom nav (guard variant: Dashboard, Scan, Queue, Alerts, Patrol)
**Key Patterns:** Guard-specific glass panel (blur 24px), large scan CTA, shift status with pulse, `text-5xl` stat numbers

### File 18: `18-lumina-qr-scan-result.html`
**Screen:** QR Scan Result
**Structure:**
- Full-screen result overlay
- Status icon (large, centered: check for approved, X for denied)
- Visitor details: name, host, unit, visit type, timestamp
- Action buttons: Allow Entry / Deny / Flag
**Key Patterns:** Full-screen result overlay, large centered status icon

### File 19: `19-manual-visitor-entry.html`
**Screen:** Manual Visitor Entry form (guard)
**Structure:**
- Back button header
- Form: visitor name, ID number, host unit (searchable), visit purpose, vehicle plate
- Photo capture placeholder
- Submit button (dark CTA)
**Key Patterns:** `ios-input` form fields, guard-specific form layout

### File 20: `20-lumina-visitor-queue.html`
**Screen:** Visitor Queue management
**Structure:**
- Header with title + count badge
- Queue cards: visitor avatar + name + host/unit + arrival time + status
- Action buttons per card: Check In / Reject
- Priority indicator for pre-registered visitors
**Key Patterns:** Queue card with dual action buttons, priority highlight

### File 21: `21-access-control-logs.html`
**Screen:** Access Control Logs
**Structure:**
- Header with title + filter button
- Date picker / range selector
- Log entries: timestamp + visitor name + action (Entry/Exit) + gate + verified-by
- Color coding: Entry (green), Exit (blue), Denied (rose)
**Key Patterns:** Log entry row pattern, date-filtered list

### File 22: `22-lumina-guard-alerts.html`
**Screen:** Guard Alerts / Security Feed
**Structure:**
- Header with title
- Alert cards: severity icon + title + description + timestamp + action buttons
- Severity levels: Critical (rose), Warning (amber), Info (blue)
- Alert actions: Acknowledge, Escalate, Dismiss
**Key Patterns:** Alert severity color system, multi-action card

### File 23: `23-lumina-admin-settings.html`
**Screen:** Admin Settings
**Structure:**
- Header with title
- Settings sections: Community Settings, Security, Billing Config, Integrations
- Setting rows: icon + label + value/status + chevron
- Toggle rows for boolean settings
**Key Patterns:** Admin settings group pattern, toggle switch rows

### File 24: `24-lumina-resident-management.html`
**Screen:** Resident Management (admin)
**Structure:**
- Header with title + invite FAB
- Search bar
- Resident list cards: avatar + name + unit + status badge + chevron
- Status: Active (green), Pending (amber), Inactive (slate)
**Key Patterns:** Admin list card pattern, search + list layout

### File 25: `25-lumina-payment-approval.html`
**Screen:** Payment Approval (admin)
**Structure:**
- Header with title
- Summary stat cards (Pending, Approved Today, Total MTD)
- Payment proof cards: resident info + amount + uploaded proof thumbnail + approve/reject buttons
- Receipt image preview area
**Key Patterns:** Admin approval card with dual actions, summary stats grid

### File 26: `26-maintenance-dashboard-lumina-admin.html`
**Screen:** Maintenance Dashboard (admin)
**Structure:**
- Header with title + create FAB
- Summary stats: Open, In Progress, Resolved, Avg Response Time
- Ticket list with priority indicators
- Assignment section: assign to staff member
**Key Patterns:** Admin dashboard stat cards, ticket management list

### File 27: `27-amenity-management-lumina.html`
**Screen:** Amenity Management (admin)
**Structure:**
- Header: title + subtitle + add FAB
- 2-column stats grid (Booked Today, Revenue)
- Segmented control (Facilities / Bookings / Policies)
- Facility cards: icon circle (w-12) + name + capacity/hours + status dot + pricing + Edit/Manage buttons
- Upcoming events list in glass container
**Key Patterns:** Admin facility card with dual buttons, status dot indicator, glass event list

### File 28: `28-lumina-announcements-manager.html`
**Screen:** Announcements Manager (admin)
**Structure:**
- Header: title + subtitle + create FAB (opens modal)
- Segmented control (Active / Scheduled / Archive)
- Announcement cards: urgency badge + title + body + read-receipt progress bar + acknowledged avatars
- Scheduled card variant: dashed border, muted text
- Bottom sheet create modal: title input + textarea + urgency/audience selectors + cancel/post buttons
**Key Patterns:** Scheduled card (dashed border, `bg-white/60`), bottom sheet modal with slide-up animation

### File 29: `29-lumina-social-moderation.html`
**Screen:** Social Moderation (admin)
**Structure:**
- Centered header with back button + title
- Segmented tabs (Pending / Reports / Guidelines)
- Summary stat cards (Pending count, Flagged count)
- Moderation cards: author avatar + name/unit + category badge + post content + optional image + approve/reject buttons
- Flagged reports alert banner (rose themed)
**Key Patterns:** Moderation card with dual action buttons, report alert banner

### File 30: `30-password-recovery-lumina.html`
**Screen:** Password Recovery (multi-step)
**Structure:**
- Step 1 - Identification: header + email input + "Send Code" button
- Step 2 - Verification: shield icon + 4-digit code inputs + "Verify Code" button + resend link
- Step 3 - New Password: password input + strength indicator + confirm password + "Reset Password" button
- Step 4 - Success: large teal checkmark + success message + "Back to Sign In" button
- JS step transitions with slide animations
- Help footer (hidden on success)
**Key Patterns:** Multi-step form, OTP code inputs with auto-advance, password strength bar, success state

### File 31: `31-lumina-forgot-password.html`
**Screen:** Forgot Password (simpler variant)
**Structure:**
- Back button
- Key icon (gradient, `rounded-2xl`)
- Title "Reset Password" + description
- Email input
- "Send Recovery Link" dark CTA button
- Divider ("Other Methods")
- Alternative recovery options: OTP via Phone, Security Questions (list items with icon + label + chevron)
- Footer: "Contact Support" link
**Key Patterns:** Single-step recovery form, alternative method cards, gradient icon

---

## 9. Animation & Transition System

### 9.1 View Transitions (CSS)

```css
@view-transition { navigation: auto; }

::view-transition-old(main-content) {
    animation: 0.25s ease-out both fade-out;
}
::view-transition-new(main-content) {
    animation: 0.25s ease-in 0.1s both fade-in;
}

@keyframes fade-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
```

### 9.2 Persistent Element Transitions

```css
::view-transition-old(main-nav),
::view-transition-new(main-nav),
::view-transition-old(bg-ambiance),
::view-transition-new(bg-ambiance),
::view-transition-old(app-header),
::view-transition-new(app-header) {
    animation: none;
    mix-blend-mode: normal;
}
```

### 9.3 Step Transitions (file 30)

```css
.step-view {
    transition: all 400ms cubic-bezier(0.16, 1, 0.3, 1);
}
```

### 9.4 Component Transitions

| Class | CSS | Usage |
|-------|-----|-------|
| `active:scale-[0.98]` | `transform: scale(0.98)` on press | Primary buttons, large cards |
| `active:scale-95` | `transform: scale(0.95)` on press | Small buttons, action buttons |
| `active:scale-90` | `transform: scale(0.90)` on press | FABs, back buttons |
| `transition-all` | `all 150ms ease` | General transitions |
| `transition-colors` | `color/background 150ms ease` | Hover color changes |
| `transition-transform` | `transform 150ms ease` | Scale animations |
| `duration-300` | `300ms` | Input focus transitions |
| `animate-pulse` | Tailwind pulse keyframes | Active status dot |

### 9.5 Spring Easing Curve

Used throughout for premium feel:
```
cubic-bezier(0.16, 1, 0.3, 1)
```

---

## 10. Icon System

**Library:** Iconify with Lucide icon set
**CDN:** `https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js`

### Common Icons by Category

| Category | Icons |
|----------|-------|
| Navigation | `lucide:chevron-left`, `lucide:chevron-right`, `lucide:arrow-right`, `lucide:arrow-left` |
| Auth | `lucide:mail`, `lucide:lock`, `lucide:eye`, `lucide:eye-off`, `lucide:key-round`, `lucide:shield-check` |
| Home | `lucide:home`, `lucide:building-2`, `lucide:layout-dashboard`, `lucide:layout-grid` |
| Users | `lucide:users`, `lucide:user`, `lucide:user-plus` |
| Visitors | `lucide:log-in`, `lucide:scan-line`, `lucide:qr-code` |
| Payments | `lucide:credit-card`, `lucide:receipt`, `lucide:upload-cloud` |
| Social | `lucide:message-square`, `lucide:message-circle`, `lucide:megaphone` |
| Maintenance | `lucide:wrench`, `lucide:settings` |
| Amenities | `lucide:calendar-check`, `lucide:dumbbell`, `lucide:waves`, `lucide:flame` |
| Status | `lucide:check-circle`, `lucide:x-circle`, `lucide:alert-triangle`, `lucide:alert-circle`, `lucide:shield-alert` |
| Actions | `lucide:plus`, `lucide:send`, `lucide:file-text`, `lucide:sparkles` |
| Misc | `lucide:bell`, `lucide:clock`, `lucide:smartphone`, `lucide:shield-question`, `lucide:percent` |

Icon sizes follow the text size scale: `text-lg` (18px), `text-xl` (20px), `text-2xl` (24px), `text-5xl` (48px).

---

## Summary of Critical Design Tokens

```
Font:             Satoshi (400, 500, 700, 900)
Page BG:          #F1F5F9
Glass:            rgba(255,255,255,0.7) + blur(20px)
Primary CTA:      bg-[#1E293B] or bg-slate-900, h-14, rounded-2xl
Blue CTA:         bg-blue-600, h-14, rounded-2xl
Dark Card:        bg-[#1E293B], rounded-[28px]
Standard Card:    bg-white, rounded-[24px], border-slate-100, p-5, shadow-sm
Stat Card:        glass-panel, rounded-2xl, p-4
Input:            bg-white, rounded-2xl, border-slate-200, h-14, px-4
Bottom Nav:       glass-panel, rounded-t-[32px], px-6, py-4
Active Nav:       text-blue-600
Inactive Nav:     text-slate-400
Focus Ring:       border-color: #2563EB + 0 0 0 4px rgba(37,99,235,0.1)
Press Feedback:   active:scale-[0.98]
Easing:           cubic-bezier(0.16, 1, 0.3, 1)
Icon Set:         Lucide via Iconify
```
