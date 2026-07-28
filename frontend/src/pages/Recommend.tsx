import React, { useState, useEffect, useRef } from 'react';
import { usePageAnimation } from '../hooks/usePageAnimation';
import { wardrobeAPI, weatherAPI, calendarAPI, recommendationAPI } from '../api/api';
import { toDateStr } from '../utils/date';
import { getTpoColor } from '../utils/format';
import { WeatherIcon, TpoIcon, CalendarIcon, WardrobeIcon, RefreshIcon, AIIcon, ClockIcon, CheckIcon, ThermometerIcon } from '../components/Icons';

const TPO_LIST = [
    { key: '데이트', color: '#FF6B9D' },
    { key: '직장', color: '#4A90D9' },
    { key: '캐주얼', color: '#7EC8A4' },
    { key: '운동', color: '#F5A623' },
    { key: '파티', color: '#9B59B6' },
    { key: '여행', color: '#1ABC9C' },
    { key: '일상', color: '#95A5A6' },
    { key: '격식', color: '#34495E' },
];
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const CAT_COLOR: Record<string, string> = {
    '상의': '#4CAF8A', '하의': '#4A90D9', '아우터': '#E8832A', '원피스': '#E91E8C',
};

interface Weather {
    temp: number;
    desc: string;
    feelsLike?: number;
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
}

interface Outfit {
    top?: OutfitItem;
    bottom?: OutfitItem;
    outer?: OutfitItem;
    style?: string;
    description?: string;
}

interface MatchedItem {
    id?: string;
    imageUrl?: string;
    imageB64?: string;
    type?: string;
    category?: string;
}

interface PoolEntry {
    outfit: Outfit;
    matchedItems: MatchedItem[];
    recId: number;
    outfitIndex: number;
}

const TPO_COLORS: Record<string, string> = {
    '데이트': '#FF6B9D', '직장': '#4A90D9', '캐주얼': '#7EC8A4',
    '운동': '#F5A623', '파티': '#BD10E0', '여행': '#50E3C2', '일상': '#9B9B9B', '격식': '#4A4A4A',
};

const formatOutfitDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return `${m}월 ${d}일 (${WEEKDAYS[dt.getDay()]})`;
};

interface HistoryItem { id?: number; imageUrl?: string; type?: string; category?: string; }
interface OutfitInfoH { style?: string; description?: string; }
interface HistoryRecord { recId: number; tpo: string; retryCount?: number; createdAt: string; outfitDate?: string; temperature?: number; weatherCondition?: string; description?: string; allOutfitGroups?: Record<string, HistoryItem[]>; outfitInfos?: Record<number, OutfitInfoH>; acceptedOutfitIndex?: number; }

function Recommend() {
    const pageRef = useRef<HTMLDivElement>(null);
    usePageAnimation(pageRef);
    const today = new Date();
    const [weather, setWeather] = useState<Weather | null>(null);
    const [weatherUnavailable, setWeatherUnavailable] = useState(false);
    const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
    const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([]);
    const [selectedEventIds, setSelectedEventIds] = useState<number[]>([]);
    const [selectedTpo, setSelectedTpo] = useState<string | null>(null);
    const [numOutfits, setNumOutfits] = useState(2);
    const [outfitPool, setOutfitPool] = useState<PoolEntry[]>([]);
    const [acceptedPoolIdx, setAcceptedPoolIdx] = useState<number | null>(null);
    const [accepting, setAccepting] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [history, setHistory] = useState<HistoryRecord[]>([]);
    const [tpoPromptVisible, setTpoPromptVisible] = useState(false);
    const [showFullTpo, setShowFullTpo] = useState(false);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { fetchWeather(); fetchAllEvents(); fetchHistory(); }, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { updateTodayEvents(); }, [allEvents]);

    const fetchWeather = async () => {
        try {
            const r = await weatherAPI.getWeather();
            setWeather(r.data);
            setWeatherUnavailable(false);
        } catch { setWeatherUnavailable(true); }
    };

    const fetchAllEvents = async () => {
        try { const r = await calendarAPI.getEvents(); setAllEvents(r.data); } catch {}
    };

    const fetchHistory = async () => {
        try { const r = await recommendationAPI.getHistory(); setHistory(r.data); } catch {}
    };

    const handleChangeAccept = async (recId: number, outfitIndex: number, info?: OutfitInfoH) => {
        try { await recommendationAPI.acceptOutfit(recId, { outfitIndex, style: info?.style || '', description: info?.description || '' }); await fetchHistory(); }
        catch { alert('변경에 실패했습니다.'); }
    };

    const updateTodayEvents = () => {
        const evts = allEvents.filter(e => {
            const d = new Date(e.eventDatetime);
            return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
        });
        setTodayEvents(evts);
        setSelectedEventIds(evts.map(e => e.eventId));
        if (evts.length > 0) {
            setSelectedTpo(evts[0].tpoKeyword);
            setTpoPromptVisible(true);
            setShowFullTpo(false);
        } else {
            setSelectedTpo(null);
            setTpoPromptVisible(false);
            setShowFullTpo(false);
        }
    };

    const handleRecommend = async () => {
        if (!selectedTpo) { setError('TPO를 선택해주세요.'); return; }
        setLoading(true); setError('');
        const lastRecId = outfitPool.length > 0 ? outfitPool[outfitPool.length - 1].recId : null;
        const usedItemIds = outfitPool.flatMap(entry => (entry.matchedItems || []).map(item => item.id).filter(id => id && id !== 'null'));
        try {
            const res = await wardrobeAPI.recommend({
                tpo: selectedTpo, mode: 'rag',
                linkedEventIds: selectedEventIds,
                outfitDate: toDateStr(today),
                numOutfits, parentRecId: lastRecId,
                excludeItemIds: usedItemIds,
            });
            const newOutfits = res.data.outfits || [];
            const newMatchedItems = res.data.matched_items_per_outfit || [];
            const newRecId = res.data.recId;
            setOutfitPool(prev => [...prev, ...newOutfits.map((outfit: Outfit, idx: number) => ({
                outfit, matchedItems: newMatchedItems[idx] || [], recId: newRecId, outfitIndex: idx,
            }))]);
        } catch { setError('추천에 실패했습니다. 다시 시도해주세요.'); }
        finally { setLoading(false); }
    };

    const handleAccept = async (poolIdx: number) => {
        if (accepting) return;
        setAccepting(true);
        try {
            const entry = outfitPool[poolIdx];
            await recommendationAPI.acceptOutfit(entry.recId, { outfitIndex: entry.outfitIndex, style: entry.outfit?.style || '', description: entry.outfit?.description || '' });
            setAcceptedPoolIdx(poolIdx);
        } catch { alert('선택에 실패했습니다.'); }
        finally { setAccepting(false); }
    };

    const isRetry = outfitPool.length > 0;

    const todayLabel = (() => {
        const m = today.getMonth() + 1;
        const d = today.getDate();
        const wd = WEEKDAYS[today.getDay()];
        return `${m}월 ${d}일 (${wd})`;
    })();

    return (
        <div ref={pageRef} style={{ padding: '70px 36px', maxWidth: 1100, width: '100%' }}>
            {/* Header */}
            <div style={{ marginBottom: 28 }}>
                <div style={{ overflow: 'hidden' }}>
                    <h1 style={{ fontFamily: 'Hahmlet, sans-serif', fontWeight: 700, fontSize: 28, color: '#1a1a2e', margin: 0, letterSpacing: '-0.5px' }}>
                        AI 코디 추천
                    </h1>
                </div>
                <p data-sub style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 14, color: '#888', margin: '6px 0 0' }}>
                    날씨와 일정을 분석해 최적의 코디를 제안해 드려요
                </p>
            </div>

            {/* Left / Right layout */}
            <div data-card style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

                {/* LEFT: Weather + Events */}
                <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Today label */}
                    <p style={{ fontFamily: 'Hahmlet, sans-serif', fontWeight: 600, fontSize: 14, color: '#1a1a2e', margin: 0 }}>{todayLabel}</p>

                    {/* Weather card */}
                    <div style={{ background: '#f2f3f5', borderRadius: 18, padding: '20px 22px' }}>
                        <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 11, color: '#999', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>오늘 날씨</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <span style={{ flexShrink: 0 }}>
                                {weather ? <WeatherIcon desc={weather.desc} size={40} /> : weatherUnavailable ? <WeatherIcon desc="" size={40} /> : <ClockIcon color="#aaa" size={40} />}
                            </span>
                            <div>
                                <p style={{ fontFamily: 'Hahmlet, sans-serif', fontWeight: 700, fontSize: 20, color: '#1a1a2e', margin: 0 }}>
                                    {weather ? `${Math.round(weather.temp)}℃` : weatherUnavailable ? '-' : '...'}
                                </p>
                                <p style={{ fontFamily: 'Kedebideri, sans-serif', fontWeight: 400, fontSize: 13, color: '#666', margin: '4px 0 0' }}>
                                    {weather ? weather.desc : weatherUnavailable ? '날씨 정보 없음' : '불러오는 중'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Events card */}
                    <div style={{ background: 'white', borderRadius: 18, padding: '20px 22px', border: '1px solid #eaedf2' }}>
                        <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 11, color: '#999', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>오늘 일정</p>
                        {todayEvents.length === 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#eaedf2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <CalendarIcon color="#aaa" size={18} />
                                </div>
                                <p style={{ fontFamily: 'Kedebideri, sans-serif', fontSize: 13, color: '#bbb', margin: 0 }}>등록된 일정이 없어요</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {todayEvents.map(ev => {
                                    const color = getTpoColor(ev.tpoKeyword);
                                    return (
                                        <div key={ev.eventId} style={{ background: color + '14', borderRadius: 12, padding: '10px 14px', borderLeft: `3px solid ${color}` }}>
                                            <p style={{ fontFamily: 'Hahmlet, sans-serif', fontWeight: 700, fontSize: 14, color: '#1a1a2e', margin: 0 }}>{ev.eventName}</p>
                                            <p style={{ fontFamily: 'Kedebideri, sans-serif', fontSize: 12, color, margin: '4px 0 0', fontWeight: 600 }}>{ev.tpoKeyword}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT: TPO + Recommend + Outfits */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    {/* TPO & settings */}
                    <div style={{ background: 'white', borderRadius: 20, padding: '24px 28px', border: '1px solid #eaedf2', marginBottom: 16 }}>
                        {todayEvents.length > 0 ? (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                    <h2 style={{ fontFamily: 'Hahmlet, sans-serif', fontWeight: 600, fontSize: 16, color: '#1a1a2e', margin: 0 }}>어떤 자리인가요?</h2>
                                    {!showFullTpo && !isRetry && (
                                        <button onClick={() => setShowFullTpo(true)} style={{ background: 'none', border: '1px solid #dde2ea', borderRadius: 20, padding: '5px 12px', fontSize: 12, color: '#888', cursor: 'pointer', fontFamily: 'Kedebideri, sans-serif' }}>수정</button>
                                    )}
                                </div>

                                {!showFullTpo ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {TPO_LIST.filter(t => t.key === selectedTpo).map(t => (
                                            <div key={t.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 999, border: `2px solid ${t.color}`, background: `${t.color}18` }}>
                                                <TpoIcon tpo={t.key} color={t.color} size={20} />
                                                <span style={{ fontFamily: 'Kedebideri, sans-serif', fontWeight: 700, fontSize: 15, color: t.color }}>{t.key}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                                        {TPO_LIST.map(t => {
                                            const active = selectedTpo === t.key;
                                            return (
                                                <button key={t.key} onClick={() => setSelectedTpo(t.key)} style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 8,
                                                    padding: '10px 18px', borderRadius: 999, cursor: 'pointer', transition: 'all 0.15s',
                                                    border: active ? `2px solid ${t.color}` : '1.5px solid #e8ecf0',
                                                    background: active ? `${t.color}18` : '#f5f7fa',
                                                }}>
                                                    <TpoIcon tpo={t.key} color={active ? t.color : '#aaa'} size={20} />
                                                    <span style={{ fontFamily: 'Kedebideri, sans-serif', fontWeight: active ? 700 : 500, fontSize: 14, color: active ? t.color : '#555' }}>{t.key}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {!isRetry && (
                                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
                                        <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 12, color: '#aaa', margin: '0 0 10px' }}>코디 수</p>
                                        <div style={{ display: 'flex', gap: 10 }}>
                                            {[2, 3].map(n => (
                                                <button key={n} onClick={() => setNumOutfits(n)} style={{
                                                    flex: 1, padding: '10px', borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                                                    border: numOutfits === n ? 'none' : '1.5px solid #e8ecf0',
                                                    background: numOutfits === n ? 'linear-gradient(135deg, #71b3e5, #5a9fd4)' : '#f5f7fa',
                                                    color: numOutfits === n ? 'white' : '#888', fontFamily: 'Kedebideri, sans-serif',
                                                }}>{n}가지</button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : !tpoPromptVisible ? (
                            <>
                                <h2 style={{ fontFamily: 'Hahmlet, sans-serif', fontWeight: 700, fontSize: 16, color: '#1a1a2e', margin: '0 0 6px' }}>어떤 코디를 추천해 드릴까요?</h2>
                                <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 13, color: '#aaa', margin: '0 0 20px' }}>코디 수를 선택하면 어울리는 자리를 골라볼 수 있어요</p>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    {[2, 3].map(n => (
                                        <button key={n} onClick={() => { setNumOutfits(n); setTpoPromptVisible(true); }} style={{
                                            flex: 1, padding: '18px', borderRadius: 16, border: 'none', cursor: 'pointer', transition: 'all 0.18s',
                                            background: 'linear-gradient(135deg, #71b3e5, #5a9fd4)',
                                            color: 'white', fontFamily: 'Kedebideri, sans-serif', fontWeight: 700, fontSize: 15,
                                            boxShadow: '0 4px 16px rgba(113,179,229,0.35)',
                                        }}>
                                            {n}가지 코디 추천받기
                                        </button>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                    <h2 style={{ fontFamily: 'Hahmlet, sans-serif', fontWeight: 600, fontSize: 16, color: '#1a1a2e', margin: 0 }}>어떤 자리인가요?</h2>
                                    {!isRetry && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#71b3e5', background: 'rgba(113,179,229,0.1)', padding: '4px 10px', borderRadius: 20 }}>코디 {numOutfits}가지</span>
                                            <button onClick={() => { setTpoPromptVisible(false); setSelectedTpo(null); }} style={{ background: 'none', border: '1px solid #dde2ea', borderRadius: 20, padding: '4px 10px', fontSize: 11, color: '#888', cursor: 'pointer', fontFamily: 'Kedebideri, sans-serif' }}>변경</button>
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                                    {TPO_LIST.map(t => {
                                        const active = selectedTpo === t.key;
                                        return (
                                            <button key={t.key} onClick={() => setSelectedTpo(t.key)} style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 8,
                                                padding: '10px 18px', borderRadius: 999, cursor: 'pointer', transition: 'all 0.15s',
                                                border: active ? `2px solid ${t.color}` : '1.5px solid #e8ecf0',
                                                background: active ? `${t.color}18` : '#f5f7fa',
                                            }}>
                                                <TpoIcon tpo={t.key} color={active ? t.color : '#aaa'} size={20} />
                                                <span style={{ fontFamily: 'Kedebideri, sans-serif', fontWeight: active ? 700 : 500, fontSize: 14, color: active ? t.color : '#555' }}>{t.key}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>

                    {error && <p style={{ color: '#FF5A5A', fontSize: 13, marginBottom: 10, fontFamily: 'Inter, sans-serif' }}>{error}</p>}

                    <button
                        onClick={handleRecommend}
                        disabled={loading}
                        style={{
                            width: '100%', padding: '15px',
                            background: loading ? '#aaa' : 'linear-gradient(135deg, #71b3e5, #5a9fd4)',
                            color: 'white', border: 'none', borderRadius: 14, fontSize: 15, cursor: 'pointer',
                            fontFamily: 'Kedebideri, sans-serif', fontWeight: 700, marginBottom: 20,
                            boxShadow: loading ? 'none' : '0 4px 16px rgba(113,179,229,0.4)',
                        }}
                    >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            {loading ? <ClockIcon color="white" size={16} /> : isRetry ? <RefreshIcon color="white" size={16} /> : <AIIcon color="white" size={16} />}
                            {loading ? 'AI가 코디를 분석 중...' : isRetry ? `다른 코디 ${numOutfits}가지 더 받기` : '오늘의 코디 추천받기'}
                        </span>
                    </button>

                    {outfitPool.length > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(113,179,229,0.07)', border: '1px solid rgba(113,179,229,0.2)', borderRadius: 12, padding: '10px 16px', marginBottom: 16 }}>
                            <span style={{ fontFamily: 'Kedebideri, sans-serif', fontWeight: 700, fontSize: 13, color: '#71b3e5' }}>총 {outfitPool.length}가지 코디</span>
                            {acceptedPoolIdx !== null && <span style={{ fontFamily: 'Kedebideri, sans-serif', fontWeight: 700, fontSize: 13, color: '#71b3e5', display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckIcon color="#71b3e5" size={14} /> 코디 {acceptedPoolIdx + 1} 선택됨</span>}
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {outfitPool.map((entry, poolIdx) => {
                            const isAccepted = acceptedPoolIdx === poolIdx;
                            const isOtherAccepted = acceptedPoolIdx !== null && !isAccepted;
                            const outfit = entry.outfit;
                            const slots = [
                                outfit?.top && { label: '상의', ...outfit.top },
                                outfit?.bottom && { label: '하의', ...outfit.bottom },
                                outfit?.outer && { label: '아우터', ...outfit.outer },
                            ].filter(Boolean) as Array<{ label: string; type?: string; color?: string }>;

                            return (
                                <div key={poolIdx} style={{
                                    background: isAccepted ? 'linear-gradient(135deg, #d4eaf9 0%, #f0f7ff 100%)' : 'white',
                                    border: `2px solid ${isAccepted ? '#71b3e5' : '#eaedf2'}`,
                                    borderRadius: 20, overflow: 'hidden',
                                    opacity: isOtherAccepted ? 0.55 : 1, transition: 'all 0.2s',
                                }}>
                                    <div style={{ padding: '24px 28px', borderBottom: '1px solid #eaedf2' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: slots.length > 0 ? 16 : 0 }}>
                                            <div style={{ width: 40, height: 40, borderRadius: '50%', background: isAccepted ? 'linear-gradient(135deg, #71b3e5, #5a9fd4)' : '#c8d4dc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, color: 'white', flexShrink: 0, fontFamily: 'Hahmlet, sans-serif' }}>
                                                {poolIdx + 1}
                                            </div>
                                            {outfit?.style && (
                                                <span style={{ fontFamily: 'Hahmlet, sans-serif', fontWeight: 700, fontSize: 18, color: isAccepted ? '#1a1a2e' : '#555' }}>{outfit.style}</span>
                                            )}
                                            {isAccepted && <span style={{ marginLeft: 'auto', fontFamily: 'Kedebideri, sans-serif', fontWeight: 700, fontSize: 12, color: '#71b3e5', background: 'white', border: '1.5px solid #71b3e5', padding: '3px 10px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckIcon color="#71b3e5" size={12} /> 선택됨</span>}
                                        </div>

                                        {slots.length > 0 && (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                                                {slots.map((s, i) => (
                                                    <div key={i} style={{ background: '#f8f9fc', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: CAT_COLOR[s.label] || '#71b3e5', flexShrink: 0 }} />
                                                        <div>
                                                            <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 10, color: '#aaa', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</p>
                                                            <p style={{ fontFamily: 'Hahmlet, sans-serif', fontWeight: 600, fontSize: 13, color: '#1a1a2e', margin: '2px 0 0' }}>{s.type}</p>
                                                            {s.color && <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#aaa', margin: '1px 0 0' }}>{s.color}</p>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ padding: '20px 28px' }}>
                                        {outfit?.description && (
                                            <div style={{ background: 'rgba(113,179,229,0.07)', borderLeft: '3px solid #71b3e5', borderRadius: '0 12px 12px 0', padding: '14px 18px', marginBottom: 16 }}>
                                                <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 10, color: '#71b3e5', margin: '0 0 5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>AI 추천 이유</p>
                                                <p style={{ fontFamily: 'Kedebideri, sans-serif', fontWeight: 400, fontSize: 13, color: '#555', lineHeight: 1.7, margin: 0 }}>"{outfit.description}"</p>
                                            </div>
                                        )}

                                        {entry.matchedItems.length > 0 && (
                                            <div style={{ marginBottom: 16 }}>
                                                <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 11, color: '#aaa', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>내 옷장 아이템</p>
                                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                                    {entry.matchedItems.map((item, i) => (
                                                        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, width: 72 }}>
                                                            {(item.imageUrl || item.imageB64) ? (
                                                                <img src={item.imageUrl || item.imageB64} alt={item.type} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 10, border: '1px solid #eaedf2' }} />
                                                            ) : (
                                                                <div style={{ width: 72, height: 72, borderRadius: 10, background: 'rgba(113,179,229,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><WardrobeIcon color="#71b3e5" size={28} /></div>
                                                            )}
                                                            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#555', fontWeight: 500, textAlign: 'center', maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.type}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {!isAccepted ? (
                                            <button onClick={() => handleAccept(poolIdx)} disabled={accepting} style={{
                                                width: '100%', padding: 13,
                                                background: 'linear-gradient(135deg, #71b3e5, #5a9fd4)',
                                                color: 'white', border: 'none', borderRadius: 12, fontSize: 14, cursor: 'pointer',
                                                fontFamily: 'Kedebideri, sans-serif', fontWeight: 700,
                                            }}>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{accepting ? '선택 중...' : <><CheckIcon color="white" size={15} /> 이 코디 선택</>}</span>
                                            </button>
                                        ) : (
                                            <div style={{ padding: 12, background: 'rgba(113,179,229,0.1)', borderRadius: 12, textAlign: 'center' }}>
                                                <span style={{ fontFamily: 'Kedebideri, sans-serif', fontWeight: 700, fontSize: 14, color: '#71b3e5', display: 'inline-flex', alignItems: 'center', gap: 5 }}>선택한 코디입니다 <CheckIcon color="#71b3e5" size={15} /></span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Past recommendations */}
            {history.length > 0 && (
                <div style={{ marginTop: 40 }}>
                    <div style={{ borderTop: '2px dashed #eaedf2', paddingTop: 32, marginBottom: 24 }}>
                        <h2 style={{ fontFamily: 'Hahmlet, sans-serif', fontWeight: 700, fontSize: 22, color: '#1a1a2e', margin: '0 0 6px' }}>지난 추천 코디</h2>
                        <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 14, color: '#888', margin: 0 }}>이전에 추천받은 코디를 확인하고 변경할 수 있어요 ({history.length}건)</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {history.map((rec, i) => (
                            <div key={rec.recId || i} style={{ background: 'white', borderRadius: 20, overflow: 'hidden', border: '1px solid #eaedf2' }}>
                                <div style={{ padding: '16px 20px 14px', background: `linear-gradient(135deg, ${TPO_COLORS[rec.tpo] || '#71b3e5'}DD, ${TPO_COLORS[rec.tpo] || '#71b3e5'}88)` }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: 12, fontWeight: 800, color: 'white', background: 'rgba(255,255,255,0.25)', padding: '4px 12px', borderRadius: 20, fontFamily: 'Kedebideri, sans-serif' }}>{rec.tpo}</span>
                                        {!!rec.retryCount && rec.retryCount > 0 && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.9)', background: 'rgba(255,255,255,0.18)', padding: '3px 9px', borderRadius: 20, fontFamily: 'Inter, sans-serif', display: 'inline-flex', alignItems: 'center', gap: 4 }}><RefreshIcon color="rgba(255,255,255,0.9)" size={10} /> 재추천 {rec.retryCount}회</span>}
                                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginLeft: 'auto', fontFamily: 'Inter, sans-serif' }}>{new Date(rec.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{ fontSize: 17, fontWeight: 800, color: 'white', letterSpacing: '-0.3px', fontFamily: 'Hahmlet, sans-serif', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                            {rec.outfitDate && <CalendarIcon color="white" size={16} />}{rec.outfitDate ? `${formatOutfitDate(rec.outfitDate)} 코디` : '코디 추천'}
                                        </span>
                                        {rec.temperature && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', background: 'rgba(255,255,255,0.18)', padding: '4px 10px', borderRadius: 20, fontFamily: 'Inter, sans-serif', display: 'inline-flex', alignItems: 'center', gap: 4 }}><ThermometerIcon color="rgba(255,255,255,0.9)" size={11} /> {rec.temperature}°C · {rec.weatherCondition}</span>}
                                    </div>
                                </div>
                                <div style={{ padding: '14px 20px 18px' }}>
                                    {rec.description && <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#888', lineHeight: 1.65, margin: '0 0 12px', fontStyle: 'italic', paddingLeft: 10, borderLeft: '2px solid rgba(113,179,229,0.3)' }}>"{rec.description}"</p>}
                                    {rec.allOutfitGroups && Object.keys(rec.allOutfitGroups).length > 0 ? (
                                        Object.entries(rec.allOutfitGroups).map(([idxStr, items]) => {
                                            const idx = parseInt(idxStr);
                                            const isAccepted = rec.acceptedOutfitIndex === idx;
                                            const info = rec.outfitInfos?.[idx];
                                            return (
                                                <div key={idx} style={{ borderRadius: 14, padding: '12px 14px', marginBottom: 10, background: isAccepted ? 'rgba(113,179,229,0.07)' : '#f8f9fc', borderLeft: isAccepted ? '3px solid #71b3e5' : '3px solid #eaedf2' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <span style={{ width: 24, height: 24, borderRadius: '50%', background: isAccepted ? '#71b3e5' : '#B0BEC5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: 'white', flexShrink: 0, fontFamily: 'Hahmlet, sans-serif' }}>{idx + 1}</span>
                                                            {info?.style && <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, color: isAccepted ? '#71b3e5' : '#607D8B', background: isAccepted ? 'white' : '#EEF2F5', border: isAccepted ? '1px solid rgba(113,179,229,0.3)' : '1px solid #DDE3E9', fontFamily: 'Kedebideri, sans-serif' }}>{info.style}</span>}
                                                        </div>
                                                        {isAccepted && <span style={{ fontSize: 11, fontWeight: 700, color: '#71b3e5', background: 'white', padding: '4px 12px', borderRadius: 20, border: '1.5px solid #71b3e5', fontFamily: 'Kedebideri, sans-serif', display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckIcon color="#71b3e5" size={11} /> 선택됨</span>}
                                                    </div>
                                                    {items.length > 0 ? (
                                                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                                            {items.map((item, ii) => (
                                                                <div key={ii} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 70 }}>
                                                                    {item.imageUrl ? <img src={item.imageUrl} alt={item.type} style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: 12, border: '2px solid rgba(255,255,255,0.9)', boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }} /> : <div style={{ width: 70, height: 70, borderRadius: 12, background: 'rgba(113,179,229,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><WardrobeIcon color="#71b3e5" size={26} /></div>}
                                                                    <span style={{ fontSize: 9, fontWeight: 700, color: 'white', padding: '2px 6px', borderRadius: 5, background: CAT_COLOR[item.category || ''] || '#71b3e5', fontFamily: 'Kedebideri, sans-serif' }}>{item.category}</span>
                                                                    <p style={{ fontSize: 10, color: '#1a1a2e', fontWeight: 500, margin: 0, textAlign: 'center', maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif' }}>{item.type}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p style={{ fontSize: 11, color: '#aaa', margin: 0, padding: '6px 0', fontFamily: 'Inter, sans-serif' }}>매칭 아이템 없음</p>
                                                    )}
                                                    {!isAccepted && (
                                                        <button onClick={() => handleChangeAccept(rec.recId, idx, info)} style={{ marginTop: 12, width: '100%', padding: 10, background: 'white', border: '1.5px solid #71b3e5', borderRadius: 10, fontSize: 13, fontWeight: 700, color: '#71b3e5', cursor: 'pointer', fontFamily: 'Kedebideri, sans-serif' }}>
                                                            이 코디로 변경하기
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <p style={{ fontSize: 12, color: '#aaa', textAlign: 'center', padding: '16px 0', fontFamily: 'Inter, sans-serif' }}>코디 정보 없음</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default Recommend;
