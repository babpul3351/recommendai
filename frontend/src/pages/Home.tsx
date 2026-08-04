import React, { useEffect, useState, useRef } from 'react';
import { theme } from '../styles/theme';
import { useNavigate } from 'react-router-dom';
import { usePageAnimation } from '../hooks/usePageAnimation';
import { weatherAPI, wardrobeAPI, calendarAPI, recommendationAPI } from '../api/api';
import { toDateStr, formatTime } from '../utils/date';
import { getTpoColor } from '../utils/format';
import { WeatherIcon, SparkleIcon, RefreshIcon, CalendarIcon, WardrobeIcon, PinIcon } from '../components/Icons';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

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
    type: string;
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

interface WeekOutfit {
    outfitDate: string;
    matchedItems?: OutfitItem[];
    description?: string;
}

function Home() {
    const navigate = useNavigate();
    const pageRef = useRef<HTMLDivElement>(null);
    usePageAnimation(pageRef);
    const nickname = localStorage.getItem('nickname') || '사용자';
    const [weather, setWeather] = useState<Weather | null>(null);
    const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
    const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([]);
    const [weekEvents, setWeekEvents] = useState<CalendarEvent[]>([]);
    const [weekOutfits, setWeekOutfits] = useState<WeekOutfit[]>([]);
    const [loading, setLoading] = useState(false);
    const [weekWeathers, setWeekWeathers] = useState<Record<string, Weather>>({});

    const today = new Date();

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { fetchWeather(); fetchCalendarData(); }, []);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { if (weather) setWeekWeathers(prev => ({ ...prev, [toDateStr(today)]: weather! })); }, [weather]);

    const fetchWeather = async () => {
        try {
            const res = await weatherAPI.getWeather();
            setWeather(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchCalendarData = async () => {
        try {
            const res = await calendarAPI.getEvents();
            const allEvents: CalendarEvent[] = res.data;
            const todayEvts = allEvents.filter(e => {
                const d = new Date(e.eventDatetime);
                return d.getFullYear() === today.getFullYear() &&
                    d.getMonth() === today.getMonth() &&
                    d.getDate() === today.getDate();
            });
            setTodayEvents(todayEvts);
            const weekEnd = new Date(today);
            weekEnd.setDate(today.getDate() + 6);
            setWeekEvents(allEvents.filter(e => {
                const d = new Date(e.eventDatetime);
                return d >= today && d <= weekEnd;
            }));
            const startStr = toDateStr(today);
            const endDate = new Date(today);
            endDate.setDate(today.getDate() + 6);
            const outfitsRes = await recommendationAPI.getWeekOutfits(startStr, toDateStr(endDate));
            setWeekOutfits(outfitsRes.data || []);
            const weatherMap: Record<string, Weather> = {};
            for (let i = 1; i <= 5; i++) {
                const d = new Date(today);
                d.setDate(today.getDate() + i);
                const dateStr = toDateStr(d);
                try {
                    const wRes = await weatherAPI.getForecast(dateStr);
                    weatherMap[dateStr] = wRes.data;
                } catch (err) {}
            }
            setWeekWeathers(prev => ({ ...prev, ...weatherMap }));
        } catch (err) { console.error(err); }
    };

    const fetchRecommendation = async () => {
        setLoading(true);
        try {
            const tpo = todayEvents[0]?.tpoKeyword || '일상';
            const body = { tpo, mode: 'rag', linkedEvents: todayEvents.slice(0, 1).map(e => e.eventId) };
            const res = await wardrobeAPI.recommend(body);
            setRecommendation(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const weekDays = Array.from({ length: 3 }).map((_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        return d;
    });

    const getEventsOnDay = (date: Date): CalendarEvent[] =>
        weekEvents.filter(e => {
            const d = new Date(e.eventDatetime);
            return d.getFullYear() === date.getFullYear() &&
                d.getMonth() === date.getMonth() &&
                d.getDate() === date.getDate();
        });

    const getOutfitsOnDay = (date: Date): WeekOutfit[] =>
        weekOutfits.filter(o => o.outfitDate === toDateStr(date));

    return (
        <div ref={pageRef} style={{ padding: '70px 36px', maxWidth: 1100, width: '100%' }}>
            {/* Header */}
            <div style={{ marginBottom: 28 }}>
                <div style={{ overflow: 'hidden' }}>
                    <h1 style={{
                        fontFamily: theme.fontFamily.heading,
                        fontWeight: 700,
                        fontSize: 28,
                        color: '#1a1a2e',
                        margin: 0,
                        letterSpacing: '-0.5px',
                    }}>
                        안녕하세요, {nickname}님
                    </h1>
                </div>
                <p data-sub style={{ fontFamily: theme.fontFamily.body, fontWeight: 400, fontSize: 14, color: '#888', margin: '6px 0 0' }}>
                    오늘의 날씨와 일정을 기반으로 코디를 추천해 드려요
                </p>
            </div>

            {/* Top row: Weather card + AI CTA */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                {/* Weather */}
                <div data-card style={{
                    background: 'linear-gradient(135deg, #71b3e5 0%, #5a9fd4 100%)',
                    borderRadius: 20,
                    padding: '28px 32px',
                    color: 'white',
                    position: 'relative',
                    overflow: 'hidden',
                }}>
                    <div style={{ position: 'absolute', right: 24, top: 20, opacity: 0.15 }}>
                        <WeatherIcon desc={weather?.desc ?? ''} color="white" size={100} />
                    </div>
                    {weather ? (
                        <>
                            <p style={{ fontFamily: theme.fontFamily.body, fontWeight: 500, fontSize: 12, opacity: 0.8, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <PinIcon color="white" size={13} /> {weather.city} · 오늘
                            </p>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                                <span style={{ fontFamily: theme.fontFamily.heading, fontWeight: 700, fontSize: 64, lineHeight: 1 }}>{Math.round(weather.temp)}</span>
                                <span style={{ fontFamily: theme.fontFamily.heading, fontWeight: 400, fontSize: 36 }}>℃</span>
                            </div>
                            <p style={{ fontFamily: theme.fontFamily.heading, fontWeight: 400, fontSize: 16, margin: '6px 0 0', opacity: 0.9 }}>
                                {weather.desc}
                                {weather.humidity != null ? ` · 습도 ${weather.humidity}%` : ''}
                            </p>
                            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                                {[
                                    { label: '체감', val: weather.feelsLike != null ? `${Math.round(weather.feelsLike)}℃` : '-' },
                                    { label: '최고', val: weather.tempMax != null ? `${Math.round(weather.tempMax)}℃` : '-' },
                                    { label: '최저', val: weather.tempMin != null ? `${Math.round(weather.tempMin)}℃` : '-' },
                                ].map(({ label, val }) => (
                                    <div key={label} style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: '6px 12px', textAlign: 'center' }}>
                                        <p style={{ fontFamily: theme.fontFamily.body, fontWeight: 400, fontSize: 10, opacity: 0.8, margin: 0 }}>{label}</p>
                                        <p style={{ fontFamily: theme.fontFamily.heading, fontWeight: 600, fontSize: 14, margin: '2px 0 0' }}>{val}</p>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <p style={{ fontFamily: theme.fontFamily.heading, fontSize: 16, opacity: 0.8 }}>날씨 불러오는 중...</p>
                    )}
                </div>

                {/* AI CTA */}
                <div data-card style={{
                    background: 'white',
                    borderRadius: 20,
                    padding: '28px 32px',
                    border: '1px solid #eaedf2',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                            <div style={{
                                width: 52, height: 52, borderRadius: '50%',
                                background: 'linear-gradient(135deg, #71b3e5, #5a9fd4)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                            }}>
                                <SparkleIcon color="white" size={26} />
                            </div>
                            <div>
                                <p style={{ fontFamily: theme.fontFamily.heading, fontWeight: 700, fontSize: 16, color: '#1a1a2e', margin: 0 }}>
                                    AI 코디 추천
                                </p>
                                <p style={{ fontFamily: theme.fontFamily.body, fontWeight: 400, fontSize: 12, color: '#888', margin: '3px 0 0' }}>
                                    오늘 일정에 딱 맞는 스타일
                                </p>
                            </div>
                        </div>
                        {recommendation ? (
                            <div>
                                {recommendation.outfit?.top && (
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                                        {[
                                            { label: '상의', item: recommendation.outfit.top },
                                            { label: '하의', item: recommendation.outfit.bottom },
                                            { label: '아우터', item: recommendation.outfit.outer },
                                        ].filter(({ item }) => item).map(({ label, item }) => (
                                            <div key={label} style={{ background: 'rgba(113,179,229,0.1)', borderRadius: 10, padding: '6px 12px' }}>
                                                <p style={{ fontFamily: theme.fontFamily.body, fontWeight: 600, fontSize: 10, color: '#71b3e5', margin: 0 }}>{label}</p>
                                                <p style={{ fontFamily: theme.fontFamily.heading, fontWeight: 600, fontSize: 13, color: '#1a1a2e', margin: '2px 0 0' }}>{item?.type}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {recommendation.outfit?.description && (
                                    <p style={{ fontFamily: theme.fontFamily.body, fontWeight: 400, fontSize: 12, color: '#666', lineHeight: 1.6, margin: 0 }}>
                                        {recommendation.outfit.description}
                                    </p>
                                )}
                            </div>
                        ) : loading ? (
                            <p style={{ fontFamily: theme.fontFamily.body, fontWeight: 400, fontSize: 13, color: '#71b3e5' }}>
                                AI가 코디를 분석 중이에요...
                            </p>
                        ) : (
                            <p style={{ fontFamily: theme.fontFamily.body, fontWeight: 400, fontSize: 13, color: '#666', lineHeight: 1.6, margin: 0 }}>
                                {weather && (
                                    <><strong style={{ color: '#71b3e5' }}>{Math.round(weather.temp)}℃ {weather.desc}</strong>
                                    {todayEvents[0] && <> 과 오늘 일정 <strong style={{ color: '#d6408e' }}>{todayEvents[0].eventName}</strong></>}
                                    을 분석해서 최적의 코디를 제안해 드려요.</>
                                )}
                                {!weather && '날씨와 일정을 분석해서 최적의 코디를 제안해 드려요.'}
                            </p>
                        )}
                    </div>
                    {recommendation ? (
                        <button
                            onClick={() => setRecommendation(null)}
                            style={{
                                background: 'linear-gradient(135deg, #71b3e5, #5a9fd4)',
                                border: 'none', borderRadius: 12,
                                padding: '13px 20px',
                                fontFamily: theme.fontFamily.ui, fontWeight: 600, fontSize: 14,
                                color: 'white', cursor: 'pointer', marginTop: 16,
                            }}
                        >
                            <RefreshIcon color="white" size={16} /> 다시 추천받기
                        </button>
                    ) : (
                        <button
                            onClick={() => recommendation ? setRecommendation(null) : fetchRecommendation()}
                            style={{
                                background: 'linear-gradient(135deg, #71b3e5, #5a9fd4)',
                                border: 'none', borderRadius: 12,
                                padding: '13px 20px',
                                fontFamily: theme.fontFamily.ui, fontWeight: 600, fontSize: 14,
                                color: 'white', cursor: 'pointer', marginTop: 16,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            }}
                        >
                            <SparkleIcon color="white" size={16} /> 오늘의 코디 추천받기
                        </button>
                    )}
                </div>
            </div>

            {/* Bottom row: Weekly check + Today schedule */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Weekly outfit check */}
                <div style={{ background: 'white', borderRadius: 20, padding: '24px 28px', border: '1px solid #eaedf2' }}>
                    <h2 style={{ fontFamily: theme.fontFamily.heading, fontWeight: 600, fontSize: 16, color: '#1a1a2e', margin: '0 0 18px' }}>
                        주간 날씨 & 코디
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {weekDays.map((date, i) => {
                            const dateStr = toDateStr(date);
                            const dayWeather = weekWeathers[dateStr];
                            const dayEvts = getEventsOnDay(date);
                            const dayOutfits = getOutfitsOnDay(date);
                            const isToday = i === 0;
                            const dow = date.getDay();
                            return (
                                <div
                                    key={i}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 14,
                                        padding: '12px 14px',
                                        background: isToday ? 'linear-gradient(135deg, #d4eaf9, #e8f4fd)' : '#f8f9fc',
                                        borderRadius: 14,
                                        border: isToday ? '1px solid rgba(113,179,229,0.3)' : '1px solid transparent',
                                    }}
                                >
                                    <div style={{ width: 44, height: 44, borderRadius: 10, background: isToday ? '#71b3e5' : '#e0e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <WeatherIcon desc={dayWeather?.desc ?? ''} color={isToday ? 'white' : '#71b3e5'} size={26} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span style={{ fontFamily: theme.fontFamily.heading, fontWeight: 600, fontSize: 14, color: '#1a1a2e' }}>
                                                {date.getMonth() + 1}/{date.getDate()} ({WEEKDAYS[dow]})
                                            </span>
                                            {isToday && (
                                                <span style={{ background: '#71b3e5', color: 'white', fontFamily: theme.fontFamily.body, fontWeight: 600, fontSize: 10, padding: '1px 7px', borderRadius: 20 }}>
                                                    오늘
                                                </span>
                                            )}
                                        </div>
                                        <p style={{ fontFamily: theme.fontFamily.body, fontWeight: 400, fontSize: 12, color: '#888', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                                            {dayEvts[0] ? <><CalendarIcon color="#888" size={12} /> {dayEvts[0].eventName}</> : dayOutfits[0] ? <><WardrobeIcon color="#888" size={12} /> 코디 저장됨</> : '일정 없음'}
                                        </p>
                                    </div>
                                    {dayWeather && (
                                        <span style={{ fontFamily: theme.fontFamily.heading, fontWeight: 700, fontSize: 18, color: '#1a1a2e' }}>
                                            {Math.round(dayWeather.temp)}℃
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <button
                        onClick={() => navigate('/recommend')}
                        style={{
                            width: '100%', marginTop: 16,
                            background: 'none', border: '1px dashed #d0d8e4',
                            borderRadius: 12, padding: '11px',
                            fontFamily: theme.fontFamily.ui, fontWeight: 400, fontSize: 13,
                            color: '#aaa', cursor: 'pointer',
                        }}
                    >
                        AI 추천 페이지에서 더 보기 →
                    </button>
                </div>

                {/* Today's schedule */}
                <div style={{ background: 'white', borderRadius: 20, padding: '24px 28px', border: '1px solid #eaedf2' }}>
                    <h2 style={{ fontFamily: theme.fontFamily.heading, fontWeight: 600, fontSize: 16, color: '#1a1a2e', margin: '0 0 18px' }}>
                        오늘의 일정
                    </h2>
                    {todayEvents.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '32px 0' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><CalendarIcon color="#ccc" size={44} /></div>
                            <p style={{ fontFamily: theme.fontFamily.ui, fontWeight: 400, fontSize: 14, color: '#bbb', margin: 0 }}>
                                오늘 일정이 없어요
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {todayEvents.map((ev) => {
                                const color = getTpoColor(ev.tpoKeyword);
                                return (
                                    <div key={ev.eventId} style={{
                                        display: 'flex', alignItems: 'center', gap: 14,
                                        padding: '14px 16px', background: '#f8f9fc',
                                        borderRadius: 14, borderLeft: `4px solid ${color}`,
                                    }}>
                                        <div>
                                            <span style={{ fontFamily: theme.fontFamily.body, fontWeight: 700, fontSize: 12, color, display: 'block' }}>
                                                {formatTime(ev.eventDatetime)}
                                            </span>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontFamily: theme.fontFamily.ui, fontWeight: 700, fontSize: 14, color: '#1a1a2e', margin: 0 }}>
                                                {ev.eventName}
                                            </p>
                                            <p style={{ fontFamily: theme.fontFamily.body, fontWeight: 400, fontSize: 12, color: '#888', margin: '2px 0 0' }}>
                                                {ev.tpoKeyword}
                                            </p>
                                        </div>
                                        <span style={{
                                            background: color + '20', border: `1px solid ${color}`,
                                            borderRadius: 20, padding: '2px 10px',
                                            fontFamily: theme.fontFamily.ui, fontWeight: 400, fontSize: 11, color,
                                        }}>
                                            {ev.tpoKeyword}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <button
                        onClick={() => navigate('/calendar')}
                        style={{
                            width: '100%', marginTop: 14,
                            background: 'none', border: '1px dashed #d0d8e4',
                            borderRadius: 12, padding: '11px',
                            fontFamily: theme.fontFamily.ui, fontWeight: 400, fontSize: 13,
                            color: '#aaa', cursor: 'pointer',
                        }}
                    >
                        + 일정 추가하러 가기
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Home;
