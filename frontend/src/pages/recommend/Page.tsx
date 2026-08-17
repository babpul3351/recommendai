import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { wardrobeAPI, weatherAPI, calendarAPI, recommendationAPI } from '../../api/api';
import { toDateStr } from '../../utils/date';
import { Weather, CalendarEvent, Outfit, PoolEntry, HistoryRecord, OutfitInfoH } from './types';
import { WEEKDAYS } from './constants';
import RecommendTab from './RecommendTab';
import RightPanel from './RightPanel';

type Tab = 'recommend' | 'history';

function RecommendPage() {
    const today = useMemo(() => new Date(), []);
    const [activeTab, setActiveTab] = useState<Tab>('recommend');
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
    const [aiStep, setAiStep] = useState(-1);

    const fetchWeather = useCallback(async () => {
        try {
            const r = await weatherAPI.getWeather();
            setWeather(r.data);
            setWeatherUnavailable(false);
        } catch { setWeatherUnavailable(true); }
    }, []);

    const fetchAllEvents = useCallback(async () => {
        try { const r = await calendarAPI.getEvents(); setAllEvents(r.data); } catch {}
    }, []);

    const fetchHistory = useCallback(async () => {
        try { const r = await recommendationAPI.getHistory(); setHistory(r.data); } catch {}
    }, []);

    const updateTodayEvents = useCallback(() => {
        const evts = allEvents.filter(e => {
            const d = new Date(e.eventDatetime);
            return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
        });
        setTodayEvents(evts);
        setSelectedEventIds(evts.map(e => e.eventId));
        setSelectedTpo(evts.length > 0 ? evts[0].tpoKeyword : '일상');
    }, [allEvents, today]);

    useEffect(() => { fetchWeather(); fetchAllEvents(); fetchHistory(); }, [fetchWeather, fetchAllEvents, fetchHistory]);
    useEffect(() => { updateTodayEvents(); }, [updateTodayEvents]);

    const handleChangeAccept = async (recId: number, outfitIndex: number, info?: OutfitInfoH) => {
        try {
            await recommendationAPI.acceptOutfit(recId, { outfitIndex, style: info?.style || '', description: info?.description || '' });
            await fetchHistory();
        } catch { alert('변경에 실패했습니다.'); }
    };

    const handleRecommend = async () => {
        const tpo = selectedTpo ?? '일상';
        setLoading(true); setError(''); setAiStep(0);
        const lastRecId = outfitPool.length > 0 ? outfitPool[outfitPool.length - 1].recId : null;
        const usedItemIds = outfitPool
            .flatMap(entry => (entry.matchedItems || []).map(item => item.id))
            .filter((id): id is string => !!id && id !== 'null');
        const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
        try {
            await delay(400); setAiStep(1);
            await delay(400); setAiStep(2);
            const [res] = await Promise.all([
                wardrobeAPI.recommend({
                    tpo, mode: 'rag',
                    linkedEventIds: selectedEventIds,
                    outfitDate: toDateStr(today),
                    numOutfits, parentRecId: lastRecId,
                    excludeItemIds: usedItemIds,
                }),
                delay(700),
            ]);
            setAiStep(3);
            await delay(400); setAiStep(4);
            await delay(300);
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
            await recommendationAPI.acceptOutfit(entry.recId, {
                outfitIndex: entry.outfitIndex,
                style: entry.outfit?.style || '',
                description: entry.outfit?.description || '',
            });
            setAcceptedPoolIdx(poolIdx);
        } catch { alert('선택에 실패했습니다.'); }
        finally { setAccepting(false); }
    };

    const todayLabel = (() => {
        const m = today.getMonth() + 1;
        const d = today.getDate();
        const wd = WEEKDAYS[today.getDay()];
        return `${m}월 ${d}일 (${wd})`;
    })();

    const tabs: { key: Tab; label: string }[] = [
        { key: 'recommend', label: 'AI 코디 추천' },
        { key: 'history',   label: '지난 추천 코디' },
    ];

    return (
        <div style={{ padding: '52px 36px 60px', maxWidth: 900, width: '100%', boxSizing: 'border-box' }}>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontWeight: 800, fontSize: 28, color: '#1a1a2e', margin: 0, letterSpacing: '-0.5px' }}>AI 코디 추천</h1>
                <p style={{ fontSize: 14, color: '#888', margin: '5px 0 0' }}>날씨와 일정을 분석해 오늘의 코디를 추천해드려요</p>
            </div>

            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#f0f2f5', borderRadius: 12, padding: 4, width: 'fit-content' }}>
                {tabs.map(t => {
                    const active = activeTab === t.key;
                    return (
                        <button
                            key={t.key}
                            onClick={() => setActiveTab(t.key)}
                            style={{
                                background: active ? 'white' : 'transparent',
                                border: 'none', borderRadius: 9, padding: '8px 24px',
                                fontWeight: active ? 600 : 400, fontSize: 14,
                                color: active ? '#1a1a2e' : '#888', cursor: 'pointer',
                                boxShadow: active ? '0 1px 6px rgba(0,0,0,0.08)' : 'none',
                                transition: 'all 0.15s',
                            }}
                        >
                            {t.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab content */}
            {activeTab === 'recommend' ? (
                <RecommendTab
                    weather={weather}
                    weatherUnavailable={weatherUnavailable}
                    todayEvents={todayEvents}
                    selectedTpo={selectedTpo}
                    setSelectedTpo={setSelectedTpo}
                    numOutfits={numOutfits}
                    setNumOutfits={setNumOutfits}
                    loading={loading}
                    error={error}
                    aiStep={aiStep}
                    outfitPool={outfitPool}
                    acceptedPoolIdx={acceptedPoolIdx}
                    accepting={accepting}
                    onRecommend={handleRecommend}
                    onAccept={handleAccept}
                />
            ) : (
                <RightPanel
                    history={history}
                    onChangeAccept={handleChangeAccept}
                />
            )}
        </div>
    );
}

export default RecommendPage;
