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
    eventId: string;
    eventName: string;
    eventDatetime: string;
    tpoKeyword: string;
}
interface OutfitItem {
    type?: string;
    color?: string;
}
interface MatchedItem {
    id?: string;
    category?: string;
    type?: string;
    color?: string;
    imageUrl?: string;
    imageB64?: string;
    matched?: boolean;
}
interface Outfit {
    top?: OutfitItem;
    bottom?: OutfitItem;
    outer?: OutfitItem;
    description?: string;
    style?: string;
}
interface Recommendation {
    recId?: string | number;   // /wardrobe/recommend 응답에 포함되는 추천 ID (코디 선택 시 필요)
    outfits?: Outfit[];
    matched_items_per_outfit?: MatchedItem[][];
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
    style?: string;
    // 선택한 코디의 흰 배경 합성 이미지. compositeStatus: PENDING(생성 중) / DONE / FAILED / SKIPPED
    // DONE이 아니면 compositeImageUrl은 null이므로 matchedItems 썸네일로 대체.
    compositeImageUrl?: string | null;
    compositeStatus?: 'PENDING' | 'DONE' | 'FAILED' | 'SKIPPED' | null;
}

// 합성 이미지 생성 중(PENDING)일 때 다시 조회하는 간격/최대 횟수
const COMPOSITE_POLL_INTERVAL_MS = 4000;
const COMPOSITE_POLL_MAX_TRIES   = 45;   // 4초 x 45 = 약 3분 (서버 읽기 타임아웃 180초와 맞춤)

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
    const [colorType, setColorType] = useState<string>(localStorage.getItem('colorType') || '');

    useEffect(() => {
        const load = () => setColorType(localStorage.getItem('colorType') || '');
        window.addEventListener('colorTypeUpdated', load);
        return () => window.removeEventListener('colorTypeUpdated', load);
    }, []);

    const hasColorDeficiency = colorType && colorType !== 'normal';

    const [weather, setWeather]             = useState<Weather | null>(null);
    const [todayEvents, setTodayEvents]     = useState<CalendarEvent[]>([]);
    const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
    const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([]);
    const [recentOutfits, setRecentOutfits] = useState<WeekOutfit[]>([]);
    const [todayOutfit, setTodayOutfit]     = useState<WeekOutfit | null>(null);   // 오늘 선택한 코디 (Hero용)
    const pollTriesRef = useRef(0);
    const [selectedTpo, setSelectedTpo]     = useState<string>('일상');
    const [customTpo, setCustomTpo]         = useState<string>('');
    const [numOutfits, setNumOutfits]       = useState<number>(2);
    const [acceptedOutfitIdx, setAcceptedOutfitIdx] = useState<number | null>(null);
    const [loading, setLoading]             = useState(false);
    const [aiStep, setAiStep]               = useState<number>(-1);
    const [activeSection, setActiveSection] = useState<string>('hero');
    const [carouselIdx, setCarouselIdx] = useState(0);
    const carouselInitRef = useRef(false);

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
            const all: WardrobeItem[] = res.data || [];
            setWardrobeItems(all.filter(i => i.category !== '저장한 코디').slice(0, 6));
        } catch {}
    }, []);

    const fetchRecentOutfits = useCallback(async () => {
        try {
            const sevenDaysAgo = new Date(today);
            sevenDaysAgo.setDate(today.getDate() - 6);
            const start = toDateStr(sevenDaysAgo);
            const end   = toDateStr(today);
            const res   = await recommendationAPI.getWeekOutfits(start, end);
            const all: WeekOutfit[] = res.data || [];
            const sorted = [...all].sort((a, b) => a.outfitDate.localeCompare(b.outfitDate));
            setRecentOutfits(sorted.slice(0, 7));
            const todayStr = toDateStr(today);
            setTodayOutfit(sorted.find(o => o.outfitDate === todayStr) || null);
        } catch {}
    }, [today]);

    useEffect(() => {
        fetchWeather();
        fetchCalendarData();
        fetchWardrobeItems();
        fetchRecentOutfits();
    }, [fetchWeather, fetchCalendarData, fetchWardrobeItems, fetchRecentOutfits]);

    // 오늘 코디가 있으면 캐러셀을 오늘 위치로 초기화
    useEffect(() => {
        if (recentOutfits.length > 0 && !carouselInitRef.current) {
            carouselInitRef.current = true;
            const idx = recentOutfits.findIndex(o => o.outfitDate === toDateStr(today));
            if (idx >= 0) setCarouselIdx(idx);
        }
    }, [recentOutfits, today]);

    // 합성 이미지가 아직 생성 중(PENDING)이면 일정 간격으로 다시 조회.
    // PENDING이 없으면 조회하지 않고, 최대 횟수를 넘으면 stop. (서버가 중간에 재시작돼 PENDING이 남은 경우 대비)
    const hasPendingComposite =
        todayOutfit?.compositeStatus === 'PENDING' ||
        recentOutfits.some(o => o.compositeStatus === 'PENDING');

    useEffect(() => {
        if (!hasPendingComposite) { pollTriesRef.current = 0; return; }
        if (pollTriesRef.current >= COMPOSITE_POLL_MAX_TRIES) return;
        const timer = setTimeout(() => {
            pollTriesRef.current += 1;
            fetchRecentOutfits();
        }, COMPOSITE_POLL_INTERVAL_MS);
        return () => clearTimeout(timer);
    }, [hasPendingComposite, todayOutfit, recentOutfits, fetchRecentOutfits]);

    // ── 코디 선택 (서버에 저장 → 합성 이미지 비동기 생성) ───────────────────────

    const handleAcceptOutfit = useCallback(async (idx: number) => {
        const outfit = recommendation?.outfits?.[idx];
        const recId  = recommendation?.recId;
        if (recId == null) {
            // recId가 없으면 서버에 저장할 수 없으므로 화면 표시만 변경.
            setAcceptedOutfitIdx(idx);
            return;
        }
        try {
            await recommendationAPI.acceptOutfit(recId as number, {
                outfitIndex: idx,
                style: outfit?.style || '',
                description: outfit?.description || '',
            });
            setAcceptedOutfitIdx(idx);
            pollTriesRef.current = 0;      // 새로 선택했으니 조회 횟수 초기화
            await fetchRecentOutfits();    // PENDING 상태를 받아오면 위 effect가 자동 조회 이어감.
        } catch {
            alert('코디 선택에 실패했어요. 잠시 후 다시 시도해 주세요.');
        }
    }, [recommendation, fetchRecentOutfits]);

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
        setAcceptedOutfitIdx(null);
        setAiStep(0);
        const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
        try {
            await delay(500); setAiStep(1);
            await delay(500); setAiStep(2);
            const body = {
                tpo: selectedTpo,
                mode: 'rag',
                numOutfits,
                outfitDate: toDateStr(today),   // 날짜가 없으면 날짜별 코디 목록(/week)에 나오지 않음.
                linkedEvents: todayEvents.slice(0, 1).map(e => e.eventId),
                ...(customTpo.trim() ? { tpoDetail: customTpo.trim() } : {}),
            };
            const [res] = await Promise.all([wardrobeAPI.recommend(body), delay(700)]);
            setAiStep(3);
            await delay(400);
            setRecommendation(res.data);
        } catch {}
        finally { setLoading(false); }
    }, [loading, selectedTpo, customTpo, numOutfits, todayEvents, today]);

    // ── Derived values ─────────────────────────────────────────────────────────

    const weatherGradient = weather ? getWeatherGradient(weather.desc) : 'linear-gradient(160deg, #71b3e5 0%, #bfdbfe 60%, #fff9e6 100%)';
    const heroTextColor   = weather ? getHeroTextColor(weather.desc) : 'white';
    const todayLabel      = `${today.getMonth() + 1}월 ${today.getDate()}일 (${WEEKDAYS[today.getDay()]})`;

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
                        { label: 'MY CLOSET',    fn: () => navigate('/wardrobe') },
                        { label: 'CALENDAR',     fn: () => navigate('/calendar') },
                        { label: 'AI RECOMMEND', fn: () => navigate('/recommend') },
                        ...(hasColorDeficiency ? [{ label: 'COLOR VISION', fn: () => navigate('/color-correction') }] : []),
                        { label: 'PROFILE',      fn: () => navigate('/mypage') },
                    ] as { label: string; fn: () => void }[]).map(({ label, fn }) => (
                        <button key={label} onClick={fn} style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
                            fontWeight: 600, fontSize: 11,
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
                                fontWeight: 700, fontSize: 8,
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
                    display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 60, alignItems: 'center',
                }}>
                    {/* Left */}
                    <div>
                        <p style={{
                            fontWeight: 600, fontSize: 11,
                            color: heroSubColor, letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 20px',
                        }}>
                            {todayLabel}
                            {weather && <span style={{ marginLeft: 14 }}>{Math.round(weather.temp)}℃ · {weather.desc}</span>}
                        </p>
                        <h1 style={{
                            fontWeight: 700,
                            fontSize: 52, lineHeight: 1.15, color: heroTextColor,
                            margin: '0 0 24px', letterSpacing: '-1px',
                        }}>
                            안녕하세요,<br />{nickname}님
                        </h1>
                        <p style={{
                            fontWeight: 400, fontSize: 19,
                            color: heroSubColor, margin: '0 0 44px', lineHeight: 1.65,
                        }}>
                            {weather
                                ? getWeatherMessage(weather.temp, weather.desc)
                                : '오늘의 날씨와 일정을 분석해 코디를 추천해 드려요.'}
                        </p>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            {todayEvents[0] && (
                                <button onClick={() => scrollTo('tpo')} style={{
                                    background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)',
                                    border: '1.5px solid rgba(255,255,255,0.45)', borderRadius: 999,
                                    padding: '16px 28px', cursor: 'pointer',
                                    fontWeight: 600, fontSize: 14,
                                    color: heroTextColor,
                                }}>
                                    {todayEvents[0].eventName} 코디
                                </button>
                            )}
                            {!todayOutfit && (
                                <button onClick={() => scrollTo('tpo')} style={{
                                    background: 'linear-gradient(135deg, rgba(113,179,229,0.85), rgba(90,159,212,0.85))',
                                    backdropFilter: 'blur(8px)',
                                    border: '1.5px solid rgba(255,255,255,0.45)', borderRadius: 999,
                                    padding: '16px 28px', cursor: 'pointer',
                                    fontWeight: 700, fontSize: 14,
                                    color: 'white',
                                    display: 'inline-flex', alignItems: 'center', gap: 8,
                                    boxShadow: '0 4px 16px rgba(113,179,229,0.35)',
                                }}>
                                    <SparkleIcon color="white" size={16} />
                                    오늘 코디 AI 추천 받기
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Right: Outfit Carousel */}
                    {(() => {
                        const CW = 300, CH = 420, GAP = 14, VP = 500;
                        const center = (VP - CW) / 2;
                        const tx = -(carouselIdx * (CW + GAP)) + center;
                        const cards: (WeekOutfit | null)[] = [...recentOutfits, null];
                        const goPrev = () => setCarouselIdx(i => Math.max(0, i - 1));
                        const goNext = () => setCarouselIdx(i => Math.min(cards.length - 1, i + 1));
                        const canPrev = carouselIdx > 0;
                        const canNext = carouselIdx < cards.length - 1;

                        return (
                            <div>
                                <p style={{
                                    fontWeight: 700, fontSize: 11, color: heroSubColor,
                                    letterSpacing: '0.1em', textTransform: 'uppercase',
                                    margin: '0 0 18px',
                                }}>
                                    이번 주 코디
                                </p>
                                <div style={{ position: 'relative', width: VP }}>
                                    {/* Viewport */}
                                    <div style={{ overflow: 'hidden', width: VP }}>
                                        <div style={{
                                            display: 'flex',
                                            gap: GAP,
                                            transform: `translateX(${tx}px)`,
                                            transition: 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                                            willChange: 'transform',
                                        }}>
                                            {cards.map((outfit, i) => {
                                                const isActive = i === carouselIdx;
                                                const dist = Math.abs(i - carouselIdx);
                                                const scale = isActive ? 1 : 0.88;
                                                const opacity = dist > 1 ? 0 : isActive ? 1 : 0.62;

                                                /* ── 더 많은 코디 보기 카드 ── */
                                                if (outfit === null) {
                                                    return (
                                                        <div
                                                            key="more"
                                                            onClick={() => navigate('/calendar')}
                                                            style={{
                                                                flexShrink: 0, width: CW, height: CH,
                                                                borderRadius: 22,
                                                                background: 'rgba(113,179,229,0.82)',
                                                                backdropFilter: 'blur(10px)',
                                                                border: '1.5px solid rgba(255,255,255,0.5)',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                cursor: 'pointer',
                                                                transform: `scale(${scale}) translateY(${isActive ? 0 : 14}px)`,
                                                                opacity,
                                                                transition: 'transform 0.4s ease, opacity 0.4s ease',
                                                                transformOrigin: 'center top',
                                                            }}
                                                        >
                                                            <div style={{ textAlign: 'center', color: 'white', padding: 20 }}>
                                                                <CalendarIcon color="white" size={38} />
                                                                <p style={{ fontWeight: 700, fontSize: 16, margin: '14px 0 6px', lineHeight: 1.4 }}>
                                                                    더 많은<br />코디 보기
                                                                </p>
                                                                <p style={{ fontSize: 14, opacity: 0.85, margin: 0 }}>→</p>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                /* ── 코디 카드 ── */
                                                const [yy, mm, dd] = outfit.outfitDate.split('-').map(Number);
                                                const isToday = outfit.outfitDate === toDateStr(today);
                                                const composite = outfit.compositeStatus === 'DONE' ? outfit.compositeImageUrl : null;
                                                const items = outfit.matchedItems || [];

                                                return (
                                                    <div
                                                        key={i}
                                                        onClick={() => navigate('/calendar')}
                                                        style={{
                                                            flexShrink: 0, width: CW,
                                                            borderRadius: 22,
                                                            background: 'rgba(255,255,255,0.88)',
                                                            backdropFilter: 'blur(10px)',
                                                            border: '1.5px solid rgba(255,255,255,0.5)',
                                                            transform: `scale(${scale}) translateY(${isActive ? 0 : 14}px)`,
                                                            opacity,
                                                            filter: isActive ? 'none' : 'grayscale(25%) brightness(0.9)',
                                                            transition: 'transform 0.4s ease, opacity 0.4s ease',
                                                            overflow: 'hidden',
                                                            cursor: 'pointer',
                                                            transformOrigin: 'center top',
                                                        }}
                                                    >
                                                        {/* 의류 아이템 */}
                                                        <div style={{ height: CH * 0.75, background: 'rgba(240,245,250,0.6)', position: 'relative', overflow: 'hidden' }}>
                                                            {composite ? (
                                                                <img src={composite} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                                            ) : items.length > 0 ? (
                                                                <>
                                                                    {items[0]?.imageUrl && (
                                                                        <img src={items[0].imageUrl} alt="" style={{
                                                                            position: 'absolute', left: '4%', top: '6%',
                                                                            width: '54%', height: '82%', objectFit: 'contain',
                                                                        }} />
                                                                    )}
                                                                    {items[1]?.imageUrl && (
                                                                        <img src={items[1].imageUrl} alt="" style={{
                                                                            position: 'absolute', right: '4%', top: '4%',
                                                                            width: '38%', height: '46%', objectFit: 'contain',
                                                                        }} />
                                                                    )}
                                                                    {items[2]?.imageUrl && (
                                                                        <img src={items[2].imageUrl} alt="" style={{
                                                                            position: 'absolute', right: '4%', bottom: '4%',
                                                                            width: '38%', height: '46%', objectFit: 'contain',
                                                                        }} />
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                    <WardrobeIcon color="#c8ddef" size={52} />
                                                                </div>
                                                            )}
                                                            {isToday && (
                                                                <div style={{
                                                                    position: 'absolute', top: 12, left: 12,
                                                                    background: '#71b3e5', color: 'white',
                                                                    fontSize: 13, fontWeight: 700,
                                                                    padding: '5px 14px', borderRadius: 20,
                                                                }}>오늘</div>
                                                            )}
                                                        </div>

                                                        {/* 텍스트 영역 */}
                                                        <div style={{ padding: '14px 18px 18px' }}>
                                                            <p style={{ fontWeight: 700, fontSize: 14, color: '#1a1a2e', margin: '0 0 6px' }}>
                                                                {mm}월 {dd}일 코디
                                                            </p>
                                                            {(outfit.description || outfit.style) && (
                                                                <p style={{
                                                                    fontSize: 12, color: '#666', lineHeight: 1.55, margin: 0,
                                                                    overflow: 'hidden',
                                                                    display: '-webkit-box',
                                                                    WebkitLineClamp: 2,
                                                                    WebkitBoxOrient: 'vertical',
                                                                } as React.CSSProperties}>
                                                                    "{outfit.description || outfit.style}"
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* ← 왼쪽 화살표 */}
                                    <button
                                        onClick={goPrev}
                                        style={{
                                            position: 'absolute', left: 8, top: '44%',
                                            transform: 'translateY(-50%)',
                                            zIndex: 10, width: 36, height: 36, borderRadius: '50%',
                                            background: 'rgba(255,255,255,0.92)',
                                            border: 'none', cursor: 'pointer',
                                            fontSize: 18, color: '#1a1a2e',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
                                            opacity: canPrev ? 1 : 0,
                                            pointerEvents: canPrev ? 'auto' : 'none',
                                            transition: 'opacity 0.2s',
                                        }}
                                    >‹</button>

                                    {/* → 오른쪽 화살표 */}
                                    <button
                                        onClick={goNext}
                                        style={{
                                            position: 'absolute', right: 8, top: '44%',
                                            transform: 'translateY(-50%)',
                                            zIndex: 10, width: 36, height: 36, borderRadius: '50%',
                                            background: 'rgba(255,255,255,0.92)',
                                            border: 'none', cursor: 'pointer',
                                            fontSize: 18, color: '#1a1a2e',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
                                            opacity: canNext ? 1 : 0,
                                            pointerEvents: canNext ? 'auto' : 'none',
                                            transition: 'opacity 0.2s',
                                        }}
                                    >›</button>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </section>

            {/* ── 01 WEATHER ───────────────────────────────────────────────── */}
            <section ref={weatherSecRef} style={{ padding: '100px 80px 100px 120px', background: 'white' }}>
                <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                    <p data-animate style={{  fontWeight: 700, fontSize: 10, color: '#71b3e5', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 16px' }}>
                        01 WEATHER
                    </p>
                    {weather ? (
                        <div data-animate style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 72, alignItems: 'center' }}>
                            <div style={{ textAlign: 'center' }}>
                                <WeatherIcon desc={weather.desc} size={96} />
                                <p style={{  fontWeight: 700, fontSize: 72, color: '#1a1a2e', margin: '12px 0 0', lineHeight: 1 }}>
                                    {Math.round(weather.temp)}<span style={{ fontSize: 36 }}>℃</span>
                                </p>
                                <p style={{  fontSize: 16, color: '#888', margin: '8px 0 0' }}>{weather.desc}</p>
                            </div>
                            <div>
                                <h2 style={{  fontWeight: 700, fontSize: 36, color: '#1a1a2e', lineHeight: 1.3, margin: '0 0 32px' }}>
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
                                            <p style={{  fontSize: 11, color: '#aaa', margin: 0 }}>{label}</p>
                                            <p style={{  fontWeight: 700, fontSize: 22, color: '#1a1a2e', margin: '6px 0 0' }}>{val}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p data-animate style={{  fontSize: 16, color: '#aaa' }}>날씨 정보를 불러오는 중이에요...</p>
                    )}
                </div>
            </section>

            {/* ── 02 TPO ───────────────────────────────────────────────────── */}
            <section ref={tpoRef} style={{ padding: '100px 80px 100px 120px', background: '#f5f7fa' }}>
                <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                    <p data-animate style={{  fontWeight: 700, fontSize: 10, color: '#71b3e5', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 16px' }}>
                        02 TPO
                    </p>
                    <h2 data-animate style={{  fontWeight: 700, fontSize: 40, color: '#1a1a2e', margin: '0 0 14px' }}>
                        오늘은 어디에 가나요?
                    </h2>
                    {todayEvents.length > 0 && (
                        <p data-animate style={{  fontSize: 15, color: '#888', margin: '0 0 40px' }}>
                            오늘 일정: {todayEvents.map(e => e.eventName).join(', ')}
                        </p>
                    )}
                    <div data-animate style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: `${todayEvents.length ? 0 : 40}px 0 32px` }}>
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
                                        fontWeight: active ? 700 : 500, fontSize: 15,
                                        color: active ? color : '#666',
                                    }}>{key}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* 자유 문장 입력 */}
                    <div data-animate style={{ marginBottom: 28 }}>
                        <p style={{ fontWeight: 600, fontSize: 13, color: '#888', margin: '0 0 10px' }}>
                            상황을 더 자세히 알려주세요 <span style={{ fontWeight: 400, color: '#bbb' }}>(선택)</span>
                        </p>
                        <input
                            type="text"
                            value={customTpo}
                            onChange={e => setCustomTpo(e.target.value)}
                            placeholder="예: 야외 피크닉, 격식 있는 회의, 친구 생일파티..."
                            maxLength={100}
                            style={{
                                width: '100%', maxWidth: 560, boxSizing: 'border-box',
                                padding: '14px 18px', borderRadius: 14,
                                border: '1.5px solid #e0e4ea', outline: 'none',
                                fontSize: 15, color: '#1a1a2e',
                                background: 'white',
                                transition: 'border-color 0.2s',
                            }}
                            onFocus={e => { e.currentTarget.style.borderColor = '#71b3e5'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = '#e0e4ea'; }}
                        />
                    </div>

                    {/* 코디 수 선택 */}
                    <div data-animate style={{ marginBottom: 40 }}>
                        <p style={{ fontWeight: 600, fontSize: 13, color: '#888', margin: '0 0 10px' }}>
                            추천받을 코디 수
                        </p>
                        <div style={{ display: 'flex', gap: 10 }}>
                            {[2, 3].map(n => (
                                <button key={n} onClick={() => setNumOutfits(n)} style={{
                                    padding: '10px 28px', borderRadius: 999, cursor: 'pointer',
                                    border: numOutfits === n ? '2px solid #71b3e5' : '1.5px solid #e0e4ea',
                                    background: numOutfits === n ? 'rgba(113,179,229,0.1)' : 'white',
                                    fontWeight: numOutfits === n ? 700 : 500, fontSize: 14,
                                    color: numOutfits === n ? '#71b3e5' : '#666',
                                    transition: 'all 0.2s',
                                }}>
                                    {n}가지
                                </button>
                            ))}
                        </div>
                    </div>

                    <button data-animate onClick={() => { scrollTo('recommendation'); fetchRecommendation(); }} style={{
                        background: 'linear-gradient(135deg, #71b3e5, #5a9fd4)',
                        border: 'none', borderRadius: 999,
                        padding: '18px 48px', cursor: 'pointer',
                        fontWeight: 700, fontSize: 16,
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
                    <p data-animate style={{  fontWeight: 700, fontSize: 10, color: '#71b3e5', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 16px' }}>
                        03 RECOMMENDATION
                    </p>
                    <h2 data-animate style={{  fontWeight: 700, fontSize: 40, color: '#1a1a2e', margin: '0 0 56px' }}>
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
                                            : <span style={{  fontWeight: 700, fontSize: 14, color: '#bbb' }}>{i + 1}</span>
                                        }
                                    </div>
                                    <span style={{

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
                            <p style={{ fontSize: 16, color: '#ccc', margin: '16px 0 0' }}>
                                위에서 TPO를 선택하고 추천받기를 눌러보세요
                            </p>
                        </div>
                    ) : recommendation ? (
                        <div data-animate>
                            {/* 헤더 */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 32 }}>
                                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #71b3e5, #5a9fd4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <SparkleIcon color="white" size={22} />
                                </div>
                                <div>
                                    <p style={{ fontWeight: 700, fontSize: 11, color: '#71b3e5', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>오늘의 추천 코디</p>
                                    <p style={{ fontWeight: 700, fontSize: 22, color: '#1a1a2e', margin: '4px 0 0' }}>{selectedTpo} 스타일 · {(recommendation.outfits || []).length}가지</p>
                                </div>
                            </div>

                            {/* 코디 카드 목록 */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                {(recommendation.outfits || []).map((outfit, idx) => {
                                    const matchedList = recommendation.matched_items_per_outfit?.[idx] || [];
                                    const byCategory: Record<string, MatchedItem> = {};
                                    matchedList.forEach(m => { if (m.category) byCategory[m.category] = m; });
                                    const slots = ([
                                        { label: '상의',   item: outfit.top },
                                        { label: '하의',   item: outfit.bottom },
                                        { label: '아우터', item: outfit.outer },
                                    ] as { label: string; item: OutfitItem | undefined }[]).filter(s => s.item);
                                    const isAccepted = acceptedOutfitIdx === idx;
                                    const isOther    = acceptedOutfitIdx !== null && !isAccepted;
                                    return (
                                        <div key={idx} style={{
                                            background: isAccepted
                                                ? 'linear-gradient(135deg, #d4eaf9 0%, #e8f4ff 100%)'
                                                : 'linear-gradient(135deg, #f4f7fb 0%, #edf1f7 100%)',
                                            borderRadius: 24, overflow: 'hidden',
                                            border: `2px solid ${isAccepted ? '#71b3e5' : '#dde3ea'}`,
                                            opacity: isOther ? 0.55 : 1,
                                            transition: 'opacity 0.3s, border-color 0.3s',
                                            boxShadow: isAccepted ? '0 4px 20px rgba(113,179,229,0.18)' : '0 2px 10px rgba(0,0,0,0.05)',
                                        }}>
                                            {/* 카드 헤더 */}
                                            <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <div style={{
                                                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                                                    background: isAccepted ? 'linear-gradient(135deg, #71b3e5, #5a9fd4)' : '#dde3ea',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontWeight: 900, fontSize: 15, color: 'white',
                                                }}>
                                                    {idx + 1}
                                                </div>
                                                {outfit.style && (
                                                    <span style={{ fontWeight: 700, fontSize: 16, color: isAccepted ? '#1a1a2e' : '#555' }}>{outfit.style}</span>
                                                )}
                                                {isAccepted && (
                                                    <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 11, color: '#71b3e5', background: 'white', border: '1.5px solid #71b3e5', padding: '3px 10px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                        <CheckIcon color="#71b3e5" size={11} /> 선택됨
                                                    </span>
                                                )}
                                            </div>

                                            {/* 아이템 이미지 그리드 */}
                                            {slots.length > 0 && (
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, padding: '16px 24px' }}>
                                                    {slots.map(({ label, item }) => {
                                                        const matched = byCategory[label];
                                                        const imgSrc  = matched?.imageUrl || matched?.imageB64;
                                                        return (
                                                            <div key={label} style={{ background: 'white', borderRadius: 16, padding: '16px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                                                                <div style={{ aspectRatio: '1', borderRadius: 12, overflow: 'hidden', marginBottom: 10, background: 'rgba(113,179,229,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                    {imgSrc
                                                                        ? <img src={imgSrc} alt={matched?.type || item?.type} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                        : <WardrobeIcon color="#71b3e5" size={32} />
                                                                    }
                                                                </div>
                                                                <p style={{ fontWeight: 700, fontSize: 9, color: '#71b3e5', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
                                                                <p style={{ fontWeight: 600, fontSize: 13, color: '#1a1a2e', margin: 0 }}>{matched?.type || item?.type}</p>
                                                                {(matched?.color || item?.color) && <p style={{ fontSize: 11, color: '#aaa', margin: '3px 0 0' }}>{matched?.color || item?.color}</p>}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* 설명 */}
                                            {outfit.description && (
                                                <div style={{ margin: '0 24px 16px', background: 'white', borderRadius: 12, padding: '14px 16px', borderLeft: '3px solid #71b3e5', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                                                    <p style={{ fontSize: 13, color: '#555', lineHeight: 1.7, margin: 0 }}>"{outfit.description}"</p>
                                                </div>
                                            )}

                                            {/* 선택 버튼 */}
                                            <div style={{ padding: '0 24px 20px' }}>
                                                {!isAccepted ? (
                                                    <button onClick={() => handleAcceptOutfit(idx)} style={{
                                                        width: '100%', padding: '13px',
                                                        background: 'linear-gradient(135deg, #71b3e5, #5a9fd4)',
                                                        color: 'white', border: 'none', borderRadius: 12,
                                                        fontWeight: 700, fontSize: 14, cursor: 'pointer',
                                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                                                    }}>
                                                        <CheckIcon color="white" size={15} /> 이 코디 선택
                                                    </button>
                                                ) : (
                                                    <div style={{ padding: '13px', background: 'rgba(113,179,229,0.12)', borderRadius: 12, textAlign: 'center' }}>
                                                        <span style={{ fontWeight: 700, fontSize: 14, color: '#71b3e5', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                            선택한 코디예요 <CheckIcon color="#71b3e5" size={15} />
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
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
                    <p data-animate style={{  fontWeight: 700, fontSize: 10, color: '#71b3e5', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 16px' }}>
                        04 CLOSET
                    </p>
                    <h2 data-animate style={{  fontWeight: 700, fontSize: 40, color: 'white', margin: '0 0 16px', lineHeight: 1.3 }}>
                        새 옷을 사지 않아도<br />내 옷장 안에서<br />오늘의 답을 찾을 수 있어요.
                    </h2>
                    <p data-animate style={{  fontSize: 16, color: 'rgba(255,255,255,0.55)', margin: '0 0 48px', lineHeight: 1.7 }}>
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
                                        <p style={{  fontWeight: 600, fontSize: 10, color: '#71b3e5', margin: 0, textTransform: 'uppercase' }}>{item.category}</p>
                                        <p style={{  fontWeight: 600, fontSize: 13, color: 'white', margin: '4px 0 0' }}>{item.type || '아이템'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div data-animate style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: '48px', textAlign: 'center', marginBottom: 48, border: '1px dashed rgba(255,255,255,0.15)' }}>
                            <WardrobeIcon color="rgba(255,255,255,0.2)" size={56} />
                            <p style={{  fontSize: 15, color: 'rgba(255,255,255,0.35)', margin: '16px 0 0' }}>
                                아직 등록된 옷이 없어요
                            </p>
                        </div>
                    )}

                    <button data-animate onClick={() => navigate('/wardrobe')} style={{
                        background: '#71b3e5', border: 'none', borderRadius: 999,
                        padding: '16px 36px', cursor: 'pointer',
                        fontWeight: 700, fontSize: 15,
                        color: 'white', boxShadow: '0 8px 24px rgba(113,179,229,0.4)',
                    }}>
                        내 옷장에 추가하기 →
                    </button>
                </div>
            </section>

            {/* ── 05 CALENDAR ──────────────────────────────────────────────── */}
            <section ref={calendarSecRef} style={{ padding: '100px 80px 100px 120px', background: '#f5f7fa' }}>
                <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                    <p data-animate style={{  fontWeight: 700, fontSize: 10, color: '#71b3e5', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 16px' }}>
                        05 CALENDAR
                    </p>
                    <h2 data-animate style={{  fontWeight: 700, fontSize: 40, color: '#1a1a2e', margin: '0 0 16px', lineHeight: 1.3 }}>
                        좋았던 코디는<br />다시 꺼내 입을 수 있도록<br />기록해요.
                    </h2>
                    <p data-animate style={{  fontSize: 16, color: '#888', margin: '0 0 56px', lineHeight: 1.7 }}>
                        날짜별 코디를 기록하고 언제든 꺼내볼 수 있어요.
                    </p>

                    <div data-animate style={{ display: 'flex', gap: 16, marginBottom: 48, flexWrap: 'wrap' }}>
                        <button data-animate onClick={() => navigate('/calendar')} style={{
                            background: 'white', border: '2px solid #71b3e5', borderRadius: 999,
                            padding: '16px 36px', cursor: 'pointer',
                            fontWeight: 700, fontSize: 15, color: '#71b3e5',
                            transition: 'background 0.2s, color 0.2s',
                        }}
                            onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = '#71b3e5'; b.style.color = 'white'; }}
                            onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'white'; b.style.color = '#71b3e5'; }}>
                            캘린더에서 전체 보기 →
                        </button>
                        {recentOutfits.length === 0 && (
                            <button onClick={() => scrollTo('tpo')} style={{
                                background: 'linear-gradient(135deg, #71b3e5, #5a9fd4)',
                                border: 'none', borderRadius: 999,
                                padding: '16px 36px', cursor: 'pointer',
                                fontWeight: 700, fontSize: 15, color: 'white',
                                display: 'inline-flex', alignItems: 'center', gap: 8,
                                boxShadow: '0 4px 16px rgba(113,179,229,0.3)',
                            }}>
                                <SparkleIcon color="white" size={16} />
                                AI 추천 받기
                            </button>
                        )}
                    </div>
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
                    <h2 style={{  fontWeight: 700, fontSize: 44, color: 'white', margin: '0 0 20px', lineHeight: 1.2 }}>
                        오늘의 완벽한 코디,<br />AI와 함께 찾아보세요
                    </h2>
                    <p style={{  fontSize: 18, color: 'rgba(255,255,255,0.72)', margin: '0 0 40px' }}>
                        날씨와 일정을 분석해 오늘 최고의 코디를 찾아드릴게요.
                    </p>
                    <div style={{ display: 'flex', gap: 16 }}>
                        <button onClick={() => navigate('/recommend')} style={{
                            background: '#71b3e5', border: 'none', borderRadius: 999,
                            padding: '16px 40px', cursor: 'pointer',
                            fontWeight: 700, fontSize: 16,
                            color: 'white', boxShadow: '0 8px 24px rgba(113,179,229,0.5)',
                        }}>
                            AI 추천 전체 보기 →
                        </button>
                        <button onClick={() => navigate('/wardrobe')} style={{
                            background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(8px)',
                            border: '1.5px solid rgba(255,255,255,0.38)', borderRadius: 999,
                            padding: '16px 36px', cursor: 'pointer',
                            fontWeight: 600, fontSize: 15,
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