import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { weatherAPI, wardrobeAPI, calendarAPI, recommendationAPI } from '../api/api';
import { theme } from '../styles/theme';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function Home() {
    const navigate = useNavigate();
    const nickname = localStorage.getItem('nickname') || '사용자';
    const [weather, setWeather] = useState(null);
    const [recommendation, setRecommendation] = useState(null);
    const [todayEvents, setTodayEvents] = useState([]);
    const [weekEvents, setWeekEvents] = useState([]);
    const [weekOutfits, setWeekOutfits] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showEventRecommendPrompt, setShowEventRecommendPrompt] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [popup, setPopup] = useState(null);

    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const toDateStr = (date) => {
        const d = new Date(date);
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    };

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
        return '🌤️';
    };

    const getTpoColor = (tpo) => {
        const map = {
            '데이트': '#FF6B9D', '직장': '#4A90D9', '캐주얼': '#7EC8A4',
            '운동': '#F5A623', '파티': '#BD10E0', '여행': '#50E3C2',
            '일상': '#9B9B9B', '격식': '#4A4A4A'
        };
        return map[tpo] || theme.colors.primary;
    };

    const getTpoEmoji = (tpo) => {
        const map = { '데이트':'💑','직장':'💼','캐주얼':'👟','운동':'🏃','파티':'🎉','여행':'✈️','일상':'☀️','격식':'👔' };
        return map[tpo] || '📅';
    };

    const formatTime = (datetime) => {
        const d = new Date(datetime);
        return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    };

    const getEventsOnDay = (date) => weekEvents.filter(e => {
        const d = new Date(e.eventDatetime);
        return d.getFullYear() === date.getFullYear() &&
            d.getMonth() === date.getMonth() &&
            d.getDate() === date.getDate();
    });

    const getOutfitsOnDay = (date) => weekOutfits.filter(o => o.outfitDate === toDateStr(date));

    const weekDays = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        return d;
    });

    return (
        <div style={styles.page}>
            <Navbar />
            <div style={styles.container}>

                {/* 인사말 */}
                <p style={styles.greeting}>안녕하세요, <strong>{nickname}</strong>님!</p>

                {/* 날씨 카드 */}
                <div style={styles.weatherCard}>
                    {weather ? (
                        <div style={styles.weatherInner}>
                            <div>
                                <p style={styles.weatherTemp}>{weather.temp}°C</p>
                                <p style={styles.weatherCity}>📍 {weather.city}</p>
                                <p style={styles.weatherDesc}>{weather.desc}</p>
                            </div>
                            <div style={styles.weatherEmojiBox}>
                                <span style={styles.weatherEmoji}>{getWeatherEmoji(weather.desc)}</span>
                            </div>
                        </div>
                    ) : (
                        <p style={{ color: theme.colors.textSub, fontSize: '14px' }}>날씨를 불러오는 중...</p>
                    )}
                </div>

                {/* 오늘의 코디 */}
                <p style={styles.sectionLabel}>오늘의 코디</p>
                <div style={styles.outfitCard}>
                    <div style={styles.outfitCardHeader}>
                        <span style={styles.outfitCardBadge}>Today's Look !</span>
                    </div>

                    {recommendation ? (
                        <div style={styles.outfitContent}>
                            <div style={styles.outfitItems}>
                                {recommendation.outfit?.top && (
                                    <div style={styles.outfitChip}>
                                        <span style={styles.outfitChipLabel}>상의</span>
                                        <span style={styles.outfitChipValue}>{recommendation.outfit.top.type}</span>
                                        <span style={styles.outfitChipColor}>{recommendation.outfit.top.color}</span>
                                    </div>
                                )}
                                {recommendation.outfit?.bottom && (
                                    <div style={styles.outfitChip}>
                                        <span style={styles.outfitChipLabel}>하의</span>
                                        <span style={styles.outfitChipValue}>{recommendation.outfit.bottom.type}</span>
                                        <span style={styles.outfitChipColor}>{recommendation.outfit.bottom.color}</span>
                                    </div>
                                )}
                                {recommendation.outfit?.outer && (
                                    <div style={styles.outfitChip}>
                                        <span style={styles.outfitChipLabel}>아우터</span>
                                        <span style={styles.outfitChipValue}>{recommendation.outfit.outer.type}</span>
                                        <span style={styles.outfitChipColor}>{recommendation.outfit.outer.color}</span>
                                    </div>
                                )}
                            </div>
                            {recommendation.outfit?.description && (
                                <p style={styles.outfitDesc}>{recommendation.outfit.description}</p>
                            )}
                            {recommendation.matched_items?.length > 0 && (
                                <div style={styles.matchedRow}>
                                    {recommendation.matched_items.map((item, i) => (
                                        <div key={i} style={styles.matchedItem}>
                                            {(item.imageUrl || item.imageB64) && (
                                                <img src={item.imageUrl || item.imageB64}
                                                     alt={item.type} style={styles.matchedImg} />
                                            )}
                                            <p style={styles.matchedType}>{item.type}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <button style={styles.retryBtn} onClick={() => setRecommendation(null)}>
                                다시 추천받기
                            </button>
                        </div>

                    ) : loading ? (
                        <div style={styles.outfitEmpty}>
                            <p style={styles.outfitEmptyTitle}>AI가 코디를 분석 중이에요...</p>
                        </div>

                    ) : showEventRecommendPrompt && selectedEvent ? (
                        <div style={styles.outfitEmpty}>
                            <p style={{ fontSize: '28px', marginBottom: '8px' }}>{getTpoEmoji(selectedEvent.tpoKeyword)}</p>
                            <p style={styles.outfitEmptyTitle}>오늘 <strong>{selectedEvent.eventName}</strong> 일정!</p>
                            <p style={{ fontSize: '13px', color: theme.colors.textSub, marginBottom: '16px' }}>
                                이 일정에 맞는 코디를 추천해드릴까요?
                            </p>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                <button style={styles.primaryBtn}
                                        onClick={() => fetchRecommendation(selectedEvent.tpoKeyword, selectedEvent.eventId)}>
                                    {selectedEvent.tpoKeyword} 코디
                                </button>
                                <button style={styles.secondaryBtn} onClick={() => fetchRecommendation('일상')}>
                                    일상 코디
                                </button>
                            </div>
                        </div>

                    ) : todayEvents.length > 0 ? (
                        <div style={styles.outfitContent}>
                            {todayEvents.map(ev => (
                                <div key={ev.eventId} style={styles.eventItem}>
                                    <span style={{ fontSize: '20px' }}>{getTpoEmoji(ev.tpoKeyword)}</span>
                                    <div style={{ flex: 1 }}>
                                        <p style={styles.eventName}>{ev.eventName}</p>
                                        <p style={styles.eventTime}>{formatTime(ev.eventDatetime)}</p>
                                    </div>
                                    <button style={{
                                        ...styles.eventRecommendBtn,
                                        backgroundColor: getTpoColor(ev.tpoKeyword)
                                    }} onClick={() => { setSelectedEvent(ev); setShowEventRecommendPrompt(true); }}>
                                        코디 추천
                                    </button>
                                </div>
                            ))}
                            <button style={styles.secondaryBtn} onClick={() => fetchRecommendation('일상')}>
                                일상 코디로 추천받기
                            </button>
                        </div>

                    ) : (
                        <div style={styles.outfitEmpty}>
                            <p style={styles.outfitEmptyTitle}>코디 추천을 받아보세요.</p>
                            <p style={styles.outfitEmptySub}>추천 탭에서 TPO를 선택하고 AI 코디를 받아보세요.</p>
                            <button style={styles.primaryBtn} onClick={() => fetchRecommendation('일상')}>
                                오늘의 코디 추천받기
                            </button>
                        </div>
                    )}
                </div>

                {/* 주간 코디 체크 */}
                <p style={styles.sectionLabel}>주간 코디 체크</p>
                <div style={styles.weekScroll}>
                    {weekDays.map((date, i) => {
                        const dayEvts = getEventsOnDay(date);
                        const dayOutfits = getOutfitsOnDay(date);
                        const isToday = i === 0;
                        const dow = date.getDay();
                        const firstOutfit = dayOutfits[0];
                        const firstEvent = dayEvts[0];

                        return (
                            <div key={i} style={{
                                ...styles.weekCard,
                                border: isToday
                                    ? `2px solid ${theme.colors.primary}`
                                    : `1px solid ${theme.colors.border}`
                            }} onClick={() => setPopup({ date, events: dayEvts, outfits: dayOutfits })}>
                                <p style={{
                                    ...styles.weekCardDate,
                                    color: dow === 0 ? '#FF5A5A' : dow === 6 ? theme.colors.blue : theme.colors.text
                                }}>
                                    {date.getMonth()+1}/{date.getDate()}
                                </p>

                                {/* 날씨 미니 */}
                                <div style={styles.weekCardWeather}>
                                    {weather && (
                                        <>
                                            <span style={{ fontSize: '20px' }}>{getWeatherEmoji(weather.desc)}</span>
                                            <span style={styles.weekCardTemp}>{weather.temp}°C</span>
                                        </>
                                    )}
                                </div>

                                {/* 일정 */}
                                {firstEvent && (
                                    <p style={styles.weekCardEvent}>일정: {firstEvent.tpoKeyword}</p>
                                )}

                                {/* 코디 이미지 */}
                                {firstOutfit?.matchedItems?.[0]?.imageUrl ? (
                                    <img src={firstOutfit.matchedItems[0].imageUrl} alt="코디"
                                         style={styles.weekCardImg} />
                                ) : dayOutfits.length > 0 ? (
                                    <div style={styles.weekCardOutfitBadge}>👗</div>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 날짜 팝업 */}
            {popup && (
                <>
                    <div style={styles.overlay} onClick={() => setPopup(null)} />
                    <div style={styles.popupBox}>
                        <div style={styles.popupHeader}>
                            <p style={styles.popupDate}>
                                {popup.date.getMonth()+1}월 {popup.date.getDate()}일
                                <span style={styles.popupWeekday}>({WEEKDAYS[popup.date.getDay()]})</span>
                            </p>
                            <button style={styles.closeBtn} onClick={() => setPopup(null)}>✕</button>
                        </div>
                        <div style={styles.popupContent}>
                            {popup.events.length === 0 && popup.outfits.length === 0 && (
                                <p style={styles.noEventText}>일정 및 저장된 코디가 없습니다.</p>
                            )}
                            {popup.events.map(ev => (
                                <div key={ev.eventId} style={styles.popupEventCard}>
                                    <div style={{ width: '4px', alignSelf: 'stretch', backgroundColor: getTpoColor(ev.tpoKeyword), borderRadius: '2px' }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span>{getTpoEmoji(ev.tpoKeyword)}</span>
                                            <p style={styles.popupEventName}>{ev.eventName}</p>
                                        </div>
                                        <p style={styles.popupEventTime}>{formatTime(ev.eventDatetime)}</p>
                                    </div>
                                </div>
                            ))}
                            {popup.outfits.map((outfit, i) => (
                                <div key={i} style={styles.popupOutfitCard}>
                                    <p style={styles.popupOutfitTitle}>👗 저장된 코디</p>
                                    {outfit.description && <p style={styles.popupOutfitDesc}>{outfit.description}</p>}
                                    {outfit.matchedItems?.length > 0 && (
                                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                            {outfit.matchedItems.map((item, mi) => item.imageUrl && (
                                                <img key={mi} src={item.imageUrl} alt=""
                                                     style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px' }} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                            <button style={styles.goCalendarBtn}
                                    onClick={() => { setPopup(null); navigate('/calendar'); }}>
                                캘린더에서 자세히 보기 →
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

const styles = {
    page: { backgroundColor: theme.colors.background, minHeight: '100vh' },
    container: { maxWidth: '480px', margin: '0 auto', padding: '16px 20px 90px' },
    greeting: { fontSize: '22px', color: theme.colors.text, margin: '0 0 16px' },

    // 날씨
    weatherCard: {
        backgroundColor: theme.colors.primaryLight, borderRadius: theme.radius.xl,
        padding: '24px', marginBottom: '24px'
    },
    weatherInner: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    weatherTemp: { fontSize: '48px', fontWeight: '700', color: theme.colors.text, margin: 0, lineHeight: 1 },
    weatherCity: { fontSize: '13px', color: theme.colors.textSub, margin: '8px 0 4px' },
    weatherDesc: { fontSize: '14px', color: theme.colors.textSub, margin: 0 },
    weatherEmojiBox: { fontSize: '72px', lineHeight: 1 },
    weatherEmoji: {},

    // 섹션 레이블
    sectionLabel: {
        fontSize: '17px', fontWeight: '600', color: theme.colors.text, margin: '0 0 12px'
    },

    // 오늘의 코디 카드
    outfitCard: {
        backgroundColor: theme.colors.white, borderRadius: theme.radius.xl,
        overflow: 'hidden', marginBottom: '24px',
        boxShadow: theme.colors.cardShadow
    },
    outfitCardHeader: {
        backgroundColor: theme.colors.primary, padding: '12px 20px'
    },
    outfitCardBadge: {
        fontSize: '15px', fontWeight: '600', color: theme.colors.white
    },
    outfitContent: { padding: '16px 20px' },
    outfitEmpty: { padding: '24px 20px', textAlign: 'center' },
    outfitEmptyTitle: {
        fontSize: '16px', fontWeight: '600', color: theme.colors.text, margin: '0 0 6px'
    },
    outfitEmptySub: {
        fontSize: '13px', color: theme.colors.textSub, margin: '0 0 16px', lineHeight: '1.5'
    },
    outfitItems: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' },
    outfitChip: {
        backgroundColor: theme.colors.primaryLight, borderRadius: theme.radius.md,
        padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '2px'
    },
    outfitChipLabel: { fontSize: '10px', color: theme.colors.primary, fontWeight: '600' },
    outfitChipValue: { fontSize: '13px', fontWeight: '600', color: theme.colors.text },
    outfitChipColor: { fontSize: '11px', color: theme.colors.textSub },
    outfitDesc: {
        fontSize: '13px', color: theme.colors.textSub, lineHeight: '1.6',
        margin: '0 0 12px', backgroundColor: '#F9FBF9', padding: '10px 12px',
        borderRadius: theme.radius.md
    },
    matchedRow: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' },
    matchedItem: { textAlign: 'center' },
    matchedImg: { width: '72px', height: '72px', objectFit: 'cover', borderRadius: theme.radius.md },
    matchedType: { fontSize: '11px', color: theme.colors.textSub, marginTop: '4px' },
    retryBtn: {
        padding: '8px 16px', backgroundColor: theme.colors.primaryLight,
        color: theme.colors.primary, border: 'none', borderRadius: theme.radius.full,
        fontSize: '13px', cursor: 'pointer', fontWeight: '500'
    },
    primaryBtn: {
        padding: '12px 20px', backgroundColor: theme.colors.primary, color: 'white',
        border: 'none', borderRadius: theme.radius.full, fontSize: '14px',
        cursor: 'pointer', fontWeight: '600'
    },
    secondaryBtn: {
        padding: '10px 18px', backgroundColor: theme.colors.primaryLight,
        color: theme.colors.primary, border: 'none', borderRadius: theme.radius.full,
        fontSize: '13px', cursor: 'pointer', fontWeight: '500'
    },
    eventItem: {
        display: 'flex', alignItems: 'center', gap: '10px',
        marginBottom: '10px', padding: '10px',
        backgroundColor: theme.colors.background, borderRadius: theme.radius.md
    },
    eventName: { fontSize: '14px', fontWeight: '600', color: theme.colors.text, margin: '0 0 2px' },
    eventTime: { fontSize: '12px', color: theme.colors.textSub, margin: 0 },
    eventRecommendBtn: {
        padding: '6px 12px', color: 'white', border: 'none',
        borderRadius: theme.radius.full, fontSize: '12px', cursor: 'pointer', fontWeight: '500'
    },

    // 주간 캘린더
    weekScroll: {
        display: 'flex', gap: '10px', overflowX: 'auto',
        paddingBottom: '8px',
        scrollbarWidth: 'none',
    },
    weekCard: {
        minWidth: '110px', backgroundColor: theme.colors.white,
        borderRadius: theme.radius.lg, padding: '12px',
        cursor: 'pointer', flexShrink: 0
    },
    weekCardDate: { fontSize: '13px', fontWeight: '600', margin: '0 0 8px' },
    weekCardWeather: { display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' },
    weekCardTemp: { fontSize: '13px', fontWeight: '600', color: theme.colors.text },
    weekCardEvent: {
        fontSize: '11px', color: theme.colors.textSub, margin: '0 0 8px',
        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis'
    },
    weekCardImg: {
        width: '100%', height: '80px', objectFit: 'cover',
        borderRadius: theme.radius.md, marginTop: '4px'
    },
    weekCardOutfitBadge: { fontSize: '24px', textAlign: 'center', marginTop: '4px' },

    // 팝업
    overlay: {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 200
    },
    popupBox: {
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: theme.colors.white, borderRadius: theme.radius.xl,
        width: '360px', maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto',
        zIndex: 201, boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
    },
    popupHeader: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '20px 20px 0', marginBottom: '16px'
    },
    popupDate: { fontSize: '20px', fontWeight: '700', color: theme.colors.text, margin: 0 },
    popupWeekday: { fontSize: '15px', fontWeight: '400', color: theme.colors.textSub, marginLeft: '6px' },
    closeBtn: { background: 'none', border: 'none', fontSize: '18px', color: '#999', cursor: 'pointer' },
    popupContent: { padding: '0 20px 20px' },
    noEventText: { color: theme.colors.textLight, fontSize: '14px', textAlign: 'center', padding: '16px 0' },
    popupEventCard: {
        display: 'flex', gap: '12px', alignItems: 'flex-start',
        backgroundColor: theme.colors.background, borderRadius: theme.radius.md,
        padding: '12px', marginBottom: '10px'
    },
    popupEventName: { fontSize: '15px', fontWeight: '600', color: theme.colors.text, margin: 0 },
    popupEventTime: { fontSize: '12px', color: theme.colors.textSub, margin: '4px 0 0' },
    popupOutfitCard: {
        backgroundColor: theme.colors.primaryLight, borderRadius: theme.radius.md,
        padding: '14px', marginBottom: '10px'
    },
    popupOutfitTitle: { fontSize: '13px', fontWeight: '700', color: theme.colors.primary, margin: '0 0 6px' },
    popupOutfitDesc: { fontSize: '13px', color: theme.colors.text, lineHeight: '1.5', margin: 0 },
    goCalendarBtn: {
        width: '100%', padding: '12px', backgroundColor: theme.colors.background,
        color: theme.colors.textSub, border: 'none', borderRadius: theme.radius.md,
        fontSize: '13px', cursor: 'pointer', marginTop: '8px'
    }
};

export default Home;