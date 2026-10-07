import React from 'react';
import { WeatherIcon, TpoIcon, CalendarIcon, SparkleIcon, ClockIcon, RefreshIcon } from '../../components/Icons';
import { Weather, CalendarEvent, PoolEntry } from './types';
import { TPO_LIST } from './constants';
import StepAnimation from './StepAnimation';
import ResultsSection from './ResultsSection';

interface Props {
    weather: Weather | null;
    weatherUnavailable: boolean;
    dateEvents: CalendarEvent[];
    selectedDate: string;
    onDateChange: (d: string) => void;
    selectedEventIds: number[];
    setSelectedEventIds: (ids: number[]) => void;
    selectedTpo: string | null;
    setSelectedTpo: (tpo: string | null) => void;
    customTpo: string;
    setCustomTpo: (v: string) => void;
    numOutfits: number;
    setNumOutfits: (n: number) => void;
    loading: boolean;
    error: string;
    aiStep: number;
    outfitPool: PoolEntry[];
    acceptedPoolIdx: number | null;
    accepting: boolean;
    onRecommend: () => void;
    onAccept: (idx: number) => void;
}

function RecommendTab({
    weather, weatherUnavailable,
    dateEvents, selectedDate, onDateChange, selectedEventIds, setSelectedEventIds,
    selectedTpo, setSelectedTpo, customTpo, setCustomTpo,
    numOutfits, setNumOutfits,
    loading, error, aiStep,
    outfitPool, acceptedPoolIdx, accepting,
    onRecommend, onAccept,
}: Props) {
    const isRetry = outfitPool.length > 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* ── 날씨 + 일정 ─────────────────────────────────────── */}
            <div style={{
                background: 'white', borderRadius: 20, border: '1px solid #eaedf2',
                display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden',
            }}>
                <div style={{ padding: '22px 28px', borderRight: '1px solid #eaedf2' }}>
                    <p style={{ fontWeight: 600, fontSize: 11, color: '#aaa', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>오늘 날씨</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <span style={{ flexShrink: 0 }}>
                            {weather
                                ? <WeatherIcon desc={weather.desc} size={38} />
                                : weatherUnavailable
                                    ? <WeatherIcon desc="" size={38} />
                                    : <ClockIcon color="#ccc" size={38} />}
                        </span>
                        <div>
                            <p style={{ fontWeight: 800, fontSize: 26, color: '#1a1a2e', margin: 0, lineHeight: 1 }}>
                                {weather ? `${Math.round(weather.temp)}℃` : weatherUnavailable ? '-' : '...'}
                            </p>
                            <p style={{ fontSize: 13, color: '#888', margin: '5px 0 0' }}>
                                {weather ? weather.desc : weatherUnavailable ? '날씨 정보 없음' : '불러오는 중'}
                            </p>
                        </div>
                    </div>
                </div>

                <div style={{ padding: '22px 28px' }}>
                    {/* 헤더: 일정 레이블 + 날짜 선택 */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <p style={{ fontWeight: 600, fontSize: 11, color: '#aaa', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>일정</p>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={e => onDateChange(e.target.value)}
                            style={{
                                fontSize: 12, color: '#555', fontWeight: 600,
                                border: '1.5px solid #e8ecf0', borderRadius: 8,
                                padding: '4px 8px', cursor: 'pointer', outline: 'none',
                                background: 'white',
                            }}
                        />
                    </div>

                    {dateEvents.length === 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 34, height: 34, borderRadius: 10, background: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <CalendarIcon color="#ccc" size={16} />
                            </div>
                            <p style={{ fontSize: 13, color: '#bbb', margin: 0 }}>이 날 등록된 일정이 없어요</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <p style={{ fontSize: 11, color: '#aaa', margin: '0 0 6px' }}>추천에 반영할 일정을 선택하세요</p>
                            {dateEvents.map(ev => {
                                const color = TPO_LIST.find(t => t.key === ev.tpoKeyword)?.color ?? '#71b3e5';
                                const checked = selectedEventIds.includes(ev.eventId);
                                return (
                                    <div
                                        key={ev.eventId}
                                        onClick={() => {
                                            setSelectedEventIds(
                                                checked
                                                    ? selectedEventIds.filter(id => id !== ev.eventId)
                                                    : [...selectedEventIds, ev.eventId]
                                            );
                                        }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 8,
                                            padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
                                            background: checked ? `${color}14` : '#f8f9fc',
                                            border: `1.5px solid ${checked ? color + '55' : '#eaedf2'}`,
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        <div style={{
                                            width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                                            background: checked ? color : 'white',
                                            border: `2px solid ${checked ? color : '#ccc'}`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            {checked && <span style={{ color: 'white', fontSize: 10, lineHeight: 1 }}>✓</span>}
                                        </div>
                                        <span style={{ fontSize: 13, color: '#1a1a2e', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.eventName}</span>
                                        <span style={{ fontSize: 11, color, fontWeight: 600, flexShrink: 0 }}>{ev.tpoKeyword}</span>
                                    </div>
                                );
                            })}
                            {/* 일정 없이 추천 토글 */}
                            {selectedEventIds.length > 0 ? (
                                <button
                                    onClick={() => setSelectedEventIds([])}
                                    style={{ marginTop: 4, background: 'none', border: 'none', fontSize: 11, color: '#aaa', cursor: 'pointer', textAlign: 'left', padding: '2px 0', textDecoration: 'underline' }}
                                >
                                    일정 없이 추천받기
                                </button>
                            ) : (
                                <button
                                    onClick={() => setSelectedEventIds(dateEvents.map(e => e.eventId))}
                                    style={{ marginTop: 4, background: 'none', border: 'none', fontSize: 11, color: '#71b3e5', cursor: 'pointer', textAlign: 'left', padding: '2px 0', textDecoration: 'underline' }}
                                >
                                    모든 일정 반영하기
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── TPO + 코디 수 ────────────────────────────────────── */}
            <div style={{ background: 'white', borderRadius: 20, padding: '20px 22px', border: '1px solid #eaedf2' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <p style={{ fontWeight: 700, fontSize: 14, color: '#1a1a2e', margin: 0 }}>어떤 자리인가요?</p>
                    {dateEvents.length > 0 && selectedEventIds.length > 0 && (
                        <span style={{ fontSize: 12, color: '#aaa' }}>일정 TPO 자동 선택됨</span>
                    )}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, opacity: customTpo.trim() ? 0.45 : 1, transition: 'opacity 0.2s' }}>
                    {TPO_LIST.map(t => {
                        const active = selectedTpo === t.key && !customTpo.trim();
                        return (
                            <button
                                key={t.key}
                                onClick={() => { setSelectedTpo(t.key); setCustomTpo(''); }}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                    padding: '8px 14px', borderRadius: 999, cursor: 'pointer',
                                    border: active ? `2px solid ${t.color}` : '1.5px solid #e8ecf0',
                                    background: active ? `${t.color}18` : '#f5f7fa',
                                }}
                            >
                                <TpoIcon tpo={t.key} color={active ? t.color : '#aaa'} size={16} />
                                <span style={{ fontWeight: active ? 700 : 500, fontSize: 13, color: active ? t.color : '#555' }}>{t.key}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Free-text TPO input */}
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f0f0f0' }}>
                    <p style={{ fontWeight: 600, fontSize: 12, color: '#aaa', margin: '0 0 8px' }}>또는 상황을 자유롭게 적어보세요</p>
                    <div style={{ position: 'relative' }}>
                        <input
                            value={customTpo}
                            onChange={e => setCustomTpo(e.target.value)}
                            placeholder="예: 친구 결혼식 하객, 비 오는 날 카페에서 공부..."
                            style={{
                                width: '100%', boxSizing: 'border-box',
                                padding: '10px 36px 10px 14px',
                                borderRadius: 10, fontSize: 13, outline: 'none',
                                border: customTpo.trim() ? '1.5px solid #71b3e5' : '1.5px solid #e8ecf0',
                                background: customTpo.trim() ? 'rgba(113,179,229,0.05)' : 'white',
                                color: '#1a1a2e', transition: 'border-color 0.15s, background 0.15s',
                            }}
                        />
                        {customTpo && (
                            <button
                                onClick={() => setCustomTpo('')}
                                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: 14, padding: 2, lineHeight: 1 }}
                            >✕</button>
                        )}
                    </div>
                    {customTpo.trim() && (
                        <p style={{ fontSize: 11, color: '#71b3e5', margin: '6px 0 0', fontWeight: 500 }}>
                            ✓ 직접 입력한 내용으로 추천받습니다
                        </p>
                    )}
                </div>

                {!isRetry && (
                    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #f0f0f0' }}>
                        <p style={{ fontWeight: 600, fontSize: 12, color: '#aaa', margin: '0 0 10px' }}>코디 수</p>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {[2, 3].map(n => (
                                <button
                                    key={n}
                                    onClick={() => setNumOutfits(n)}
                                    style={{
                                        padding: '9px 28px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                        border: numOutfits === n ? 'none' : '1.5px solid #e8ecf0',
                                        background: numOutfits === n ? 'linear-gradient(135deg, #71b3e5, #5a9fd4)' : '#f5f7fa',
                                        color: numOutfits === n ? 'white' : '#888',
                                    }}
                                >
                                    {n}가지
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ── 히어로 배너 + CTA ────────────────────────────────── */}
            <div style={{
                background: '#71b3e5', borderRadius: 20,
                display: 'grid', gridTemplateColumns: '180px 1fr', overflow: 'hidden', minHeight: 200,
            }}>
                <div style={{ background: 'rgba(0,0,0,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 20px' }}>
                    <img src="/logo 2.svg" alt="lookatlife" style={{ width: '100%', maxWidth: 130, height: 'auto' }} />
                </div>
                <div style={{ padding: '28px 28px 28px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
                    <div>
                        <h2 style={{ fontWeight: 800, fontSize: 18, color: 'white', margin: '0 0 6px', lineHeight: 1.4 }}>
                            오늘의 코디를 추천받아 보세요 ✨
                        </h2>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', margin: 0, lineHeight: 1.6 }}>
                            AI가 날씨와 일정을 분석하고, 내 옷장에서 어울리는 코디를 찾아드려요.
                        </p>
                    </div>
                    {error && <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, margin: 0 }}>{error}</p>}
                    <button
                        onClick={onRecommend}
                        disabled={loading}
                        style={{
                            padding: '12px 22px', borderRadius: 12, border: 'none',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            background: loading ? 'rgba(255,255,255,0.55)' : 'white',
                            color: '#4a9fd4', fontWeight: 700, fontSize: 14,
                            boxShadow: loading ? 'none' : '0 4px 18px rgba(0,0,0,0.14)',
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            alignSelf: 'flex-start',
                        }}
                    >
                        {loading
                            ? <ClockIcon color="#4a9fd4" size={15} />
                            : isRetry
                                ? <RefreshIcon color="#4a9fd4" size={15} />
                                : <SparkleIcon color="#4a9fd4" size={15} />}
                        {loading ? 'AI가 분석 중...' : isRetry ? `다른 코디 ${numOutfits}가지 더 받기` : '오늘의 코디 추천받기'}
                    </button>
                </div>
            </div>

            {/* ── AI 분석 단계 ─────────────────────────────────────── */}
            {aiStep >= 0 && (
                <StepAnimation aiStep={aiStep} loading={loading} weather={weather} />
            )}

            {/* ── 추천 결과 ────────────────────────────────────────── */}
            {outfitPool.length > 0 && (
                <ResultsSection
                    outfitPool={outfitPool}
                    acceptedPoolIdx={acceptedPoolIdx}
                    accepting={accepting}
                    onAccept={onAccept}
                />
            )}
        </div>
    );
}

export default RecommendTab;
