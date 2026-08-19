import React from 'react';
import {
    Home, Shirt, Calendar, Sparkles, User, Layers,
    Sun, Cloud, CloudSun, CloudRain, CloudSnow,
    Heart, Briefcase, Dumbbell, PartyPopper, Plane, Award,
    RefreshCw, Check, Bot, Clock, Thermometer, MapPin,
    AlertTriangle, X, Wind, Search,
} from 'lucide-react';

interface IconProps { color?: string; size?: number; }

const SW = 1.8;

// ── Nav icons ─────────────────────────────────────────────────────────────────

export function HomeIcon({ color = '#555', size = 22 }: IconProps) {
    return <Home size={size} color={color} strokeWidth={SW} />;
}

export function WardrobeIcon({ color = '#555', size = 22 }: IconProps) {
    return <Shirt size={size} color={color} strokeWidth={SW} />;
}

export function CalendarIcon({ color = '#555', size = 22 }: IconProps) {
    return <Calendar size={size} color={color} strokeWidth={SW} />;
}

export function SparkleIcon({ color = '#555', size = 22 }: IconProps) {
    return <Sparkles size={size} color={color} strokeWidth={SW} />;
}

export function UserIcon({ color = '#555', size = 22 }: IconProps) {
    return <User size={size} color={color} strokeWidth={SW} />;
}

export function StudioIcon({ color = '#555', size = 22 }: IconProps) {
    return <Layers size={size} color={color} strokeWidth={SW} />;
}

// ── Weather icons ─────────────────────────────────────────────────────────────

export function SunIcon({ color = '#F6AE2D', size = 22 }: IconProps) {
    return <Sun size={size} color={color} strokeWidth={SW} />;
}

export function CloudIcon({ color = '#8C9BAB', size = 22 }: IconProps) {
    return <Cloud size={size} color={color} strokeWidth={SW} />;
}

export function PartlyCloudyIcon({ color = '#71b3e5', size = 22 }: IconProps) {
    return <CloudSun size={size} color={color} strokeWidth={SW} />;
}

export function RainyIcon({ color = '#71b3e5', size = 22 }: IconProps) {
    return <CloudRain size={size} color={color} strokeWidth={SW} />;
}

export function SnowIcon({ color = '#71b3e5', size = 22 }: IconProps) {
    return <CloudSnow size={size} color={color} strokeWidth={SW} />;
}

export function WeatherIcon({ desc = '', color, size = 22 }: { desc?: string; color?: string; size?: number }) {
    if (desc.includes('맑')) return <SunIcon color={color ?? '#F6AE2D'} size={size} />;
    if (desc.includes('비')) return <RainyIcon color={color ?? '#71b3e5'} size={size} />;
    if (desc.includes('눈')) return <SnowIcon color={color ?? '#71b3e5'} size={size} />;
    return <PartlyCloudyIcon color={color ?? '#71b3e5'} size={size} />;
}

// ── TPO icons ─────────────────────────────────────────────────────────────────

export function HeartIcon({ color = '#FF6B9D', size = 22 }: IconProps) {
    return <Heart size={size} color={color} strokeWidth={SW} />;
}

export function BriefcaseIcon({ color = '#4A90D9', size = 22 }: IconProps) {
    return <Briefcase size={size} color={color} strokeWidth={SW} />;
}

export function ShirtIcon({ color = '#7EC8A4', size = 22 }: IconProps) {
    return <Shirt size={size} color={color} strokeWidth={SW} />;
}

export function RunIcon({ color = '#F5A623', size = 22 }: IconProps) {
    return <Dumbbell size={size} color={color} strokeWidth={SW} />;
}

export function StarBurstIcon({ color = '#9B59B6', size = 22 }: IconProps) {
    return <PartyPopper size={size} color={color} strokeWidth={SW} />;
}

export function PlaneIcon({ color = '#1ABC9C', size = 22 }: IconProps) {
    return <Plane size={size} color={color} strokeWidth={SW} />;
}

export function TieIcon({ color = '#4A5568', size = 22 }: IconProps) {
    return <Award size={size} color={color} strokeWidth={SW} />;
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

export function SearchIcon({ color = '#aaa', size = 20 }: IconProps) {
    return <Search size={size} color={color} strokeWidth={SW} />;
}

export function RefreshIcon({ color = '#555', size = 22 }: IconProps) {
    return <RefreshCw size={size} color={color} strokeWidth={SW} />;
}

export function CheckIcon({ color = '#555', size = 22 }: IconProps) {
    return <Check size={size} color={color} strokeWidth={SW} />;
}

export function AIIcon({ color = '#555', size = 22 }: IconProps) {
    return <Bot size={size} color={color} strokeWidth={SW} />;
}

export function ClockIcon({ color = '#555', size = 22 }: IconProps) {
    return <Clock size={size} color={color} strokeWidth={SW} />;
}

export function ThermometerIcon({ color = '#555', size = 22 }: IconProps) {
    return <Thermometer size={size} color={color} strokeWidth={SW} />;
}

export function PinIcon({ color = '#555', size = 22 }: IconProps) {
    return <MapPin size={size} color={color} strokeWidth={SW} />;
}

export function WarningIcon({ color = '#e74c3c', size = 22 }: IconProps) {
    return <AlertTriangle size={size} color={color} strokeWidth={SW} />;
}

export function CloseIcon({ color = '#aaa', size = 18 }: IconProps) {
    return <X size={size} color={color} strokeWidth={SW} />;
}

export function WaveIcon({ color = '#555', size = 22 }: IconProps) {
    return <Wind size={size} color={color} strokeWidth={SW} />;
}
