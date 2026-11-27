import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

export function ParklyLogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path
        d="M16 48V15H33.5C41.8 15 47.5 19.8 47.5 27.2C47.5 34.6 41.8 39.4 33.5 39.4H24V48H16ZM24 32.2H32.8C36.6 32.2 39.2 30.2 39.2 27.2C39.2 24.2 36.6 22.2 32.8 22.2H24V32.2Z"
        fill="#0B1628"
      />
      <path
        d="M21 54C21 54 12.5 46.8 12.5 40C12.5 35.3 16.3 31.5 21 31.5C25.7 31.5 29.5 35.3 29.5 40C29.5 46.8 21 54 21 54Z"
        fill="#EF010C"
      />
      <circle cx="21" cy="39.8" r="3.4" fill="#FFFFFF" />
    </svg>
  );
}

function SvgIcon({
  size = 18,
  className,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const OverviewIcon = (props: IconProps) => (
  <SvgIcon {...props}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </SvgIcon>
);

export const ParkingIcon = (props: IconProps) => (
  <SvgIcon {...props}>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="M9.5 16.5V7.5H13.5C15.4 7.5 16.8 8.7 16.8 10.5C16.8 12.3 15.4 13.5 13.5 13.5H9.5" />
  </SvgIcon>
);

export const CalendarIcon = (props: IconProps) => (
  <SvgIcon {...props}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M16 3v4M8 3v4M3 10h18" />
  </SvgIcon>
);

export const CurrencyIcon = (props: IconProps) => (
  <SvgIcon {...props}>
    <path d="M6 4h11M6 9h11M9 4c3 0 5 1.8 5 4.5S12 13 9 13H6l7.5 7" />
  </SvgIcon>
);

export const SettingsIcon = (props: IconProps) => (
  <SvgIcon {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </SvgIcon>
);

export const LogoutIcon = (props: IconProps) => (
  <SvgIcon {...props}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </SvgIcon>
);

export const MenuIcon = (props: IconProps) => (
  <SvgIcon {...props}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </SvgIcon>
);

export const CloseIcon = (props: IconProps) => (
  <SvgIcon {...props}>
    <path d="M18 6 6 18M6 6l12 12" />
  </SvgIcon>
);

export const GaugeIcon = (props: IconProps) => (
  <SvgIcon {...props}>
    <path d="M12 14l4-4" />
    <path d="M3.34 19a10 10 0 1 1 17.32 0" />
  </SvgIcon>
);

export const MapPinIcon = (props: IconProps) => (
  <SvgIcon {...props}>
    <path d="M12 21s7-5.6 7-11.5a7 7 0 1 0-14 0C5 15.4 12 21 12 21Z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </SvgIcon>
);

export const ZapIcon = (props: IconProps) => (
  <SvgIcon {...props}>
    <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
  </SvgIcon>
);

export const ShieldCheckIcon = (props: IconProps) => (
  <SvgIcon {...props}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    <path d="m9 12 2 2 4-4" />
  </SvgIcon>
);

export const CheckCircleIcon = (props: IconProps) => (
  <SvgIcon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="m9 12 2 2 4-4" />
  </SvgIcon>
);

export const ClockIcon = (props: IconProps) => (
  <SvgIcon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </SvgIcon>
);

export const XCircleIcon = (props: IconProps) => (
  <SvgIcon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="m15 9-6 6M9 9l6 6" />
  </SvgIcon>
);

export const CarIcon = (props: IconProps) => (
  <SvgIcon {...props}>
    <path d="M5 17h14v-5l-2-5H7l-2 5v5Z" />
    <circle cx="7.5" cy="14" r="1" />
    <circle cx="16.5" cy="14" r="1" />
    <path d="M5 17v2M19 17v2" />
  </SvgIcon>
);

export const PlusIcon = (props: IconProps) => (
  <SvgIcon {...props}>
    <path d="M12 5v14M5 12h14" />
  </SvgIcon>
);

export const CameraIcon = (props: IconProps) => (
  <SvgIcon {...props}>
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
    <circle cx="12" cy="13" r="3.5" />
  </SvgIcon>
);

export const FileCheckIcon = (props: IconProps) => (
  <SvgIcon {...props}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6M9 15l2 2 4-4" />
  </SvgIcon>
);

export const LockIcon = (props: IconProps) => (
  <SvgIcon {...props}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </SvgIcon>
);

export const WrenchIcon = (props: IconProps) => (
  <SvgIcon {...props}>
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z" />
  </SvgIcon>
);

export const WifiOffIcon = (props: IconProps) => (
  <SvgIcon {...props}>
    <path d="M2 2 22 22M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.17-2.69M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M12 20h.01" />
  </SvgIcon>
);

export const AlertTriangleIcon = (props: IconProps) => (
  <SvgIcon {...props}>
    <path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4M12 17h.01" />
  </SvgIcon>
);

export const RefreshIcon = (props: IconProps) => (
  <SvgIcon {...props}>
    <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
    <path d="M21 3v5h-5" />
  </SvgIcon>
);

export const PhoneIcon = (props: IconProps) => (
  <SvgIcon {...props}>
    <rect x="6" y="2" width="12" height="20" rx="2" />
    <path d="M12 18h.01" />
  </SvgIcon>
);

