import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../styles/theme';
import { weatherAPI, wardrobeAPI, calendarAPI, recommendationAPI } from '../api/api';
import { toDateStr } from '../utils/date';
import { WeatherIcon, SparkleIcon, CalendarIcon, WardrobeIcon, TpoIcon, CheckIcon } from '../components/Icons';

// ── Types ────────────────────────────────────────────────────────────────────

interface Weather {
    temp: number;
    city: string;
    desc: string;
    feelsLike?: number;
    humidity?: number;
    tempMax?: number;
    tempMin?: number;
}
interface CalendarEvent {
    eventId: number;
    eventName: string;
    eventDatetime: string;
    tpoKeyword: string;
}
interface OutfitItem {
    type?: string;
    color?: string;
    imageUrl?: string;
    imageB64?: string;
}
interface Outfit {
    top?: OutfitItem;
    bottom?: OutfitItem;
    outer?: OutfitItem;
    description?: string;
}
interface Recommendation {
    outfit?: Outfit;
    matched_items?: OutfitItem[];
}
interface WardrobeItem {
    id: number;
    imageUrl?: string;
    type?: string;
    category?: string;
}
interface WeekOutfit {
    outfitDate: string;
    matchedItems?: { imageUrl?: string }[];
    description?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const TPO_LIST = [
    { key: '데이트', color: '#FF6B9D' },
    { key: '직장',   color: '#4A90D9' },
    { key: '캐주얼', color: '#7EC8A4' },
    { key: '운동',   color: '#F5A623' },
    { key: '파티',   color: '#9B59B6' },
    { key: '여행',   color: '#1ABC9C' },
    { key: '일상',   color: '#95A5A6' },
    { key: '격식',   color: '#34495E' },
];

const AI_STEPS = [
    '날씨를 확인하고 있어요',
    '일정을 분석하고 있어요',
    '옷장 속 아이템을 비교하고 있어요',
    '오늘의 코디를 완성했어요',
];

const SECTION_DEFS = [
    { id: 'weather',        label: '01 WEATHER' },
    { id: 'tpo',            label: '02 TPO' },
    { id: 'recommendation', label: '03 RECOMMENDATION' },
    { id: 'closet',         label: '04 CLOSET' },
    { id: 'calendar',       label: '05 CALENDAR' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getWeatherGradient(desc: string): string {
    if (desc.includes('맑')) return 'linear-gradient(160deg, #87ceeb 0%, #71b3e5 45%, #fff9e6 100%)';
    if (desc.includes('비')) return 'linear-gradient(160deg, #2d3748 0%, #4a5568 55%, #718096 100%)';
    if (desc.includes('눈')) return 'linear-gradient(160deg, #bfdbfe 0%, #e0f2fe 55%, #f0f9ff 100%)';
    if (desc.includes('구름')) return 'linear-gradient(160deg, #9ca3af 0%, #d1d5db 55%, #e5e7eb 100%)';
    return 'linear-gradient(160deg, #71b3e5 0%, #bfdbfe 60%, #fff9e6 100%)';
}

function getHeroTextColor(desc: string): string {
    if (desc.includes('비') || desc.includes('흐')) return 'white';
    if (desc.includes('눈') || desc.includes('구름')) return '#1a1a2e';
    return 'white';
}

function getWeatherMessage(temp: number, desc: string): string {
    if (desc.includes('비')) return '비 오는 날엔 방수 아우터가 필수예요.';
    if (desc.includes('눈')) return '눈 오는 날엔 따뜻하게 챙겨 입어요.';
    if (temp <= 5)  return '오늘은 두꺼운 코트가 필요한 날이에요.';
    if (temp <= 12) return '오늘은 따뜻한 재킷이 필요한 날이에요.';
    if (temp <= 18) return '오늘은 얇은 겉옷이 필요한 날이에요.';
    if (temp <= 24) return '오늘은 가벼운 옷차림이 좋을 것 같아요.';
    return '오늘은 시원한 옷차림이 좋을 것 같아요.';
}

// ── Component ─────────────────────────────────────────────────────────────────

function Home() {
    const navigate = useNavigate();
    const nickname = localStorage.getItem('nickname') || '사용자';
    const today = useMemo(() => new Date(), []);

    const [weather, setWeather]             = useState<Weather | null>(null);
    const [todayEvents, setTodayEvents]     = useState<CalendarEvent[]>([]);
    const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
    const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([]);
    const [recentOutfits, setRecentOutfits] = useState<WeekOutfit[]>([]);
    const [selectedTpo, setSelectedTpo]     = useState<string>('일상');
    const [loading, setLoading]             = useState(false);
    const [aiStep, setAiStep]               = useState<number>(-1);
    const [activeSection, setActiveSection] = useState<string>('hero');

    // Section refs
    const heroRef           = useRef<HTMLElement>(null);
    const weatherSecRef     = useRef<HTMLElement>(null);
    const tpoRef            = useRef<HTMLElement>(null);
    const recommendRef      = useRef<HTMLElement>(null);
    const closetRef         = useRef<HTMLElement>(null);
    const calendarSecRef    = useRef<HTMLElement>(null);

    const sectionRefMap = useMemo(() => ({
        hero:           heroRef,
        weather:        weatherSecRef,
        tpo:            tpoRef,
        recommendation: recommendRef,
        closet:         closetRef,
        calendar:       calendarSecRef,
    }), []);

    // ── Data fetching ──────────────────────────────────────────────────────────

    const fetchWeather = useCallback(async () => {
        try { const res = await weatherAPI.getWeather(); setWeather(res.data); } catch {}
    }, []);

    const fetchCalendarData = useCallback(async () => {
        try {
            const res = await calendarAPI.getEvents();
            const all: CalendarEvent[] = res.data;
            const todayEvts = all.filter(e => {
                const d = new Date(e.eventDatetime);
                return d.getFullYear() === today.getFullYear() &&
                       d.getMonth()    === today.getMonth()    &&
                       d.getDate()     === today.getDate();
            });
            setTodayEvents(todayEvts);
            if (todayEvts[0]) setSelectedTpo(todayEvts[0].tpoKeyword);
        } catch {}
    }, [today]);

    const fetchWardrobeItems = useCallback(async () => {
        try {
            const res = await wardrobeAPI.getWardrobe();
            setWardrobeItems((res.data || []).slice(0, 6));
        } catch {}
    }, []);

    const fetchRecentOutfits = useCallback(async () => {
        try {
            const start = toDateStr(new Date(today.getFullYear(), today.getMonth(), 1));
            const end   = toDateStr(today);
            const res   = await recommendationAPI.getWeekOutfits(start, end);
            setRecentOutfits((res.data || []).slice(0, 4));
        } catch {}
    }, [today]);

    useEffect(() => {
        fetchWeather();
        fetchCalendarData();
        fetchWardrobeItems();
        fetchRecentOutfits();
    }, [fetchWeather, fetchCalendarData, fetchWardrobeItems, fetchRecentOutfits]);

    // ── Section indicator tracking ─────────────────────────────────────────────

    useEffect(() => {
        const observers = Object.entries(sectionRefMap).map(([id, ref]) => {
            if (!ref.current) return null;
            const obs = new IntersectionObserver(
                ([entry]) => { if (entry.isIntersecting) setActiveSection(id); },
                { threshold: 0.25, rootMargin: '-56px 0px -80px 0px' }
            );
            obs.observe(ref.current);
            return obs;
        });
        return () => observers.forEach(o => o?.disconnect());
    }, [sectionRefMap]);

    // ── Scroll-reveal for [data-animate] elements ──────────────────────────────
    // 데이터 로드 후 새로 렌더링된 요소도 감지하도록 의존성 포함

    useEffect(() => {
        const obs = new IntersectionObserver(
            (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in-view'); }),
            { threshold: 0.1 }
        );
        document.querySelectorAll('[data-animate]:not(.in-view)').forEach(el => obs.observe(el));
        return () => obs.disconnect();
    }, [weather, wardrobeItems, recentOutfits, recommendation]);

    // ── Scroll to section ──────────────────────────────────────────────────────

    const scrollTo = useCallback((id: string) => {
        const ref = sectionRefMap[id as keyof typeof sectionRefMap];
        ref?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [sectionRefMap]);

    // ── AI recommendation with step animation ─────────────────────────────────

    const fetchRecommendation = useCallback(async () => {
        if (loading) return;
        setLoading(true);
        setRecommendation(null);
        setAiStep(0);
        const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
        try {
            await delay(500); setAiStep(1);
            await delay(500); setAiStep(2);
            const body = { tpo: selectedTpo, mode: 'rag', linkedEvents: todayEvents.slice(0, 1).map(e => e.eventId) };
            const [res] = await Promise.all([wardrobeAPI.recommend(body), delay(700)]);
            setAiStep(3);
            await delay(400);
            setRecommendation(res.data);
        } catch {}
        finally { setLoading(false); }
    }, [loading, selectedTpo, todayEvents]);

    // ── Derived values ─────────────────────────────────────────────────────────

    const weatherGradient = weather ? getWeatherGradient(weather.desc) : 'linear-gradient(160deg, #71b3e5 0%, #bfdbfe 60%, #fff9e6 100%)';
    const heroTextColor   = weather ? getHeroTextColor(weather.desc) : 'white';
    const todayLabel      = `${today.getMonth() + 1}월 ${today.getDate()}일 (${WEEKDAYS[today.getDay()]})`;
    const outfitSlots     = recommendation?.outfit
        ? ([
            { label: '상의',   item: recommendation.outfit.top },
            { label: '하의',   item: recommendation.outfit.bottom },
            { label: '아우터', item: recommendation.outfit.outer },
          ] as { label: string; item: OutfitItem | undefined }[]).filter(s => s.item)
        : [];

    const heroSubColor = heroTextColor === 'white' ? 'rgba(255,255,255,0.82)' : 'rgba(0,0,0,0.55)';

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <div style={{ minHeight: '100vh', overflowX: 'hidden', background: '#f5f7fa' }}>

            {/* ── Top Navigation ───────────────────────────────────────────── */}
            <nav style={{
                position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
                height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0 40px',
                background: 'rgba(255,255,255,0.82)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                borderBottom: '1px solid rgba(0,0,0,0.06)',
            }}>
                <img
                    src="/logo%203.svg"
                    alt="Look at Life"
                    style={{ height: 120, width: 'auto' }}
                />
                <div style={{ display: 'flex', gap: 36 }}>
                    {([
                        { label: 'WEATHER',    fn: () => scrollTo('weather') },
                        { label: 'MY CLOSET',  fn: () => navigate('/wardrobe') },
                        { label: 'CALENDAR',   fn: () => navigate('/calendar') },
                        { label: 'PROFILE',    fn: () => navigate('/mypage') },
                    ] as { label: string; fn: () => void }[]).map(({ label, fn }) => (
                        <button key={label} onClick={fn} style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
                            fontFamily: theme.fontFamily.body, fontWeight: 600, fontSize: 11,
                            color: '#666', letterSpacing: '0.09em',
                            transition: 'color 0.2s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#71b3e5'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#666'; }}>
                            {label}
                        </button>
                    ))}
                </div>
            </nav>

            {/* ── Section Indicators ───────────────────────────────────────── */}
            <div style={{
                position: 'fixed', left: 20, top: '50%', transform: 'translateY(-50%)',
                zIndex: 80, display: 'flex', flexDirection: 'column', gap: 18,
            }}>
                {SECTION_DEFS.map(({ id, label }) => {
                    const active = activeSection === id;
                    return (
                        <button key={id} onClick={() => scrollTo(id)} style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                            display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                            <div style={{
                                height: 1, flexShrink: 0,
                                width: active ? 24 : 10,
                                background: active ? '#71b3e5' : 'rgba(0,0,0,0.18)',
                                transition: 'width 0.3s ease, background 0.3s ease',
                            }} />
                            <span style={{
                                fontFamily: theme.fontFamily.body, fontWeight: 700, fontSize: 8,
                                color: active ? '#1a1a2e' : 'transparent',
                                letterSpacing: '0.1em', whiteSpace: 'nowrap',
                                transition: 'color 0.3s ease',
                            }}>
                                {label}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* ── HERO SECTION ─────────────────────────────────────────────── */}
            <section ref={heroRef} style={{
                minHeight: '100vh', paddingTop: 56,
                background: weatherGradient,
                display: 'flex', alignItems: 'center',
                position: 'relative', overflow: 'hidden',
            }}>
                <div style={{
                    maxWidth: 1200, width: '100%', margin: '0 auto',
                    padding: '60px 80px 60px 100px',
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center',
                }}>
                    {/* Left */}
                    <div>
                        <p style={{
                            fontFamily: theme.fontFamily.body, fontWeight: 600, fontSize: 11,
                            color: heroSubColor, letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 20px',
                        }}>
                            {todayLabel}
                            {weather && <span style={{ marginLeft: 14 }}>{Math.round(weather.temp)}℃ · {weather.desc}</span>}
                        </p>
                        <h1 style={{
                            fontFamily: theme.fontFamily.heading, fontWeight: 700,
                            fontSize: 52, lineHeight: 1.15, color: heroTextColor,
                            margin: '0 0 24px', letterSpacing: '-1px',
                        }}>
                            안녕하세요,<br />{nickname}님
                        </h1>
                        <p style={{
                            fontFamily: theme.fontFamily.body, fontWeight: 400, fontSize: 19,
                            color: heroSubColor, margin: '0 0 44px', lineHeight: 1.65,
                        }}>
                            {weather
                                ? getWeatherMessage(weather.temp, weather.desc)
                                : '오늘의 날씨와 일정을 분석해 코디를 추천해 드려요.'}
                        </p>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            <button onClick={() => scrollTo('weather')} style={{
                                background: 'white', border: 'none', borderRadius: 999,
                                padding: '16px 36px', cursor: 'pointer',
                                fontFamily: theme.fontFamily.ui, fontWeight: 700, fontSize: 15,
                                color: '#71b3e5', boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
                            }}>
                                오늘의 코디 확인하기 ↓
                            </button>
                            {todayEvents[0] && (
                                <button onClick={() => scrollTo('tpo')} style={{
                                    background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)',
                                    border: '1.5px solid rgba(255,255,255,0.45)', borderRadius: 999,
                                    padding: '16px 28px', cursor: 'pointer',
                                    fontFamily: theme.fontFamily.ui, fontWeight: 600, fontSize: 14,
                                    color: heroTextColor,
                                }}>
                                    {todayEvents[0].eventName} 코디
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Right: Hero image */}
                    <div style={{ position: 'relative' }}>
                        <div style={{ borderRadius: 28, overflow: 'hidden', height: 520, boxShadow: '0 32px 80px rgba(0,0,0,0.22)' }}>
                            <img
                                src="/img/danijela-prijovic-P05TTnXwaWE-unsplash.jpg"
                                alt="오늘의 패션"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        </div>
                        {weather && (
                            <div style={{
                                position: 'absolute', bottom: 24, left: -28,
                                background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)',
                                borderRadius: 18, padding: '14px 22px',
                                boxShadow: '0 8px 28px rgba(0,0,0,0.12)',
                                display: 'flex', alignItems: 'center', gap: 14,
                            }}>
                                <WeatherIcon desc={weather.desc} size={34} />
                                <div>
                                    <p style={{ fontFamily: theme.fontFamily.heading, fontWeight: 700, fontSize: 24, color: '#1a1a2e', margin: 0 }}>
                                        {Math.round(weather.temp)}℃
                                    </p>
                                    <p style={{ fontFamily: theme.fontFamily.body, fontSize: 12, color: '#888', margin: '2px 0 0' }}>
                                        {weather.city}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* ── 01 WEATHER ───────────────────────────────────────────────── */}
            <section ref={weatherSecRef} style={{ padding: '100px 80px 100px 120px', background: 'white' }}>
                <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                    <p data-animate style={{ fontFamily: theme.fontFamily.body, fontWeight: 700, fontSize: 10, color: '#71b3e5', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 16px' }}>
                        01 WEATHER
                    </p>
                    {weather ? (
                        <div data-animate style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 72, alignItems: 'center' }}>
                            <div style={{ textAlign: 'center' }}>
                                <WeatherIcon desc={weather.desc} size={96} />
                                <p style={{ fontFamily: theme.fontFamily.heading, fontWeight: 700, fontSize: 72, color: '#1a1a2e', margin: '12px 0 0', lineHeight: 1 }}>
                                    {Math.round(weather.temp)}<span style={{ fontSize: 36 }}>℃</span>
                                </p>
                                <p style={{ fontFamily: theme.fontFamily.body, fontSize: 16, color: '#888', margin: '8px 0 0' }}>{weather.desc}</p>
                            </div>
                            <div>
                                <h2 style={{ fontFamily: theme.fontFamily.heading, fontWeight: 700, fontSize: 36, color: '#1a1a2e', lineHeight: 1.3, margin: '0 0 32px' }}>
                                    {getWeatherMessage(weather.temp, weather.desc)}
                                </h2>
                                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                    {[
                                        { label: '체감', val: weather.feelsLike != null ? `${Math.round(weather.feelsLike)}℃` : '-' },
                                        { label: '최고', val: weather.tempMax   != null ? `${Math.round(weather.tempMax)}℃`   : '-' },
                                        { label: '최저', val: weather.tempMin   != null ? `${Math.round(weather.tempMin)}℃`   : '-' },
                                        { label: '습도', val: weather.humidity  != null ? `${weather.humidity}%`               : '-' },
                                    ].map(({ label, val }) => (
                                        <div key={label} style={{ background: '#f5f7fa', borderRadius: 16, padding: '18px 28px', minWidth: 88 }}>
                                            <p style={{ fontFamily: theme.fontFamily.body, fontSize: 11, color: '#aaa', margin: 0 }}>{label}</p>
                                            <p style={{ fontFamily: theme.fontFamily.heading, fontWeight: 700, fontSize: 22, color: '#1a1a2e', margin: '6px 0 0' }}>{val}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p data-animate style={{ fontFamily: theme.fontFamily.body, fontSize: 16, color: '#aaa' }}>날씨 정보를 불러오는 중이에요...</p>
                    )}
                </div>
            </section>

            {/* ── 02 TPO ───────────────────────────────────────────────────── */}
            <section ref={tpoRef} style={{ padding: '100px 80px 100px 120px', background: '#f5f7fa' }}>
                <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                    <p data-animate style={{ fontFamily: theme.fontFamily.body, fontWeight: 700, fontSize: 10, color: '#71b3e5', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 16px' }}>
                        02 TPO
                    </p>
                    <h2 data-animate style={{ fontFamily: theme.fontFamily.heading, fontWeight: 700, fontSize: 40, color: '#1a1a2e', margin: '0 0 14px' }}>
                        오늘은 어디에 가나요?
                    </h2>
                    {todayEvents.length > 0 && (
                        <p data-animate style={{ fontFamily: theme.fontFamily.body, fontSize: 15, color: '#888', margin: '0 0 40px' }}>
                            오늘 일정: {todayEvents.map(e => e.eventName).join(', ')}
                        </p>
                    )}
                    <div data-animate style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: `${todayEvents.length ? 0 : 40}px 0 48px` }}>
                        {TPO_LIST.map(({ key, color }) => {
                            const active = selectedTpo === key;
                            return (
                                <button key={key} onClick={() => setSelectedTpo(key)} style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 10,
                                    padding: '14px 24px', borderRadius: 999, cursor: 'pointer',
                                    border: active ? `2px solid ${color}` : '1.5px solid #e0e4ea',
                                    background: active ? `${color}18` : 'white',
                                    transition: 'all 0.2s',
                                }}>
                                    <TpoIcon tpo={key} color={active ? color : '#bbb'} size={20} />
                                    <span style={{
                                        fontFamily: theme.fontFamily.ui,
                                        fontWeight: active ? 700 : 500, fontSize: 15,
                                        color: active ? color : '#666',
                                    }}>{key}</span>
                                </button>
                            );
                        })}
                    </div>
                    <button data-animate onClick={() => { scrollTo('recommendation'); fetchRecommendation(); }} style={{
                        background: 'linear-gradient(135deg, #71b3e5, #5a9fd4)',
                        border: 'none', borderRadius: 999,
                        padding: '18px 48px', cursor: 'pointer',
                        fontFamily: theme.fontFamily.ui, fontWeight: 700, fontSize: 16,
                        color: 'white', boxShadow: '0 8px 28px rgba(113,179,229,0.4)',
                        display: 'inline-flex', alignItems: 'center', gap: 10,
                    }}>
                        <SparkleIcon color="white" size={20} />
                        AI 코디 추천받기
                    </button>
                </div>
            </section>

            {/* ── 03 RECOMMENDATION ────────────────────────────────────────── */}
            <section ref={recommendRef} style={{ padding: '100px 80px 100px 120px', background: 'white' }}>
                <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                    <p data-animate style={{ fontFamily: theme.fontFamily.body, fontWeight: 700, fontSize: 10, color: '#71b3e5', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 16px' }}>
                        03 RECOMMENDATION
                    </p>
                    <h2 data-animate style={{ fontFamily: theme.fontFamily.heading, fontWeight: 700, fontSize: 40, color: '#1a1a2e', margin: '0 0 56px' }}>
                        AI 분석 과정
                    </h2>

                    {/* Steps */}
                    <div style={{ maxWidth: 540, marginBottom: 60 }}>
                        {AI_STEPS.map((step, i) => {
                            const done   = aiStep >= i;
                            const active = aiStep === i && loading;
                            return (
                                <div key={i} data-animate style={{
                                    display: 'flex', alignItems: 'center', gap: 20,
                                    padding: '20px 0',
                                    borderBottom: i < AI_STEPS.length - 1 ? '1px solid #f2f2f2' : 'none',
                                    opacity: aiStep === -1 ? 0.3 : done ? 1 : 0.3,
                                    transition: 'opacity 0.4s ease',
                                }}>
                                    <div style={{
                                        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                                        background: done ? 'linear-gradient(135deg, #71b3e5, #5a9fd4)' : '#f0f0f0',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        transition: 'background 0.3s ease',
                                    }}>
                                        {done
                                            ? <CheckIcon color="white" size={18} />
                                            : <span style={{ fontFamily: theme.fontFamily.heading, fontWeight: 700, fontSize: 14, color: '#bbb' }}>{i + 1}</span>
                                        }
                                    </div>
                                    <span style={{
                                        fontFamily: theme.fontFamily.ui,
                                        fontWeight: done ? 600 : 400, fontSize: 17,
                                        color: done ? '#1a1a2e' : '#bbb',
                                        transition: 'color 0.3s ease',
                                    }}>
                                        {step}
                                        {active && <span style={{ marginLeft: 8, fontSize: 13, color: '#71b3e5' }}>...</span>}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Outfit reveal */}
                    {aiStep === -1 ? (
                        <div data-animate style={{
                            background: '#f5f7fa', borderRadius: 24, padding: '56px',
                            textAlign: 'center', border: '2px dashed #dde3ea',
                        }}>
                            <SparkleIcon color="#ccc" size={52} />
                            <p style={{ fontFamily: theme.fontFamily.ui, fontSize: 16, color: '#ccc', margin: '16px 0 0' }}>
                                위에서 TPO를 선택하고 추천받기를 눌러보세요
                            </p>
                        </div>
                    ) : recommendation ? (
                        <div data-animate style={{
                            background: 'linear-gradient(135deg, #d4eaf9 0%, #f0f7ff 100%)',
                            borderRadius: 28, padding: '48px',
                            border: '2px solid rgba(113,179,229,0.28)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 32 }}>
                                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #71b3e5, #5a9fd4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <SparkleIcon color="white" size={22} />
                                </div>
                                <div>
                                    <p style={{ fontFamily: theme.fontFamily.body, fontWeight: 700, fontSize: 11, color: '#71b3e5', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>오늘의 추천 코디</p>
                                    <p style={{ fontFamily: theme.fontFamily.heading, fontWeight: 700, fontSize: 22, color: '#1a1a2e', margin: '4px 0 0' }}>{selectedTpo} 스타일</p>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, marginBottom: 28 }}>
                                {outfitSlots.map(({ label, item }) => (
                                    <div key={label} style={{ background: 'white', borderRadius: 18, padding: '20px', textAlign: 'center' }}>
                                        <div style={{ aspectRatio: '1', borderRadius: 12, overflow: 'hidden', marginBottom: 12, background: 'rgba(113,179,229,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {(item?.imageUrl || item?.imageB64)
                                                ? <img src={item.imageUrl || item.imageB64} alt={item?.type} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                : <WardrobeIcon color="#71b3e5" size={36} />
                                            }
                                        </div>
                                        <p style={{ fontFamily: theme.fontFamily.body, fontWeight: 700, fontSize: 10, color: '#71b3e5', margin: '0 0 4px', textTransform: 'uppercase' }}>{label}</p>
                                        <p style={{ fontFamily: theme.fontFamily.heading, fontWeight: 600, fontSize: 14, color: '#1a1a2e', margin: 0 }}>{item?.type}</p>
                                        {item?.color && <p style={{ fontFamily: theme.fontFamily.body, fontSize: 11, color: '#aaa', margin: '4px 0 0' }}>{item.color}</p>}
                                    </div>
                                ))}
                            </div>
                            {recommendation.outfit?.description && (
                                <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 16, padding: '20px 24px', borderLeft: '3px solid #71b3e5', marginBottom: 24 }}>
                                    <p style={{ fontFamily: theme.fontFamily.ui, fontSize: 14, color: '#555', lineHeight: 1.7, margin: 0 }}>
                                        "{recommendation.outfit.description}"
                                    </p>
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: 12 }}>
                                <button onClick={() => navigate('/wardrobe')} style={{
                                    flex: 1, padding: '14px', background: 'white',
                                    border: '1.5px solid rgba(113,179,229,0.4)', borderRadius: 14,
                                    fontFamily: theme.fontFamily.ui, fontWeight: 600, fontSize: 14,
                                    color: '#71b3e5', cursor: 'pointer',
                                }}>내 옷장에 추가하기 →</button>
                                <button onClick={() => navigate('/calendar')} style={{
                                    flex: 1, padding: '14px', background: 'white',
                                    border: '1.5px solid rgba(113,179,229,0.4)', borderRadius: 14,
                                    fontFamily: theme.fontFamily.ui, fontWeight: 600, fontSize: 14,
                                    color: '#71b3e5', cursor: 'pointer',
                                }}>캘린더에 저장하기 →</button>
                            </div>
                        </div>
                    ) : null}
                </div>
            </section>

            {/* ── 04 CLOSET ────────────────────────────────────────────────── */}
            <section ref={closetRef} style={{ padding: '100px 80px 100px 120px', background: '#1a1a2e', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, opacity: 0.18 }}>
                    <img src="/img/pexels-ron-lach-8346040.jpg" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ position: 'relative', maxWidth: 1100, margin: '0 auto' }}>
                    <p data-animate style={{ fontFamily: theme.fontFamily.body, fontWeight: 700, fontSize: 10, color: '#71b3e5', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 16px' }}>
                        04 CLOSET
                    </p>
                    <h2 data-animate style={{ fontFamily: theme.fontFamily.heading, fontWeight: 700, fontSize: 40, color: 'white', margin: '0 0 16px', lineHeight: 1.3 }}>
                        새 옷을 사지 않아도<br />내 옷장 안에서<br />오늘의 답을 찾을 수 있어요.
                    </h2>
                    <p data-animate style={{ fontFamily: theme.fontFamily.body, fontSize: 16, color: 'rgba(255,255,255,0.55)', margin: '0 0 48px', lineHeight: 1.7 }}>
                        AI가 내 옷장 속 아이템을 분석해 최적의 조합을 찾아드려요.
                    </p>

                    {wardrobeItems.length > 0 ? (
                        <div data-animate style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 16, marginBottom: 48 }}>
                            {wardrobeItems.map((item) => (
                                <div key={item.id} className="wardrobe-card" style={{
                                    background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(8px)',
                                    borderRadius: 20, overflow: 'hidden',
                                    border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
                                }}>
                                    <div style={{ aspectRatio: '1', overflow: 'hidden', background: 'rgba(255,255,255,0.04)' }}>
                                        {item.imageUrl
                                            ? <img src={item.imageUrl} alt={item.type} className="wardrobe-card-img" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><WardrobeIcon color="rgba(255,255,255,0.25)" size={40} /></div>
                                        }
                                    </div>
                                    <div style={{ padding: '12px 14px' }}>
                                        <p style={{ fontFamily: theme.fontFamily.body, fontWeight: 600, fontSize: 10, color: '#71b3e5', margin: 0, textTransform: 'uppercase' }}>{item.category}</p>
                                        <p style={{ fontFamily: theme.fontFamily.heading, fontWeight: 600, fontSize: 13, color: 'white', margin: '4px 0 0' }}>{item.type || '아이템'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div data-animate style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: '48px', textAlign: 'center', marginBottom: 48, border: '1px dashed rgba(255,255,255,0.15)' }}>
                            <WardrobeIcon color="rgba(255,255,255,0.2)" size={56} />
                            <p style={{ fontFamily: theme.fontFamily.ui, fontSize: 15, color: 'rgba(255,255,255,0.35)', margin: '16px 0 0' }}>
                                아직 등록된 옷이 없어요
                            </p>
                        </div>
                    )}

                    <button data-animate onClick={() => navigate('/wardrobe')} style={{
                        background: '#71b3e5', border: 'none', borderRadius: 999,
                        padding: '16px 36px', cursor: 'pointer',
                        fontFamily: theme.fontFamily.ui, fontWeight: 700, fontSize: 15,
                        color: 'white', boxShadow: '0 8px 24px rgba(113,179,229,0.4)',
                    }}>
                        내 옷장에 추가하기 →
                    </button>
                </div>
            </section>

            {/* ── 05 CALENDAR ──────────────────────────────────────────────── */}
            <section ref={calendarSecRef} style={{ padding: '100px 80px 100px 120px', background: '#f5f7fa' }}>
                <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                    <p data-animate style={{ fontFamily: theme.fontFamily.body, fontWeight: 700, fontSize: 10, color: '#71b3e5', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 16px' }}>
                        05 CALENDAR
                    </p>
                    <h2 data-animate style={{ fontFamily: theme.fontFamily.heading, fontWeight: 700, fontSize: 40, color: '#1a1a2e', margin: '0 0 16px', lineHeight: 1.3 }}>
                        좋았던 코디는<br />다시 꺼내 입을 수 있도록<br />기록해요.
                    </h2>
                    <p data-animate style={{ fontFamily: theme.fontFamily.body, fontSize: 16, color: '#888', margin: '0 0 56px', lineHeight: 1.7 }}>
                        날짜별 코디를 기록하고 언제든 꺼내볼 수 있어요.
                    </p>

                    {recentOutfits.length > 0 ? (
                        <div data-animate style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20, marginBottom: 48 }}>
                            {recentOutfits.map((outfit, i) => {
                                const [y, m, d] = outfit.outfitDate.split('-').map(Number);
                                const dt    = new Date(y, m - 1, d);
                                const label = `${m}월 ${d}일 (${WEEKDAYS[dt.getDay()]})`;
                                const thumb = outfit.matchedItems?.[0]?.imageUrl;
                                return (
                                    <div key={i} className="wardrobe-card" style={{
                                        background: 'white', borderRadius: 20, overflow: 'hidden',
                                        border: '1px solid #eaedf2', cursor: 'pointer',
                                    }} onClick={() => navigate('/calendar')}>
                                        <div style={{ height: 160, overflow: 'hidden', background: 'linear-gradient(135deg, #d4eaf9, #e8f4fd)' }}>
                                            {thumb
                                                ? <img src={thumb} alt="코디" className="wardrobe-card-img" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><WardrobeIcon color="#71b3e5" size={40} /></div>
                                            }
                                        </div>
                                        <div style={{ padding: '16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                                <CalendarIcon color="#71b3e5" size={14} />
                                                <span style={{ fontFamily: theme.fontFamily.body, fontWeight: 600, fontSize: 12, color: '#71b3e5' }}>{label}</span>
                                            </div>
                                            {outfit.description && (
                                                <p style={{
                                                    fontFamily: theme.fontFamily.ui, fontSize: 13, color: '#555',
                                                    margin: 0, lineHeight: 1.5,
                                                    overflow: 'hidden', display: '-webkit-box',
                                                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                                                }}>{outfit.description}</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div data-animate style={{ background: 'white', borderRadius: 24, padding: '56px', textAlign: 'center', border: '2px dashed #eaedf2', marginBottom: 48 }}>
                            <CalendarIcon color="#ddd" size={56} />
                            <p style={{ fontFamily: theme.fontFamily.ui, fontSize: 16, color: '#ccc', margin: '16px 0 0' }}>
                                아직 기록된 코디가 없어요
                            </p>
                        </div>
                    )}

                    <button data-animate onClick={() => navigate('/calendar')} style={{
                        background: 'white', border: '2px solid #71b3e5', borderRadius: 999,
                        padding: '16px 36px', cursor: 'pointer',
                        fontFamily: theme.fontFamily.ui, fontWeight: 700, fontSize: 15, color: '#71b3e5',
                        transition: 'background 0.2s, color 0.2s',
                    }}
                    onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = '#71b3e5'; b.style.color = 'white'; }}
                    onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'white'; b.style.color = '#71b3e5'; }}>
                        캘린더에서 보기 →
                    </button>
                </div>
            </section>

            {/* ── CTA ──────────────────────────────────────────────────────── */}
            <section style={{ position: 'relative', height: 480, overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0 }}>
                    <img src="/img/t-royce-xan-60Yd2BmI8mk-unsplash.jpg" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,26,46,0.68)' }} />
                </div>
                <div style={{
                    position: 'relative', height: '100%',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    textAlign: 'center', padding: '0 40px',
                }}>
                    <h2 style={{ fontFamily: theme.fontFamily.heading, fontWeight: 700, fontSize: 44, color: 'white', margin: '0 0 20px', lineHeight: 1.2 }}>
                        오늘의 완벽한 코디,<br />AI와 함께 찾아보세요
                    </h2>
                    <p style={{ fontFamily: theme.fontFamily.body, fontSize: 18, color: 'rgba(255,255,255,0.72)', margin: '0 0 40px' }}>
                        날씨와 일정을 분석해 오늘 최고의 코디를 찾아드릴게요.
                    </p>
                    <div style={{ display: 'flex', gap: 16 }}>
                        <button onClick={() => navigate('/recommend')} style={{
                            background: '#71b3e5', border: 'none', borderRadius: 999,
                            padding: '16px 40px', cursor: 'pointer',
                            fontFamily: theme.fontFamily.ui, fontWeight: 700, fontSize: 16,
                            color: 'white', boxShadow: '0 8px 24px rgba(113,179,229,0.5)',
                        }}>
                            AI 추천 전체 보기 →
                        </button>
                        <button onClick={() => navigate('/wardrobe')} style={{
                            background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(8px)',
                            border: '1.5px solid rgba(255,255,255,0.38)', borderRadius: 999,
                            padding: '16px 36px', cursor: 'pointer',
                            fontFamily: theme.fontFamily.ui, fontWeight: 600, fontSize: 15,
                            color: 'white',
                        }}>
                            내 옷장 보러가기
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
}

export default Home;
