import React from 'react';
import { WeatherIcon, TpoIcon, CalendarIcon, SparkleIcon, ClockIcon, RefreshIcon } from '../../components/Icons';
import { Weather, CalendarEvent, PoolEntry } from './types';
import { TPO_LIST } from './constants';
import StepAnimation from './StepAnimation';
import ResultsSection from './ResultsSection';

interface Props {
    weather: Weather | null;
    weatherUnavailable: boolean;
    todayEvents: CalendarEvent[];
    selectedTpo: string | null;
    setSelectedTpo: (tpo: string | null) => void;
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
    weather, weatherUnavailable, todayEvents,
    selectedTpo, setSelectedTpo, numOutfits, setNumOutfits,
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
                    <p style={{ fontWeight: 600, fontSize: 11, color: '#aaa', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>오늘 일정</p>
                    {todayEvents.length === 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 34, height: 34, borderRadius: 10, background: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <CalendarIcon color="#ccc" size={16} />
                            </div>
                            <p style={{ fontSize: 13, color: '#bbb', margin: 0 }}>등록된 일정이 없어요</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {todayEvents.slice(0, 2).map(ev => {
                                const color = TPO_LIST.find(t => t.key === ev.tpoKeyword)?.color ?? '#71b3e5';
                                return (
                                    <div key={ev.eventId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                                        <span style={{ fontSize: 13, color: '#1a1a2e', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.eventName}</span>
                                        <span style={{ fontSize: 11, color, fontWeight: 600, flexShrink: 0 }}>{ev.tpoKeyword}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ── TPO + 코디 수 ────────────────────────────────────── */}
            <div style={{ background: 'white', borderRadius: 20, padding: '20px 22px', border: '1px solid #eaedf2' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <p style={{ fontWeight: 700, fontSize: 14, color: '#1a1a2e', margin: 0 }}>어떤 자리인가요?</p>
                    {todayEvents.length > 0 && (
                        <span style={{ fontSize: 12, color: '#aaa' }}>일정 TPO 자동 선택됨</span>
                    )}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {TPO_LIST.map(t => {
                        const active = selectedTpo === t.key;
                        return (
                            <button
                                key={t.key}
                                onClick={() => setSelectedTpo(t.key)}
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
