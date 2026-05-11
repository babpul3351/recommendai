import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { weatherAPI, wardrobeAPI, calendarAPI } from '../api/api';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function Home() {
    const navigate = useNavigate();
    const nickname = localStorage.getItem('nickname') || '사용자';
    const [weather, setWeather] = useState(null);
    const [recommendation, setRecommendation] = useState(null);
    const [todayEvents, setTodayEvents] = useState([]);
    const [weekEvents, setWeekEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showEventRecommendPrompt, setShowEventRecommendPrompt] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);

    const today = new Date();

    useEffect(() => {
        fetchWeather();
        fetchCalendarData();
    }, []);

    const fetchWeather = async () => {
        try {
            const res = await weatherAPI.getWeather();
            setWeather(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchCalendarData = async () => {
        try {
            const res = await calendarAPI.getEvents();
            const allEvents = res.data;

            // 오늘 일정
            const todayEvts = allEvents.filter(e => {
                const d = new Date(e.eventDatetime);
                return d.getFullYear() === today.getFullYear() &&
                    d.getMonth() === today.getMonth() &&
                    d.getDate() === today.getDate();
            });
            setTodayEvents(todayEvts);

            // 이번 주 일정 (오늘 포함 7일)
            const weekEnd = new Date(today);
            weekEnd.setDate(today.getDate() + 6);
            const weekEvts = allEvents.filter(e => {
                const d = new Date(e.eventDatetime);
                return d >= today && d <= weekEnd;
            });
            setWeekEvents(weekEvts);
        } catch (err) { console.error(err); }
    };

    const fetchRecommendation = async (tpo = '일상', eventId = null) => {
        setLoading(true);
        setShowEventRecommendPrompt(false);
        try {
            const body = { tpo, mode: 'rag', linkedEvents: [] };
            if (eventId) body.linkedEvents = [eventId];
            const res = await wardrobeAPI.recommend(body);
            setRecommendation(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
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

    const getTpoEmoji = (tpo) => {
        const map = { '데이트':'💑','직장':'💼','캐주얼':'👟','운동':'🏃','파티':'🎉','여행':'✈️','일상':'☀️','격식':'👔' };
        return map[tpo] || '📅';
    };

    const formatTime = (datetime) => {
        const d = new Date(datetime);
        return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    };

    const getDayLabel = (datetime) => {
        const d = new Date(datetime);
        const diff = Math.floor((d - today) / (1000 * 60 * 60 * 24));
        if (diff === 0) return '오늘';
        if (diff === 1) return '내일';
        return `${d.getMonth() + 1}/${d.getDate()} (${WEEKDAYS[d.getDay()]})`;
    };

    // 주간 캘린더 날짜 배열 생성
    const weekDays = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        return d;
    });

    const getEventsOnDay = (date) => weekEvents.filter(e => {
        const d = new Date(e.eventDatetime);
        return d.getFullYear() === date.getFullYear() &&
            d.getMonth() === date.getMonth() &&
            d.getDate() === date.getDate();
    });

    return (
        <div style={styles.page}>
            <Navbar />
            <div style={styles.container}>

                {/* 인사말 */}
                <div style={styles.greeting}>
                    <h1 style={styles.greetingText}>
                        안녕하세요, <span style={styles.greetingName}>{nickname}</span>님 👋
                    </h1>
                    <p style={styles.greetingDate}>
                        {today.getFullYear()}년 {today.getMonth() + 1}월 {today.getDate()}일
                        ({WEEKDAYS[today.getDay()]})
                    </p>
                </div>

                {/* 날씨 카드 */}
                <div style={styles.weatherCard}>
                    {weather ? (
                        <>
                            <div style={styles.weatherEmoji}>{getWeatherEmoji(weather.desc)}</div>
                            <div style={styles.weatherInfo}>
                                <p style={styles.weatherCity}>{weather.city}</p>
                                <p style={styles.weatherTemp}>{weather.temp}°C</p>
                                <p style={styles.weatherDesc}>{weather.desc}</p>
                                <p style={styles.weatherDetail}>
                                    체감 {weather.feelsLike}°C · 습도 {weather.humidity}%
                                </p>
                            </div>
                        </>
                    ) : (
                        <p style={{ color: '#888' }}>날씨 정보를 불러오는 중...</p>
                    )}
                </div>

                {/* 오늘의 추천 코디 */}
                <div style={styles.section}>
                    <h2 style={styles.sectionTitle}>오늘의 추천 코디</h2>

                    {/* 추천 결과가 있는 경우 */}
                    {recommendation ? (
                        <div>
                            <div style={styles.outfitGrid}>
                                {recommendation.outfit.top && (
                                    <div style={styles.outfitItem}>
                                        <p style={styles.outfitLabel}>상의</p>
                                        <p style={styles.outfitType}>{recommendation.outfit.top.type}</p>
                                        <p style={styles.outfitColor}>{recommendation.outfit.top.color}</p>
                                    </div>
                                )}
                                {recommendation.outfit.bottom && (
                                    <div style={styles.outfitItem}>
                                        <p style={styles.outfitLabel}>하의</p>
                                        <p style={styles.outfitType}>{recommendation.outfit.bottom.type}</p>
                                        <p style={styles.outfitColor}>{recommendation.outfit.bottom.color}</p>
                                    </div>
                                )}
                                {recommendation.outfit.outer && (
                                    <div style={styles.outfitItem}>
                                        <p style={styles.outfitLabel}>아우터</p>
                                        <p style={styles.outfitType}>{recommendation.outfit.outer.type}</p>
                                        <p style={styles.outfitColor}>{recommendation.outfit.outer.color}</p>
                                    </div>
                                )}
                            </div>
                            <p style={styles.outfitDesc}>{recommendation.outfit.description}</p>
                            {recommendation.matched_items?.length > 0 && (
                                <div style={styles.matchedRow}>
                                    {recommendation.matched_items.map((item, i) => (
                                        <div key={i} style={styles.matchedItem}>
                                            {item.imageB64 && (
                                                <img src={item.imageB64} alt={item.type} style={styles.matchedImg} />
                                            )}
                                            <p style={styles.matchedType}>{item.type}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <button
                                style={{ ...styles.secondaryBtn, marginTop: '16px' }}
                                onClick={() => setRecommendation(null)}
                            >
                                다시 추천받기
                            </button>
                        </div>

                    ) : loading ? (
                        <div style={styles.loadingBox}>
                            <p style={styles.loadingText}>AI가 코디를 분석 중이에요...</p>
                        </div>

                    ) : showEventRecommendPrompt && selectedEvent ? (
                        /* 일정 기반 추천 제안 */
                        <div style={styles.eventPromptBox}>
                            <p style={styles.eventPromptEmoji}>{getTpoEmoji(selectedEvent.tpoKeyword)}</p>
                            <p style={styles.eventPromptText}>
                                오늘 <strong>{selectedEvent.eventName}</strong> 일정이 있어요!
                            </p>
                            <p style={styles.eventPromptSub}>
                                이 일정에 맞는 코디를 추천해드릴까요?
                            </p>
                            <div style={styles.promptBtnRow}>
                                <button
                                    style={styles.primaryBtn}
                                    onClick={() => fetchRecommendation(selectedEvent.tpoKeyword, selectedEvent.eventId)}
                                >
                                    {selectedEvent.tpoKeyword} 코디 추천받기
                                </button>
                                <button
                                    style={styles.secondaryBtn}
                                    onClick={() => fetchRecommendation('일상')}
                                >
                                    일상 코디로 추천받기
                                </button>
                            </div>
                        </div>

                    ) : todayEvents.length > 0 ? (
                        /* 오늘 일정이 있는 경우 */
                        <div>
                            <div style={styles.todayEventBox}>
                                <p style={styles.todayEventTitle}>오늘의 일정</p>
                                {todayEvents.map(ev => (
                                    <div key={ev.eventId} style={styles.todayEventItem}>
                                        <span style={{ fontSize: '20px' }}>{getTpoEmoji(ev.tpoKeyword)}</span>
                                        <div>
                                            <p style={styles.todayEventName}>{ev.eventName}</p>
                                            <p style={styles.todayEventTime}>{formatTime(ev.eventDatetime)}</p>
                                        </div>
                                        <button
                                            style={{
                                                ...styles.eventRecommendBtn,
                                                backgroundColor: getTpoColor(ev.tpoKeyword)
                                            }}
                                            onClick={() => {
                                                setSelectedEvent(ev);
                                                setShowEventRecommendPrompt(true);
                                            }}
                                        >
                                            코디 추천
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button
                                style={{ ...styles.secondaryBtn, marginTop: '12px' }}
                                onClick={() => fetchRecommendation('일상')}
                            >
                                일상 코디로 추천받기
                            </button>
                        </div>

                    ) : (
                        /* 일정도 코디도 없는 경우 */
                        <div style={styles.emptyBox}>
                            <p style={styles.emptyText}>
                                AI가 오늘 날씨와 내 옷장을 분석해서 코디를 추천해드려요
                            </p>
                            <button
                                style={styles.primaryBtn}
                                onClick={() => fetchRecommendation('일상')}
                                disabled={loading}
                            >
                                오늘의 코디 추천받기
                            </button>
                        </div>
                    )}
                </div>

                {/* 주간 캘린더 */}
                <div style={styles.section}>
                    <div style={styles.weekHeader}>
                        <h2 style={styles.sectionTitle}>이번 주 일정</h2>
                        <button style={styles.moreBtn} onClick={() => navigate('/calendar')}>
                            전체 보기 →
                        </button>
                    </div>

                    <div style={styles.weekGrid}>
                        {weekDays.map((date, i) => {
                            const dayEvts = getEventsOnDay(date);
                            const isToday = i === 0;
                            const dow = date.getDay();

                            return (
                                <div
                                    key={i}
                                    style={{
                                        ...styles.weekDayCol,
                                        backgroundColor: isToday ? '#f0f0f0' : 'white',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => navigate('/calendar')}
                                >
                                    <p style={{
                                        ...styles.weekDayName,
                                        color: dow === 0 ? '#FF3B30' : dow === 6 ? '#007AFF' : '#888'
                                    }}>
                                        {WEEKDAYS[dow]}
                                    </p>
                                    <p style={{
                                        ...styles.weekDayNum,
                                        backgroundColor: isToday ? '#333' : 'transparent',
                                        color: isToday ? 'white' : '#333'
                                    }}>
                                        {date.getDate()}
                                    </p>
                                    <div style={styles.weekEventList}>
                                        {dayEvts.length === 0 ? (
                                            <div style={styles.noEventDot} />
                                        ) : (
                                            dayEvts.slice(0, 2).map((ev, ei) => (
                                                <div key={ei} style={{
                                                    ...styles.weekEventChip,
                                                    backgroundColor: getTpoColor(ev.tpoKeyword) + '22',
                                                    borderLeft: `2px solid ${getTpoColor(ev.tpoKeyword)}`
                                                }}>
                                                    <span style={{
                                                        fontSize: '10px',
                                                        color: getTpoColor(ev.tpoKeyword),
                                                        overflow: 'hidden',
                                                        whiteSpace: 'nowrap',
                                                        textOverflow: 'ellipsis'
                                                    }}>
                                                        {ev.eventName}
                                                    </span>
                                                </div>
                                            ))
                                        )}
                                        {dayEvts.length > 2 && (
                                            <p style={styles.moreEventsText}>+{dayEvts.length - 2}</p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

const styles = {
    page: { backgroundColor: '#f5f5f5', minHeight: '100vh' },
    container: { maxWidth: '800px', margin: '0 auto', padding: '24px 16px' },
    greeting: { marginBottom: '20px' },
    greetingText: { fontSize: '22px', fontWeight: 'bold', color: '#333', margin: '0 0 4px' },
    greetingName: { color: '#333' },
    greetingDate: { fontSize: '14px', color: '#888', margin: 0 },
    weatherCard: {
        display: 'flex', alignItems: 'center', gap: '24px',
        backgroundColor: 'white', borderRadius: '16px', padding: '20px',
        marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
    },
    weatherEmoji: { fontSize: '56px' },
    weatherInfo: {},
    weatherCity: { fontSize: '13px', color: '#888', margin: '0 0 4px' },
    weatherTemp: { fontSize: '40px', fontWeight: 'bold', color: '#333', margin: '0 0 4px' },
    weatherDesc: { fontSize: '15px', color: '#555', margin: '0 0 4px' },
    weatherDetail: { fontSize: '12px', color: '#888', margin: 0 },
    section: {
        backgroundColor: 'white', borderRadius: '16px', padding: '20px',
        marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
    },
    sectionTitle: { fontSize: '17px', fontWeight: 'bold', color: '#333', margin: '0 0 16px' },
    loadingBox: { textAlign: 'center', padding: '32px 0' },
    loadingText: { color: '#888', fontSize: '14px' },
    emptyBox: { textAlign: 'center', padding: '24px 0' },
    emptyText: { color: '#888', fontSize: '14px', marginBottom: '16px' },
    primaryBtn: {
        padding: '12px 24px', backgroundColor: '#333', color: 'white',
        border: 'none', borderRadius: '8px', fontSize: '14px',
        cursor: 'pointer', fontWeight: '500'
    },
    secondaryBtn: {
        padding: '10px 20px', backgroundColor: '#f0f0f0', color: '#333',
        border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer'
    },
    outfitGrid: { display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' },
    outfitItem: {
        flex: 1, minWidth: '80px', backgroundColor: '#f9f9f9',
        borderRadius: '8px', padding: '12px', textAlign: 'center'
    },
    outfitLabel: { fontSize: '11px', color: '#888', margin: '0 0 4px' },
    outfitType: { fontSize: '13px', fontWeight: 'bold', color: '#333', margin: '0 0 2px' },
    outfitColor: { fontSize: '12px', color: '#666', margin: 0 },
    outfitDesc: { fontSize: '13px', color: '#555', lineHeight: '1.6', marginBottom: '12px' },
    matchedRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' },
    matchedItem: { textAlign: 'center' },
    matchedImg: { width: '72px', height: '72px', objectFit: 'cover', borderRadius: '8px' },
    matchedType: { fontSize: '11px', color: '#666', marginTop: '4px' },
    todayEventBox: {
        backgroundColor: '#f9f9f9', borderRadius: '12px', padding: '14px', marginBottom: '8px'
    },
    todayEventTitle: { fontSize: '12px', color: '#888', margin: '0 0 10px' },
    todayEventItem: {
        display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px'
    },
    todayEventName: { fontSize: '14px', fontWeight: 'bold', color: '#333', margin: '0 0 2px' },
    todayEventTime: { fontSize: '12px', color: '#888', margin: 0 },
    eventRecommendBtn: {
        marginLeft: 'auto', padding: '6px 12px', color: 'white',
        border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer'
    },
    eventPromptBox: { textAlign: 'center', padding: '16px 0' },
    eventPromptEmoji: { fontSize: '40px', margin: '0 0 8px' },
    eventPromptText: { fontSize: '16px', color: '#333', margin: '0 0 6px' },
    eventPromptSub: { fontSize: '13px', color: '#888', margin: '0 0 20px' },
    promptBtnRow: { display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' },
    weekHeader: {
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: '12px'
    },
    moreBtn: {
        background: 'none', border: 'none', fontSize: '13px',
        color: '#888', cursor: 'pointer'
    },
    weekGrid: { display: 'flex', gap: '6px' },
    weekDayCol: {
        flex: 1, borderRadius: '10px', padding: '8px 4px',
        textAlign: 'center', minHeight: '80px'
    },
    weekDayName: { fontSize: '11px', fontWeight: '600', margin: '0 0 4px' },
    weekDayNum: {
        width: '26px', height: '26px', borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '13px', fontWeight: '500', margin: '0 auto 6px'
    },
    weekEventList: { display: 'flex', flexDirection: 'column', gap: '2px' },
    noEventDot: {
        width: '4px', height: '4px', borderRadius: '50%',
        backgroundColor: '#e0e0e0', margin: '0 auto'
    },
    weekEventChip: {
        borderRadius: '3px', padding: '2px 4px',
        display: 'flex', alignItems: 'center'
    },
    moreEventsText: { fontSize: '10px', color: '#888', margin: '2px 0 0' }
};

export default Home;