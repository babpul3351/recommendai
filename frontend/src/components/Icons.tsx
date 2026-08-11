import React from 'react';

interface IconProps { color?: string; size?: number; }

// ── Nav icons ───────────────────────────────────────────────────────────────

export function HomeIcon({ color = '#555', size = 22 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
            <path d="M3.75 13.125L15 3.75L26.25 13.125V25C26.25 25.6904 25.6904 26.25 25 26.25H20C19.3096 26.25 18.75 25.6904 18.75 25V18.75H11.25V25C11.25 25.6904 10.6904 26.25 10 26.25H5C4.30964 26.25 3.75 25.6904 3.75 25V13.125Z"
                stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function WardrobeIcon({ color = '#555', size = 22 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
            <path d="M12.5 3.75H5C4.30964 3.75 3.75 4.30964 3.75 5V25C3.75 25.6904 4.30964 26.25 5 26.25H25C25.6904 26.25 26.25 25.6904 26.25 25V5C26.25 4.30964 25.6904 3.75 25 3.75H17.5M12.5 3.75V12.5L15 10L17.5 12.5V3.75M12.5 3.75H17.5"
                stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function CalendarIcon({ color = '#555', size = 22 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
            <path d="M3.75 11.25H26.25M10 3.75V7.5M20 3.75V7.5M5 5.625H25C25.6904 5.625 26.25 6.18464 26.25 6.875V25C26.25 25.6904 25.6904 26.25 25 26.25H5C4.30964 26.25 3.75 25.6904 3.75 25V6.875C3.75 6.18464 4.30964 5.625 5 5.625Z"
                stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function SparkleIcon({ color = '#555', size = 22 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
            <path d="M15 3.75L17.5 11.25L25 13.75L17.5 16.25L15 23.75L12.5 16.25L5 13.75L12.5 11.25L15 3.75Z"
                stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="22.5" cy="22.5" r="2" stroke={color} strokeWidth="2" />
            <circle cx="7.5" cy="22.5" r="1.5" stroke={color} strokeWidth="1.8" />
        </svg>
    );
}

export function UserIcon({ color = '#555', size = 22 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
            <circle cx="15" cy="10" r="5" stroke={color} strokeWidth="2.5" />
            <path d="M5 26.25C5 21.4175 9.47715 17.5 15 17.5C20.5228 17.5 25 21.4175 25 26.25"
                stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        </svg>
    );
}

// ── Weather icons ─────────────────────────────────────────────────────────────

export function SunIcon({ color = '#F6AE2D', size = 22 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
            <circle cx="15" cy="15" r="5.5" stroke={color} strokeWidth="2.2" />
            {[[15,3,15,7],[15,23,15,27],[3,15,7,15],[23,15,27,15],
              [6.5,6.5,9,9],[21,21,23.5,23.5],[23.5,6.5,21,9],[9,21,6.5,23.5]].map(([x1,y1,x2,y2],i) => (
                <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="2.2" strokeLinecap="round" />
            ))}
        </svg>
    );
}

export function CloudIcon({ color = '#8C9BAB', size = 22 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
            <path d="M22.5 22.5H8.5C5.74 22.5 3.5 20.26 3.5 17.5C3.5 15.07 5.24 13.04 7.57 12.6C7.53 12.24 7.5 11.87 7.5 11.5C7.5 7.91 10.41 5 14 5C16.97 5 19.48 6.9 20.28 9.57C20.68 9.52 21.09 9.5 21.5 9.5C24.81 9.5 27.5 12.19 27.5 15.5C27.5 19.09 24.59 22.5 21.5 22.5H22.5Z"
                stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function PartlyCloudyIcon({ color = '#71b3e5', size = 22 }: IconProps) {
    const s = size / 30;
    return (
        <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
            {/* small sun upper-left */}
            <circle cx="10" cy="10" r="3.5" stroke="#F6AE2D" strokeWidth="2" />
            {[[10,4,10,6.5],[10,13.5,10,16],[4,10,6.5,10],[13.5,10,16,10],[5.8,5.8,7.5,7.5],[12.5,12.5,14.2,14.2],[14.2,5.8,12.5,7.5],[7.5,12.5,5.8,14.2]].map(([x1,y1,x2,y2],i) => (
                <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#F6AE2D" strokeWidth="1.8" strokeLinecap="round" />
            ))}
            {/* cloud */}
            <path d="M23 25H13C10.79 25 9 23.21 9 21C9 19.07 10.36 17.45 12.17 17.08C12.06 16.73 12 16.37 12 16C12 13.79 13.79 12 16 12C17.73 12 19.22 13.05 19.81 14.54C20.19 14.52 20.59 14.5 21 14.5C23.49 14.5 25.5 16.51 25.5 19C25.5 22.09 24.1 25 22.5 25H23Z"
                stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function RainyIcon({ color = '#71b3e5', size = 22 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
            <path d="M22 19H8C5.24 19 3 16.76 3 14C3 11.57 4.74 9.54 7.07 9.1C7.03 8.74 7 8.37 7 8C7 4.69 9.69 2 13 2C15.97 2 18.48 3.9 19.28 6.57C19.68 6.52 20.09 6.5 20.5 6.5C23.81 6.5 26.5 9.19 26.5 12.5C26.5 15.96 24 19 22 19Z"
                stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="10" y1="22" x2="8" y2="28" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
            <line x1="16" y1="22" x2="14" y2="28" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
            <line x1="22" y1="22" x2="20" y2="28" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
        </svg>
    );
}

export function SnowIcon({ color = '#71b3e5', size = 22 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
            <path d="M22 19H8C5.24 19 3 16.76 3 14C3 11.57 4.74 9.54 7.07 9.1C7.03 8.74 7 8.37 7 8C7 4.69 9.69 2 13 2C15.97 2 18.48 3.9 19.28 6.57C19.68 6.52 20.09 6.5 20.5 6.5C23.81 6.5 26.5 9.19 26.5 12.5C26.5 15.96 24 19 22 19Z"
                stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            {[10, 16, 22].map(x => (
                <g key={x}>
                    <line x1={x} y1="22" x2={x} y2="28" stroke={color} strokeWidth="2" strokeLinecap="round" />
                    <line x1={x - 2} y1="25" x2={x + 2} y2="25" stroke={color} strokeWidth="2" strokeLinecap="round" />
                </g>
            ))}
        </svg>
    );
}

export function WeatherIcon({ desc = '', color, size = 22 }: { desc?: string; color?: string; size?: number }) {
    if (desc.includes('맑')) return <SunIcon color={color ?? '#F6AE2D'} size={size} />;
    if (desc.includes('비')) return <RainyIcon color={color ?? '#71b3e5'} size={size} />;
    if (desc.includes('눈')) return <SnowIcon color={color ?? '#71b3e5'} size={size} />;
    if (desc.includes('구름')) return <PartlyCloudyIcon color={color ?? '#71b3e5'} size={size} />;
    return <PartlyCloudyIcon color={color ?? '#71b3e5'} size={size} />;
}

// ── TPO icons ─────────────────────────────────────────────────────────────────

export function HeartIcon({ color = '#FF6B9D', size = 22 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
            <path d="M15 25.5C15 25.5 3.5 18 3.5 10.5C3.5 7.19 6.19 4.5 9.5 4.5C11.5 4.5 13.27 5.5 14.35 7.03C14.7 7.54 15.3 7.54 15.65 7.03C16.73 5.5 18.5 4.5 20.5 4.5C23.81 4.5 26.5 7.19 26.5 10.5C26.5 18 15 25.5 15 25.5Z"
                stroke={color} strokeWidth="2.3" strokeLinejoin="round" />
        </svg>
    );
}

export function BriefcaseIcon({ color = '#4A90D9', size = 22 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
            <rect x="3.5" y="10" width="23" height="17" rx="3" stroke={color} strokeWidth="2.2" />
            <path d="M10 10V8C10 6.34 11.34 5 13 5H17C18.66 5 20 6.34 20 8V10" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
            <line x1="3.5" y1="18" x2="26.5" y2="18" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
        </svg>
    );
}

export function ShirtIcon({ color = '#7EC8A4', size = 22 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
            <path d="M10 3.5L3.5 9L7.5 13L10 11V26.5H20V11L22.5 13L26.5 9L20 3.5C20 3.5 18.5 7 15 7C11.5 7 10 3.5 10 3.5Z"
                stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function RunIcon({ color = '#F5A623', size = 22 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
            <circle cx="20" cy="5.5" r="2.5" stroke={color} strokeWidth="2.2" />
            <path d="M17.5 9.5L13 14L10 12L6 15.5" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M13 14L14 19.5L11 25" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M14 19.5L19.5 22.5" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
            <path d="M17.5 9.5L22 11.5L24 8.5" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function StarBurstIcon({ color = '#9B59B6', size = 22 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
            <path d="M15 4L17.2 11.5H25L19 16L21.2 23.5L15 19.5L8.8 23.5L11 16L5 11.5H12.8L15 4Z"
                stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function PlaneIcon({ color = '#1ABC9C', size = 22 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
            <path d="M26.5 3.5L3.5 12.5L12 15.5L15.5 26.5L19.5 18L26.5 3.5Z"
                stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="12" y1="15.5" x2="19.5" y2="18" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
        </svg>
    );
}

export function TieIcon({ color = '#4A5568', size = 22 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
            <path d="M11 4H19L17 14H13L11 4Z" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M13 14L10 26H20L17 14" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

const TPO_ICON_MAP: Record<string, (color: string, size: number) => React.ReactElement> = {
    '데이트': (c, s) => <HeartIcon color={c} size={s} />,
    '직장':   (c, s) => <BriefcaseIcon color={c} size={s} />,
    '캐주얼': (c, s) => <ShirtIcon color={c} size={s} />,
    '운동':   (c, s) => <RunIcon color={c} size={s} />,
    '파티':   (c, s) => <StarBurstIcon color={c} size={s} />,
    '여행':   (c, s) => <PlaneIcon color={c} size={s} />,
    '일상':   (c, s) => <SunIcon color={c} size={s} />,
    '격식':   (c, s) => <TieIcon color={c} size={s} />,
};

export function TpoIcon({ tpo, color = '#555', size = 20 }: { tpo: string; color?: string; size?: number }) {
    const fn = TPO_ICON_MAP[tpo];
    return fn ? fn(color, size) : <SparkleIcon color={color} size={size} />;
}

// ── UI icons ──────────────────────────────────────────────────────────────────

export function RefreshIcon({ color = '#555', size = 22 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
            <path d="M26 15C26 20.52 21.52 25 16 25C10.48 25 6 20.52 6 15C6 9.48 10.48 5 16 5C19.16 5 21.98 6.44 23.87 8.71"
                stroke={color} strokeWidth="2.3" strokeLinecap="round" />
            <path d="M21 4L24.5 8.5L20 11" stroke={color} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function CheckIcon({ color = '#555', size = 22 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
            <path d="M5 15L11.5 22L25 8" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function AIIcon({ color = '#555', size = 22 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
            <rect x="4" y="8" width="22" height="16" rx="4" stroke={color} strokeWidth="2.2" />
            <circle cx="10.5" cy="16" r="2" stroke={color} strokeWidth="2" />
            <circle cx="19.5" cy="16" r="2" stroke={color} strokeWidth="2" />
            <path d="M10 4L10 8M20 4L20 8" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
            <path d="M13 22L13 26M17 22L17 26" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
        </svg>
    );
}

export function ClockIcon({ color = '#555', size = 22 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
            <circle cx="15" cy="15" r="11" stroke={color} strokeWidth="2.2" />
            <path d="M15 8V15L19.5 19.5" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function ThermometerIcon({ color = '#555', size = 22 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
            <path d="M15 4V19" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="15" cy="23" r="4" stroke={color} strokeWidth="2.2" />
            <rect x="11.5" y="4" width="7" height="16" rx="3.5" stroke={color} strokeWidth="2.2" />
            <line x1="19" y1="8" x2="21" y2="8" stroke={color} strokeWidth="2" strokeLinecap="round" />
            <line x1="19" y1="12" x2="22" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
            <line x1="19" y1="16" x2="21" y2="16" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

export function PinIcon({ color = '#555', size = 22 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
            <path d="M15 3C10.58 3 7 6.58 7 11C7 17.25 15 27 15 27C15 27 23 17.25 23 11C23 6.58 19.42 3 15 3Z"
                stroke={color} strokeWidth="2.2" strokeLinejoin="round" />
            <circle cx="15" cy="11" r="3" stroke={color} strokeWidth="2" />
        </svg>
    );
}

export function WarningIcon({ color = '#e74c3c', size = 22 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
            <path d="M15 4L27 25H3L15 4Z" stroke={color} strokeWidth="2.2" strokeLinejoin="round" />
            <line x1="15" y1="13" x2="15" y2="19" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="15" cy="22.5" r="1.2" fill={color} />
        </svg>
    );
}

export function StudioIcon({ color = '#555', size = 22 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
            <rect x="4" y="14" width="22" height="13" rx="3" stroke={color} strokeWidth="2.2" />
            <rect x="7" y="8" width="16" height="13" rx="3" stroke={color} strokeWidth="2.2" />
            <rect x="10" y="3" width="10" height="11" rx="2.5" stroke={color} strokeWidth="2.2" />
        </svg>
    );
}

export function CloseIcon({ color = '#aaa', size = 18 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
            <path d="M6 6L24 24M24 6L6 24" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        </svg>
    );
}

export function WaveIcon({ color = '#555', size = 22 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
            <path d="M12 4V14L10 12V6C10 5.17 10.67 4.5 11.5 4.5C12.33 4.5 13 5.17 13 6"
                stroke={color} strokeWidth="2" strokeLinecap="round" />
            <path d="M16 5V15L13.5 13V7.5C13.5 6.67 14.17 6 15 6C15.83 6 16.5 6.67 16.5 7.5"
                stroke={color} strokeWidth="2" strokeLinecap="round" />
            <path d="M20 7V17L16.5 15V10C16.5 9.17 17.17 8.5 18 8.5C18.83 8.5 19.5 9.17 19.5 10"
                stroke={color} strokeWidth="2" strokeLinecap="round" />
            <path d="M10 14C10 14 8 15 7 18C6 21 8 24 10 25C12 26 16 26.5 19 25C22 23.5 23 20 22 17L20 17"
                stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}
