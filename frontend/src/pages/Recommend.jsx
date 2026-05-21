import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { wardrobeAPI, weatherAPI, calendarAPI } from '../api/api';
import { theme } from '../styles/theme';

const TPO_LIST = [
    { key: '데이트', emoji: '💑', color: '#FF6B9D' },
    { key: '직장', emoji: '💼', color: '#4A90D9' },
    { key: '캐주얼', emoji: '👟', color: '#7EC8A4' },
    { key: '운동', emoji: '🏃', color: '#F5A623' },
    { key: '파티', emoji: '🎉', color: '#BD10E0' },
    { key: '여행', emoji: '✈️', color: '#50E3C2' },
    { key: '일상', emoji: '☀️', color: '#9B9B9B' },
    { key: '격식', emoji: '👔', color: '#4A4A4A' },
];
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function Recommend() {
    const today = new Date();
    const [selectedTpo, setSelectedTpo] = useState(null);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [weather, setWeather] = useState(null);
    const [weatherUnavailable, setWeatherUnavailable] = useState(false);
    const [allEvents, setAllEvents] = useState([]);
    const [selectedDate, setSelectedDate] = useState(today);
    const [selectedDateEvents, setSelectedDateEvents] = useState([]);
    const [selectedEventIds, setSelectedEventIds] = useState([]);
    const [showCalendarPopup, setShowCalendarPopup] = useState(false);
    const [calYear, setCalYear] = useState(today.getFullYear());
    const [calMonth, setCalMonth] = useState(today.getMonth());
    const [saved, setSaved] = useState(false);

    const pad = (n) => String(n).padStart(2, '0');
    const toDateStr = (date) => {
        const d = new Date(date);
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    };

    useEffect(() => {
        fetchWeather(new Date());
        fetchAllEvents();
    }, []);

    useEffect(() => { updateDateEvents(selectedDate); }, [selectedDate, allEvents]);

    const fetchWeather = async (date) => {
        try {
            const diffDays = Math.ceil((date - today) / (1000 * 60 * 60 * 24));
            if (diffDays <= 0) {
                const res = await weatherAPI.getWeather();
                setWeather(res.data); setWeatherUnavailable(false);
            } else if (diffDays <= 5) {
                const res = await weatherAPI.getForecast(toDateStr(date));
                setWeather(res.data); setWeatherUnavailable(false);
            } else {
                setWeather(null); setWeatherUnavailable(true);
            }
        } catch (err) { console.error(err); }
    };

    const fetchAllEvents = async () => {
        try {
            const res = await calendarAPI.getEvents();
            setAllEvents(res.data);
        } catch (err) { console.error(err); }
    };

    const updateDateEvents = (date) => {
        const evts = allEvents.filter(e => {
            const d = new Date(e.eventDatetime);
            return d.getFullYear() === date.getFullYear() &&
                d.getMonth() === date.getMonth() &&
                d.getDate() === date.getDate();
        });
        setSelectedDateEvents(evts);
        setSelectedEventIds(evts.map(e => e.eventId));
        if (evts.length > 0) setSelectedTpo(evts[0].tpoKeyword);
    };

    const getTpoColor = (tpo) => TPO_LIST.find(t => t.key === tpo)?.color || theme.colors.primary;

    const getWeatherEmoji = (desc) => {
        if (!desc) return '🌤️';
        if (desc.includes('맑')) return '☀️';
        if (desc.includes('구름')) return '⛅';
        if (desc.includes('비')) return '🌧️';
        if (desc.includes('눈')) return '❄️';
        return '🌤️';
    };

    const formatDate = (date) => {
        const d = new Date(date);
        return `${d.getMonth()+1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
    };

    const isToday = (date) => {
        const d = new Date(date);
        return d.getFullYear() === today.getFullYear() &&
            d.getMonth() === today.getMonth() &&
            d.getDate() === today.getDate();
    };

    const toggleEvent = (eventId) => {
        setSelectedEventIds(prev =>
            prev.includes(eventId) ? prev.filter(id => id !== eventId) : [...prev, eventId]
        );
    };

    const handleDaySelect = (day) => {
        const newDate = new Date(calYear, calMonth, day);
        setSelectedDate(newDate);
        setShowCalendarPopup(false);
        setResult(null); setSaved(false);
        setWeatherUnavailable(false);
        fetchWeather(newDate);
    };

    const handleRecommend = async () => {
        if (!selectedTpo) { setError('TPO를 선택해주세요.'); return; }
        setLoading(true); setError(''); setResult(null); setSaved(false);
        try {
            const res = await wardrobeAPI.recommend({
                tpo: selectedTpo, mode: 'rag',
                linkedEventIds: selectedEventIds,
                outfitDate: toDateStr(selectedDate)
            });
            setResult(res.data);
        } catch (err) { setError('추천에 실패했습니다. 다시 시도해주세요.'); }
        finally { setLoading(false); }
    };

    const getDaysInMonth = (y, m) => new Date(y, m+1, 0).getDate();
    const getFirstDay = (y, m) => new Date(y, m, 1).getDay();
    const getEventsOnDay = (year, month, day) => allEvents.filter(e => {
        const d = new Date(e.eventDatetime);
        return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });

    const daysInMonth = getDaysInMonth(calYear, calMonth);
    const firstDay = getFirstDay(calYear, calMonth);

    return (
        <div style={styles.page}>
            <Navbar />
            <div style={styles.container}>
                <h1 style={styles.title}>AI 코디 추천</h1>
                <p style={styles.subtitle}>날짜와 TPO를 선택하면 AI가 코디를 추천해드려요</p>

                {/* 날짜 + 날씨 + 일정 박스 */}
                <div style={styles.infoCard}>
                    <div style={styles.dateRow}>
                        <button style={styles.dateBtn} onClick={() => setShowCalendarPopup(true)}>
                            <span style={styles.dateBtnText}>{formatDate(selectedDate)}</span>
                            <span style={styles.calIcon}>📅</span>
                        </button>
                        {!isToday(selectedDate) && (
                            <button style={styles.todayBtn}
                                    onClick={() => { setSelectedDate(today); setCalYear(today.getFullYear()); setCalMonth(today.getMonth()); }}>
                                오늘로
                            </button>
                        )}
                    </div>

                    {weatherUnavailable ? (
                        <p style={styles.weatherUnavailable}>5일 이후는 날씨 정보를 제공할 수 없습니다</p>
                    ) : weather ? (
                        <div style={styles.weatherRow}>
                            <span style={{ fontSize: '22px' }}>{getWeatherEmoji(weather.desc)}</span>
                            <span style={styles.weatherTemp}>{weather.temp}°C</span>
                            <span style={styles.weatherDesc}>{weather.desc}</span>
                            <span style={styles.weatherDetail}>· 체감 {weather.feelsLike}°C</span>
                        </div>
                    ) : null}

                    {selectedDateEvents.length > 0 && (
                        <div style={styles.eventSection}>
                            <p style={styles.eventLabel}>이 날의 일정</p>
                            <div style={styles.eventChips}>
                                {selectedDateEvents.map(ev => (
                                    <div key={ev.eventId} style={{
                                        ...styles.eventChip,
                                        backgroundColor: selectedEventIds.includes(ev.eventId)
                                            ? getTpoColor(ev.tpoKeyword) : theme.colors.background,
                                        color: selectedEventIds.includes(ev.eventId) ? 'white' : theme.colors.text
                                    }} onClick={() => toggleEvent(ev.eventId)}>
                                        {ev.eventName}
                                        <span style={{ fontSize: '11px', opacity: 0.8 }}> · {ev.tpoKeyword}</span>
                                        {selectedEventIds.includes(ev.eventId) && <span> ✓</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* TPO 선택 */}
                <p style={styles.sectionLabel}>TPO 선택</p>
                <div style={styles.tpoGrid}>
                    {TPO_LIST.map(tpo => (
                        <button key={tpo.key} style={{
                            ...styles.tpoCard,
                            backgroundColor: selectedTpo === tpo.key ? tpo.color : theme.colors.white,
                            boxShadow: selectedTpo === tpo.key
                                ? `0 4px 14px ${tpo.color}44` : theme.colors.cardShadow
                        }} onClick={() => setSelectedTpo(tpo.key)}>
                            <span style={styles.tpoEmoji}>{tpo.emoji}</span>
                            <span style={{
                                ...styles.tpoLabel,
                                color: selectedTpo === tpo.key ? 'white' : theme.colors.text
                            }}>{tpo.key}</span>
                        </button>
                    ))}
                </div>

                {error && <p style={styles.error}>{error}</p>}

                <button style={{
                    ...styles.recommendBtn,
                    opacity: loading ? 0.7 : 1
                }} onClick={handleRecommend} disabled={loading}>
                    {loading ? 'AI가 코디를 분석 중...' : `${formatDate(selectedDate)} 코디 추천받기`}
                </button>

                {/* 추천 결과 */}
                {result && (
                    <div style={styles.resultCard}>
                        <div style={styles.resultHeader}>
                            <p style={styles.resultTitle}>추천 결과</p>
                            {!saved ? (
                                <button style={styles.saveBtn} onClick={() => setSaved(true)}>
                                    💾 저장
                                </button>
                            ) : (
                                <span style={styles.savedBadge}>✅ 저장됨</span>
                            )}
                        </div>

                        {result.outfit?.style && (
                            <span style={styles.styleTag}>{result.outfit.style}</span>
                        )}

                        <div style={styles.outfitChips}>
                            {result.outfit?.top && (
                                <div style={styles.outfitChip}>
                                    <span style={styles.chipLabel}>상의</span>
                                    <span style={styles.chipValue}>{result.outfit.top.type}</span>
                                    <span style={styles.chipColor}>{result.outfit.top.color}</span>
                                </div>
                            )}
                            {result.outfit?.bottom && (
                                <div style={styles.outfitChip}>
                                    <span style={styles.chipLabel}>하의</span>
                                    <span style={styles.chipValue}>{result.outfit.bottom.type}</span>
                                    <span style={styles.chipColor}>{result.outfit.bottom.color}</span>
                                </div>
                            )}
                            {result.outfit?.outer && (
                                <div style={styles.outfitChip}>
                                    <span style={styles.chipLabel}>아우터</span>
                                    <span style={styles.chipValue}>{result.outfit.outer.type}</span>
                                    <span style={styles.chipColor}>{result.outfit.outer.color}</span>
                                </div>
                            )}
                        </div>

                        {result.outfit?.description && (
                            <p style={styles.outfitDesc}>{result.outfit.description}</p>
                        )}

                        {result.matched_items?.length > 0 && (
                            <div style={styles.matchedSection}>
                                <p style={styles.matchedTitle}>내 옷장 매칭 아이템</p>
                                <div style={styles.matchedGrid}>
                                    {result.matched_items.map((item, i) => (
                                        <div key={i} style={styles.matchedCard}>
                                            {(item.imageUrl || item.imageB64) && (
                                                <img src={item.imageUrl || item.imageB64}
                                                     alt={item.type} style={styles.matchedImg} />
                                            )}
                                            <p style={styles.matchedType}>{item.type}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button style={styles.retryBtn}
                                onClick={() => { setResult(null); setSaved(false); }}>
                            다시 추천받기
                        </button>
                    </div>
                )}
            </div>

            {/* 캘린더 팝업 */}
            {showCalendarPopup && (
                <>
                    <div style={styles.overlay} onClick={() => setShowCalendarPopup(false)} />
                    <div style={styles.calPopup}>
                        <div style={styles.calHeader}>
                            <button style={styles.calNavBtn} onClick={() => {
                                if (calMonth === 0) { setCalYear(y => y-1); setCalMonth(11); }
                                else setCalMonth(m => m-1);
                            }}>‹</button>
                            <span style={styles.calTitle}>{calYear}년 {calMonth+1}월</span>
                            <button style={styles.calNavBtn} onClick={() => {
                                if (calMonth === 11) { setCalYear(y => y+1); setCalMonth(0); }
                                else setCalMonth(m => m+1);
                            }}>›</button>
                            <button style={styles.calCloseBtn} onClick={() => setShowCalendarPopup(false)}>✕</button>
                        </div>
                        <div style={styles.calWeekRow}>
                            {['일','월','화','수','목','금','토'].map((d, i) => (
                                <div key={d} style={{ ...styles.calWeekday, color: i===0?'#FF5A5A':i===6?theme.colors.blue:theme.colors.textSub }}>{d}</div>
                            ))}
                        </div>
                        <div style={styles.calGrid}>
                            {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
                            {Array.from({ length: daysInMonth }).map((_, i) => {
                                const day = i+1;
                                const dayEvts = getEventsOnDay(calYear, calMonth, day);
                                const isTodayDay = today.getFullYear()===calYear && today.getMonth()===calMonth && today.getDate()===day;
                                const isSelDay = selectedDate.getFullYear()===calYear && selectedDate.getMonth()===calMonth && selectedDate.getDate()===day;
                                const dow = (firstDay+i) % 7;
                                return (
                                    <div key={day} style={{
                                        ...styles.calDay,
                                        backgroundColor: isSelDay ? theme.colors.primary : isTodayDay ? theme.colors.primaryLight : 'transparent',
                                        cursor: 'pointer'
                                    }} onClick={() => handleDaySelect(day)}>
                                        <span style={{
                                            fontSize: '13px', fontWeight: '500',
                                            color: isSelDay ? 'white' : dow===0?'#FF5A5A':dow===6?theme.colors.blue:theme.colors.text
                                        }}>{day}</span>
                                        {dayEvts.length > 0 && (
                                            <div style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
                                                {dayEvts.slice(0,3).map((ev, ei) => (
                                                    <div key={ei} style={{
                                                        width: '4px', height: '4px', borderRadius: '50%',
                                                        backgroundColor: isSelDay ? 'white' : getTpoColor(ev.tpoKeyword)
                                                    }} />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

const styles = {
    page: { backgroundColor: theme.colors.background, minHeight: '100vh' },
    container: { maxWidth: '480px', margin: '0 auto', padding: '20px 20px 90px' },
    title: { fontSize: '22px', fontWeight: '700', color: theme.colors.text, margin: '0 0 6px' },
    subtitle: { fontSize: '13px', color: theme.colors.textSub, margin: '0 0 20px' },
    sectionLabel: { fontSize: '16px', fontWeight: '600', color: theme.colors.text, margin: '0 0 12px' },
    infoCard: {
        backgroundColor: theme.colors.white, borderRadius: theme.radius.xl,
        padding: '18px', marginBottom: '20px', boxShadow: theme.colors.cardShadow
    },
    dateRow: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' },
    dateBtn: {
        display: 'flex', alignItems: 'center', gap: '8px', background: 'none',
        border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.full,
        padding: '8px 16px', cursor: 'pointer'
    },
    dateBtnText: { fontSize: '16px', fontWeight: '700', color: theme.colors.text },
    calIcon: { fontSize: '16px' },
    todayBtn: {
        padding: '6px 12px', backgroundColor: theme.colors.primaryLight, color: theme.colors.primary,
        border: 'none', borderRadius: theme.radius.full, fontSize: '12px', cursor: 'pointer', fontWeight: '500'
    },
    weatherRow: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' },
    weatherTemp: { fontSize: '18px', fontWeight: '700', color: theme.colors.text },
    weatherDesc: { fontSize: '13px', color: theme.colors.textSub },
    weatherDetail: { fontSize: '12px', color: theme.colors.textLight },
    weatherUnavailable: { fontSize: '13px', color: theme.colors.textLight, margin: '0 0 8px' },
    eventSection: { borderTop: `1px solid ${theme.colors.border}`, paddingTop: '12px', marginTop: '4px' },
    eventLabel: { fontSize: '12px', color: theme.colors.textSub, margin: '0 0 8px' },
    eventChips: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
    eventChip: {
        padding: '7px 14px', borderRadius: theme.radius.full, fontSize: '13px',
        fontWeight: '500', cursor: 'pointer', transition: 'all 0.2s'
    },
    tpoGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' },
    tpoCard: {
        borderRadius: theme.radius.lg, padding: '14px 8px', textAlign: 'center',
        cursor: 'pointer', border: 'none', transition: 'all 0.2s',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px'
    },
    tpoEmoji: { fontSize: '24px' },
    tpoLabel: { fontSize: '12px', fontWeight: '500' },
    error: { color: theme.colors.danger, fontSize: '13px', marginBottom: '12px' },
    recommendBtn: {
        width: '100%', padding: '15px', backgroundColor: theme.colors.primary, color: 'white',
        border: 'none', borderRadius: theme.radius.full, fontSize: '15px',
        cursor: 'pointer', fontWeight: '700', marginBottom: '20px'
    },
    resultCard: {
        backgroundColor: theme.colors.white, borderRadius: theme.radius.xl,
        padding: '20px', boxShadow: theme.colors.cardShadow
    },
    resultHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
    resultTitle: { fontSize: '16px', fontWeight: '700', color: theme.colors.text, margin: 0 },
    saveBtn: {
        padding: '6px 14px', backgroundColor: theme.colors.primary, color: 'white',
        border: 'none', borderRadius: theme.radius.full, fontSize: '13px', cursor: 'pointer', fontWeight: '500'
    },
    savedBadge: { fontSize: '13px', color: theme.colors.primary, fontWeight: '600' },
    styleTag: {
        display: 'inline-block', backgroundColor: theme.colors.primaryLight, color: theme.colors.primary,
        borderRadius: theme.radius.full, padding: '4px 14px', fontSize: '12px',
        fontWeight: '600', marginBottom: '14px'
    },
    outfitChips: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' },
    outfitChip: {
        backgroundColor: theme.colors.background, borderRadius: theme.radius.md,
        padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: '80px'
    },
    chipLabel: { fontSize: '10px', color: theme.colors.primary, fontWeight: '600' },
    chipValue: { fontSize: '13px', fontWeight: '600', color: theme.colors.text },
    chipColor: { fontSize: '11px', color: theme.colors.textSub },
    outfitDesc: {
        fontSize: '13px', color: theme.colors.textSub, lineHeight: '1.6',
        backgroundColor: theme.colors.background, borderRadius: theme.radius.md,
        padding: '10px 12px', marginBottom: '14px'
    },
    matchedSection: { borderTop: `1px solid ${theme.colors.border}`, paddingTop: '14px' },
    matchedTitle: { fontSize: '13px', color: theme.colors.textSub, marginBottom: '10px' },
    matchedGrid: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' },
    matchedCard: { textAlign: 'center' },
    matchedImg: { width: '80px', height: '80px', objectFit: 'cover', borderRadius: theme.radius.md },
    matchedType: { fontSize: '11px', color: theme.colors.textSub, marginTop: '4px' },
    retryBtn: {
        width: '100%', padding: '11px', backgroundColor: theme.colors.primaryLight,
        color: theme.colors.primary, border: 'none', borderRadius: theme.radius.full,
        fontSize: '14px', cursor: 'pointer', fontWeight: '600'
    },
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 200 },
    calPopup: {
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        backgroundColor: theme.colors.white, borderRadius: theme.radius.xl,
        width: '340px', maxWidth: '90vw', zIndex: 201,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)', padding: '20px'
    },
    calHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' },
    calNavBtn: { background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: theme.colors.text, padding: '4px 8px' },
    calTitle: { fontSize: '16px', fontWeight: '700', color: theme.colors.text },
    calCloseBtn: { background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#999' },
    calWeekRow: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '8px' },
    calWeekday: { textAlign: 'center', fontSize: '12px', fontWeight: '600', padding: '4px 0' },
    calGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' },
    calDay: {
        minHeight: '40px', borderRadius: theme.radius.md, padding: '4px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px'
    },
};

export default Recommend;