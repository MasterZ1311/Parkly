# 🎨 Parkly Brand Identity & Color Palette Specification

Derived directly from the official **Parkly Logo** (`Parkly logo.png`):
- **Letterform & Vehicle Silhouette**: Deep Midnight Navy
- **Location Pin & Interaction Accent**: Vivid Crimson Red
- **Canvas & Surface Accents**: Clean Crisp White & Technical Dark Slate

---

## 1. Core Color Palette Tokens

| Swatch | Token Name | HEX | RGB | Semantic Role |
| :--- | :--- | :--- | :--- | :--- |
| ![#0A1425](https://dummyimage.com/20x20/0A1425/0A1425.png) | **Brand Navy (Core)** | `#0A1425` | `rgb(10, 20, 37)` | Primary background, sidebar body, 'P' mark letterform |
| ![#050B14](https://dummyimage.com/20x20/050B14/050B14.png) | **Brand Navy Dark** | `#050B14` | `rgb(5, 11, 20)` | Deep canvas underlay, modal backdrops |
| ![#111D33](https://dummyimage.com/20x20/111D33/111D33.png) | **Navy Surface** | `#111D33` | `rgb(17, 29, 51)` | Dashboard cards, mobile input fields, navbar |
| ![#162238](https://dummyimage.com/20x20/162238/162238.png) | **Navy Elevated** | `#162238` | `rgb(22, 34, 56)` | Hover states, elevated cards, dropdown menus |
| ![#263957](https://dummyimage.com/20x20/263957/263957.png) | **Navy Border** | `#263957` | `rgb(38, 57, 87)` | Component borders, card outlines, table dividers |
| ![#EF010C](https://dummyimage.com/20x20/EF010C/EF010C.png) | **Brand Red (Accent)** | `#EF010C` | `rgb(239, 1, 12)` | Primary CTA buttons, location pin, active tab indicators |
| ![#DC2626](https://dummyimage.com/20x20/DC2626/DC2626.png) | **Brand Red Hover** | `#DC2626` | `rgb(220, 38, 38)` | Button hover state, active clicks |
| ![#FFFFFF](https://dummyimage.com/20x20/FFFFFF/FFFFFF.png) | **Pure White** | `#FFFFFF` | `rgb(255, 255, 255)` | Logo badge tile, primary button text, car cutout |
| ![#F8FAFC](https://dummyimage.com/20x20/F8FAFC/F8FAFC.png) | **Slate Light** | `#F8FAFC` | `rgb(248, 250, 252)` | Primary heading text, high-contrast labels |
| ![#94A3B8](https://dummyimage.com/20x20/94A3B8/94A3B8.png) | **Slate Muted** | `#94A3B8` | `rgb(148, 163, 184)` | Secondary subtitles, descriptive metadata |
| ![#10B981](https://dummyimage.com/20x20/10B981/10B981.png) | **Status Available** | `#10B981` | `rgb(16, 185, 129)` | Live vacant spots, confirmed bookings, success |
| ![#F59E0B](https://dummyimage.com/20x20/F59E0B/F59E0B.png) | **Status Surge** | `#F59E0B` | `rgb(245, 158, 11)` | Surge dynamic pricing, expiring holds, warnings |

---

## 2. Shared Code Implementations

### A. `@parkly/shared` Package
Defined in `shared/src/theme/palette.ts` and exported in `@parkly/shared`:
```typescript
import { parklyPalette } from '@parkly/shared';

// Access tokens anywhere in backend or frontend:
console.log(parklyPalette.brand.navy); // '#0A1425'
console.log(parklyPalette.brand.red);  // '#EF010C'
```

### B. CSS Variables in Web Portals
Used across Host Dashboard (`apps/host-dashboard/src/index.css`) and Admin Portal (`apps/admin-portal/src/index.css`):
```css
:root {
  --bg-primary: #0A1425;
  --bg-surface: #111D33;
  --bg-elevated: #162238;
  --border: #263957;
  --accent: #EF010C;
  --accent-dark: #DC2626;
  --accent-light: #F87171;
  --text-primary: #F8FAFC;
  --text-secondary: #94A3B8;
  --text-muted: #64748B;
}
```

### C. React Native Mobile Theme
Defined in `apps/mobile/src/constants/theme.ts`:
```typescript
import { colors, theme } from '../constants/theme';
```

---

## 3. Logo Deployment Across the Project

The official logo has been formatted and deployed to:

1. **Host Dashboard (`apps/host-dashboard/`)**:
   - `public/logo.png`: High-resolution official logo
   - `public/favicon.png`: 64x64 icon
   - `public/favicon.svg`: Vector SVG with embedded crisp mark
   - `public/og-image.svg`: 1200x630 social share card featuring the logo badge
   - `src/App.tsx`: Sidebar logo badge `<div className="logo-badge"><img src="/logo.png" .../></div>`

2. **Admin Command Portal (`apps/admin-portal/`)**:
   - `public/logo.png`: High-resolution official logo
   - `public/favicon.png`: 64x64 icon
   - `public/favicon.svg`: Vector SVG with embedded crisp mark
   - `public/og-image.svg`: 1200x630 social share card with command center branding
   - `src/App.tsx`: Sidebar logo badge `<div className="logo-badge"><img src="/logo.png" .../></div>`

3. **Mobile Driver App (`apps/mobile/`)**:
   - `assets/logo.png`: Master high-res image
   - `assets/icon.png`: 1024x1024 App Store / Play Store icon
   - `assets/adaptive-icon.png`: 1024x1024 Android adaptive foreground icon
   - `assets/splash.png`: Centered logo splash screen on clean white canvas
   - `assets/favicon.png`: 48x48 web favicon
   - `app/(auth)/login.tsx`: Auth hero section with logo badge
   - `app/(auth)/otp.tsx`: OTP input with brand palette
   - `app/(tabs)/_layout.tsx`: Tab bar active tint (`#EF010C`) & header styling
   - `app/(tabs)/home.tsx`: Top branding header bar with logo badge & search styling
