import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { wardrobeAPI, weatherAPI, calendarAPI } from '../api/api';

const TPO_LIST = [
    { key: '데이트', emoji: '💑' },
    { key: '직장', emoji: '💼' },
    { key: '캐주얼', emoji: '👟' },
    { key: '운동', emoji: '🏃' },
    { key: '파티', emoji: '🎉' },
    { key: '여행', emoji: '✈️' },
    { key: '일상', emoji: '☀️' },
    { key: '격식', emoji: '👔' },
];

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function Recommend() {
    const [selectedTpo, setSelectedTpo] = useState(null);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [weather, setWeather] = useState(null);
    const [todayEvents, setTodayEvents] = useState([]);
    const [selectedEventIds, setSelectedEventIds] = useState([]);

    const today = new Date();

    useEffect(() => {
        fetchWeather();
        fetchTodayEvents();
    }, []);

    const fetchWeather = async () => {
        try {
            const res = await weatherAPI.getWeather();
            setWeather(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchTodayEvents = async () => {
        try {
            const res = await calendarAPI.getEvents();
            const todayEvts = res.data.filter(e => {
                const d = new Date(e.eventDatetime);
                return d.getFullYear() === today.getFullYear() &&
                    d.getMonth() === today.getMonth() &&
                    d.getDate() === today.getDate();
            });
            setTodayEvents(todayEvts);
            // 오늘 일정이 있으면 자동으로 선택
            if (todayEvts.length > 0) {
                setSelectedEventIds(todayEvts.map(e => e.eventId));
                setSelectedTpo(todayEvts[0].tpoKeyword);
            }
        } catch (err) { console.error(err); }
    };

    const getWeatherEmoji = (desc) => {
        if (!desc) return '🌤️';
        if (desc.includes('맑')) return '☀️';
        if (desc.includes('구름')) return '⛅';
        if (desc.includes('비')) return '🌧️';
        if (desc.includes('눈')) return '❄️';
        if (desc.includes('흐림')) return '☁️';
        return '🌤️';
    };

    const getTpoColor = (tpo) => {
        const map = {
            '데이트': '#FF6B9D', '직장': '#4A90E2', '캐주얼': '#7ED321',
            '운동': '#F5A623', '파티': '#BD10E0', '여행': '#50E3C2',
            '일상': '#9B9B9B', '격식': '#4A4A4A'
        };
        return map[tpo] || '#4A90E2';
    };

    const toggleEvent = (eventId) => {
        setSelectedEventIds(prev =>
            prev.includes(eventId)
                ? prev.filter(id => id !== eventId)
                : [...prev, eventId]
        );
    };

    const handleRecommend = async () => {
        if (!selectedTpo) {
            setError('TPO를 선택해주세요.');
            return;
        }
        setLoading(true);
        setError('');
        setResult(null);
        try {
            const res = await wardrobeAPI.recommend({
                tpo: selectedTpo,
                mode: 'rag',
                linkedEventIds: selectedEventIds
            });
            setResult(res.data);
        } catch (err) {
            setError('추천에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.page}>
            <Navbar />
            <div style={styles.container}>
                <h1 style={styles.title}>코디 추천</h1>

                {/* 날짜 + 날씨 + 일정 박스 */}
                <div style={styles.infoBox}>
                    <div style={styles.infoLeft}>
                        <p style={styles.infoDate}>
                            {today.getMonth() + 1}월 {today.getDate()}일
                            ({WEEKDAYS[today.getDay()]})
                        </p>
                        {weather && (
                            <div style={styles.weatherRow}>
                                <span style={styles.weatherEmoji}>
                                    {getWeatherEmoji(weather.desc)}
                                </span>
                                <span style={styles.weatherTemp}>{weather.temp}°C</span>
                                <span style={styles.weatherDesc}>{weather.desc}</span>
                                <span style={styles.weatherDetail}>
                                    · 체감 {weather.feelsLike}°C · 습도 {weather.humidity}%
                                </span>
                            </div>
                        )}
                    </div>

                    {/* 오늘 일정 */}
                    {todayEvents.length > 0 && (
                        <div style={styles.eventSection}>
                            <p style={styles.eventSectionTitle}>오늘의 일정</p>
                            {todayEvents.map(ev => (
                                <div
                                    key={ev.eventId}
                                    style={{
                                        ...styles.eventChip,
                                        backgroundColor: selectedEventIds.includes(ev.eventId)
                                            ? getTpoColor(ev.tpoKeyword)
                                            : '#f0f0f0',
                                        color: selectedEventIds.includes(ev.eventId)
                                            ? 'white' : '#333',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => toggleEvent(ev.eventId)}
                                >
                                    <span>{ev.eventName}</span>
                                    <span style={styles.eventTpo}>· {ev.tpoKeyword}</span>
                                    {selectedEventIds.includes(ev.eventId) && (
                                        <span style={styles.checkMark}>✓</span>
                                    )}
                                </div>
                            ))}
                            <p style={styles.eventHint}>
                                일정을 선택하면 해당 일정 정보가 AI에게 전달됩니다
                            </p>
                        </div>
                    )}
                </div>

                {/* TPO 선택 */}
                <div style={styles.section}>
                    <h2 style={styles.sectionTitle}>TPO 선택</h2>
                    <div style={styles.tpoGrid}>
                        {TPO_LIST.map(tpo => (
                            <div
                                key={tpo.key}
                                style={{
                                    ...styles.tpoCard,
                                    backgroundColor: selectedTpo === tpo.key ? '#333' : 'white',
                                    color: selectedTpo === tpo.key ? 'white' : '#333',
                                    boxShadow: selectedTpo === tpo.key
                                        ? '0 4px 12px rgba(0,0,0,0.2)'
                                        : '0 2px 8px rgba(0,0,0,0.08)'
                                }}
                                onClick={() => setSelectedTpo(tpo.key)}
                            >
                                <p style={styles.tpoEmoji}>{tpo.emoji}</p>
                                <p style={styles.tpoLabel}>{tpo.key}</p>
                            </div>
                        ))}
                    </div>

                    {error && <p style={styles.error}>{error}</p>}

                    <button
                        style={{
                            ...styles.button,
                            opacity: loading ? 0.7 : 1
                        }}
                        onClick={handleRecommend}
                        disabled={loading}
                    >
                        {loading ? 'AI가 코디를 분석 중...' : '코디 추천받기'}
                    </button>
                </div>

                {/* 추천 결과 */}
                {result && (
                    <div style={styles.section}>
                        <h2 style={styles.sectionTitle}>추천 결과</h2>

                        <div style={styles.styleTag}>
                            <span>{result.outfit.style}</span>
                        </div>

                        <div style={styles.outfitGrid}>
                            {result.outfit.top && (
                                <div style={styles.outfitItem}>
                                    <p style={styles.outfitLabel}>상의</p>
                                    <p style={styles.outfitType}>{result.outfit.top.type}</p>
                                    <p style={styles.outfitColor}>{result.outfit.top.color}</p>
                                </div>
                            )}
                            {result.outfit.bottom && (
                                <div style={styles.outfitItem}>
                                    <p style={styles.outfitLabel}>하의</p>
                                    <p style={styles.outfitType}>{result.outfit.bottom.type}</p>
                                    <p style={styles.outfitColor}>{result.outfit.bottom.color}</p>
                                </div>
                            )}
                            {result.outfit.outer && (
                                <div style={styles.outfitItem}>
                                    <p style={styles.outfitLabel}>아우터</p>
                                    <p style={styles.outfitType}>{result.outfit.outer.type}</p>
                                    <p style={styles.outfitColor}>{result.outfit.outer.color}</p>
                                </div>
                            )}
                        </div>

                        <div style={styles.descBox}>
                            <p style={styles.desc}>{result.outfit.description}</p>
                        </div>

                        {result.matched_items?.length > 0 && (
                            <div style={styles.matchedSection}>
                                <p style={styles.matchedTitle}>내 옷장에서 매칭된 아이템</p>
                                <div style={styles.matchedGrid}>
                                    {result.matched_items.map((item, i) => (
                                        <div key={i} style={styles.matchedCard}>
                                            {item.imageB64 && (
                                                <img src={item.imageB64} alt={item.type}
                                                     style={styles.matchedImage} />
                                            )}
                                            <p style={styles.matchedType}>{item.type}</p>
                                            <p style={styles.matchedColor}>{item.color}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button
                            style={{ ...styles.button, backgroundColor: '#666', marginTop: '16px' }}
                            onClick={() => { setResult(null); }}
                        >
                            다시 추천받기
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

const styles = {
    page: { backgroundColor: '#f5f5f5', minHeight: '100vh' },
    container: { maxWidth: '800px', margin: '0 auto', padding: '24px 16px' },
    title: { fontSize: '24px', fontWeight: 'bold', color: '#333', margin: '0 0 16px' },
    infoBox: {
        backgroundColor: 'white', borderRadius: '16px', padding: '20px',
        marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
    },
    infoLeft: { marginBottom: '0' },
    infoDate: { fontSize: '20px', fontWeight: 'bold', color: '#333', margin: '0 0 8px' },
    weatherRow: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
    weatherEmoji: { fontSize: '24px' },
    weatherTemp: { fontSize: '22px', fontWeight: 'bold', color: '#333' },
    weatherDesc: { fontSize: '14px', color: '#555' },
    weatherDetail: { fontSize: '13px', color: '#888' },
    eventSection: { marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f0f0f0' },
    eventSectionTitle: { fontSize: '13px', color: '#888', margin: '0 0 10px' },
    eventChip: {
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '8px 14px', borderRadius: '20px', marginRight: '8px',
        marginBottom: '8px', fontSize: '13px', fontWeight: '500',
        transition: 'all 0.2s'
    },
    eventTpo: { opacity: 0.8, fontSize: '12px' },
    checkMark: { fontSize: '12px' },
    eventHint: { fontSize: '11px', color: '#aaa', margin: '6px 0 0' },
    section: {
        backgroundColor: 'white', borderRadius: '16px', padding: '20px',
        marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
    },
    sectionTitle: { fontSize: '17px', fontWeight: 'bold', color: '#333', marginBottom: '16px' },
    tpoGrid: {
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '10px', marginBottom: '20px'
    },
    tpoCard: {
        borderRadius: '12px', padding: '14px', textAlign: 'center',
        cursor: 'pointer', transition: 'all 0.2s', border: '1px solid #f0f0f0'
    },
    tpoEmoji: { fontSize: '26px', margin: '0 0 6px' },
    tpoLabel: { fontSize: '13px', fontWeight: '500', margin: 0 },
    error: { color: 'red', fontSize: '13px', marginBottom: '12px' },
    button: {
        width: '100%', padding: '14px', backgroundColor: '#333',
        color: 'white', border: 'none', borderRadius: '8px',
        fontSize: '15px', cursor: 'pointer', fontWeight: '500'
    },
    styleTag: {
        display: 'inline-block', backgroundColor: '#f0f0f0',
        borderRadius: '20px', padding: '4px 16px',
        fontSize: '13px', color: '#555', marginBottom: '16px'
    },
    outfitGrid: { display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' },
    outfitItem: {
        flex: 1, minWidth: '80px', backgroundColor: '#f9f9f9',
        borderRadius: '8px', padding: '12px', textAlign: 'center'
    },
    outfitLabel: { fontSize: '11px', color: '#888', margin: '0 0 4px' },
    outfitType: { fontSize: '13px', fontWeight: 'bold', color: '#333', margin: '0 0 2px' },
    outfitColor: { fontSize: '12px', color: '#666', margin: 0 },
    descBox: {
        backgroundColor: '#f9f9f9', borderRadius: '8px',
        padding: '14px', marginBottom: '14px'
    },
    desc: { fontSize: '14px', color: '#555', lineHeight: '1.6', margin: 0 },
    matchedSection: { borderTop: '1px solid #f0f0f0', paddingTop: '14px' },
    matchedTitle: { fontSize: '13px', color: '#888', marginBottom: '10px' },
    matchedGrid: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
    matchedCard: { textAlign: 'center' },
    matchedImage: { width: '90px', height: '90px', objectFit: 'cover', borderRadius: '8px' },
    matchedType: { fontSize: '12px', color: '#333', fontWeight: '500', marginTop: '4px' },
    matchedColor: { fontSize: '11px', color: '#888', margin: 0 }
};

export default Recommend;