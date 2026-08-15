import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { wardrobeAPI, weatherAPI, calendarAPI, recommendationAPI } from '../api/api';
import { theme } from '../styles/theme';

const STYLE_LABELS = {
    casual: '캐주얼', formal: '포멀', business: '비즈니스',
    lovely: '러블리', feminine: '페미닌', sporty: '스포티', comfort: '컴포트'
};

const TPO_LIST = [
    { key: '데이트', emoji: '💑', color: '#FF6B9D' },
    { key: '직장',   emoji: '💼', color: '#4A90D9' },
    { key: '캐주얼', emoji: '👟', color: '#7EC8A4' },
    { key: '운동',   emoji: '🏃', color: '#F5A623' },
    { key: '파티',   emoji: '🎉', color: '#9B59B6' },
    { key: '여행',   emoji: '✈️', color: '#1ABC9C' },
    { key: '일상',   emoji: '☀️', color: '#95A5A6' },
    { key: '격식',   emoji: '👔', color: '#34495E' },
];
const WEEKDAYS  = ['일','월','화','수','목','금','토'];
const CAT_COLOR = { '상의':'#4CAF8A', '하의':'#4A90D9', '아우터':'#E8832A', '원피스':'#E91E8C' };

function Recommend() {
    const today = new Date();

    const [selectedDate, setSelectedDate]   = useState(today);
    const [weather, setWeather]             = useState(null);
    const [weatherUnavailable, setWeatherUnavailable] = useState(false);
    const [allEvents, setAllEvents]         = useState([]);
    const [selectedDateEvents, setSelectedDateEvents] = useState([]);
    const [selectedEventIds, setSelectedEventIds]     = useState([]);
    const [showCalendarPopup, setShowCalendarPopup]   = useState(false);
    const [calYear, setCalYear]   = useState(today.getFullYear());
    const [calMonth, setCalMonth] = useState(today.getMonth());

    const [selectedTpo, setSelectedTpo] = useState(null);
    const [numOutfits, setNumOutfits]   = useState(2);

    const [outfitPool, setOutfitPool]           = useState([]);
    const [acceptedPoolIdx, setAcceptedPoolIdx] = useState(null);
    const [accepting, setAccepting]             = useState(false);
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState('');

    const pad        = n => String(n).padStart(2,'0');
    const toDateStr  = d => { const dt=new Date(d); return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`; };
    const formatDate = d => { const dt=new Date(d); return `${dt.getMonth()+1}월 ${dt.getDate()}일 (${WEEKDAYS[dt.getDay()]})`; };
    const isToday    = d => { const dt=new Date(d); return dt.getFullYear()===today.getFullYear()&&dt.getMonth()===today.getMonth()&&dt.getDate()===today.getDate(); };
    const getTpoColor   = t => TPO_LIST.find(x=>x.key===t)?.color||theme.colors.primary;
    const getWeatherEmoji = desc => {
        if (!desc) return '🌤️';
        if (desc.includes('맑')) return '☀️';
        if (desc.includes('구름')) return '⛅';
        if (desc.includes('비'))  return '🌧️';
        if (desc.includes('눈'))  return '❄️';
        return '🌤️';
    };

    useEffect(() => { fetchWeather(today); fetchAllEvents(); }, []);
    useEffect(() => { updateDateEvents(selectedDate); }, [selectedDate, allEvents]);

    const fetchWeather = async date => {
        try {
            const diff = Math.ceil((date - today) / 86400000);
            if (diff <= 0)     { const r=await weatherAPI.getWeather();              setWeather(r.data); setWeatherUnavailable(false); }
            else if (diff <= 5){ const r=await weatherAPI.getForecast(toDateStr(date)); setWeather(r.data); setWeatherUnavailable(false); }
            else               { setWeather(null); setWeatherUnavailable(true); }
        } catch {}
    };
    const fetchAllEvents = async () => { try { const r=await calendarAPI.getEvents(); setAllEvents(r.data); } catch {} };
    const updateDateEvents = date => {
        const evts = allEvents.filter(e => {
            const d=new Date(e.eventDatetime);
            return d.getFullYear()===date.getFullYear()&&d.getMonth()===date.getMonth()&&d.getDate()===date.getDate();
        });
        setSelectedDateEvents(evts);
        setSelectedEventIds(evts.map(e=>e.eventId));
        if (evts.length>0) setSelectedTpo(evts[0].tpoKeyword);
    };
    const toggleEvent = id => setSelectedEventIds(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);

    const handleDaySelect = day => {
        const d = new Date(calYear, calMonth, day);
        setSelectedDate(d); setShowCalendarPopup(false);
        setOutfitPool([]); setAcceptedPoolIdx(null);
        setWeatherUnavailable(false); fetchWeather(d);
    };

    const handleRecommend = async () => {
        if (!selectedTpo) { setError('TPO를 선택해주세요.'); return; }
        setLoading(true); setError('');

        const lastRecId = outfitPool.length > 0
            ? outfitPool[outfitPool.length-1].recId : null;

        const usedItemIds = outfitPool.flatMap(entry =>
            (entry.matchedItems||[]).map(item=>item.id).filter(id=>id&&id!=='null')
        );

        try {
            const res = await wardrobeAPI.recommend({
                tpo: selectedTpo, mode: 'rag',
                linkedEventIds: selectedEventIds,
                outfitDate: toDateStr(selectedDate),
                numOutfits, parentRecId: lastRecId,
                excludeItemIds: usedItemIds,
            });
            const newOutfits      = res.data.outfits||[];
            const newMatchedItems = res.data.matched_items_per_outfit||[];
            const newRecId        = res.data.recId;
            setOutfitPool(prev => [...prev, ...newOutfits.map((outfit,idx) => ({
                outfit, matchedItems: newMatchedItems[idx]||[], recId: newRecId, outfitIndex: idx
            }))]);
        } catch { setError('추천에 실패했습니다. 다시 시도해주세요.'); }
        finally  { setLoading(false); }
    };

    const handleAccept = async poolIdx => {
        if (accepting) return;
        setAccepting(true);
        try {
            const entry = outfitPool[poolIdx];
            await recommendationAPI.acceptOutfit(entry.recId, {
                outfitIndex: entry.outfitIndex,
                style:       entry.outfit?.style||'',
                description: entry.outfit?.description||'',
            });
            setAcceptedPoolIdx(poolIdx);
        } catch { alert('선택에 실패했습니다.'); }
        finally  { setAccepting(false); }
    };

    const getDays  = (y,m) => new Date(y,m+1,0).getDate();
    const getFirst = (y,m) => new Date(y,m,1).getDay();
    const getEventsOn = (y,m,d) => allEvents.filter(e=>{ const dt=new Date(e.eventDatetime); return dt.getFullYear()===y&&dt.getMonth()===m&&dt.getDate()===d; });
    const daysInMonth = getDays(calYear, calMonth);
    const firstDay    = getFirst(calYear, calMonth);
    const isRetry     = outfitPool.length > 0;

    return (
        <div style={S.page}>
            <Navbar />
            <div style={S.container}>

                {/* ── 날짜 + 날씨 카드 ── */}
                <div style={S.topCard}>
                    <div style={S.dateWeatherRow}>
                        <button style={S.dateBtn} onClick={()=>setShowCalendarPopup(true)}>
                            <span style={S.dateTxt}>{formatDate(selectedDate)}</span>
                            <span style={S.dateIcon}>📅</span>
                        </button>
                        {!isToday(selectedDate) && (
                            <button style={S.todayBtn} onClick={()=>{
                                setSelectedDate(today); setCalYear(today.getFullYear()); setCalMonth(today.getMonth());
                            }}>오늘</button>
                        )}
                    </div>

                    {weatherUnavailable ? (
                        <p style={S.weatherNA}>5일 이후 날씨 정보 없음</p>
                    ) : weather ? (
                        <div style={S.weatherRow}>
                            <span style={S.weatherEmoji}>{getWeatherEmoji(weather.desc)}</span>
                            <div>
                                <span style={S.weatherTemp}>{weather.temp}°C</span>
                                <span style={S.weatherDesc}>{weather.desc}</span>
                            </div>
                            <span style={S.weatherFeels}>체감 {weather.feelsLike}°C</span>
                        </div>
                    ) : null}

                    {selectedDateEvents.length > 0 && (
                        <div style={S.evtWrap}>
                            {selectedDateEvents.map(ev => (
                                <div key={ev.eventId} style={{
                                    ...S.evtChip,
                                    background: selectedEventIds.includes(ev.eventId)
                                        ? getTpoColor(ev.tpoKeyword) : '#F0F2F5',
                                    color: selectedEventIds.includes(ev.eventId) ? '#fff' : '#555',
                                }} onClick={()=>toggleEvent(ev.eventId)}>
                                    {ev.eventName}
                                    <span style={{opacity:.75, fontSize:'10px'}}> · {ev.tpoKeyword}</span>
                                    {selectedEventIds.includes(ev.eventId) && ' ✓'}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── TPO ── */}
                <p style={S.secLabel}>어떤 자리인가요?</p>
                <div style={S.tpoGrid}>
                    {TPO_LIST.map(t => {
                        const active = selectedTpo === t.key;
                        return (
                            <button key={t.key} onClick={()=>setSelectedTpo(t.key)} style={{
                                ...S.tpoBtn,
                                background: active ? t.color : '#fff',
                                boxShadow: active ? `0 4px 16px ${t.color}44` : '0 1px 4px rgba(0,0,0,0.07)',
                                border: active ? 'none' : `1px solid #EEE`,
                            }}>
                                <span style={S.tpoEmoji}>{t.emoji}</span>
                                <span style={{ ...S.tpoName, color: active ? '#fff' : '#333' }}>{t.key}</span>
                            </button>
                        );
                    })}
                </div>

                {/* ── 코디 수 선택 (첫 추천 전) ── */}
                {!isRetry && (
                    <div style={S.countWrap}>
                        <p style={S.secLabel}>추천 코디 수</p>
                        <div style={S.countRow}>
                            {[2,3].map(n => (
                                <button key={n} style={{
                                    ...S.countBtn,
                                    background: numOutfits===n ? theme.colors.primary : '#fff',
                                    color:      numOutfits===n ? '#fff' : '#444',
                                    border:     numOutfits===n ? 'none' : '1px solid #DDD',
                                    boxShadow:  numOutfits===n ? `0 3px 10px ${theme.colors.primary}44` : 'none',
                                }} onClick={()=>setNumOutfits(n)}>
                                    {n}가지
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {error && <p style={S.errorTxt}>{error}</p>}

                {/* ── 추천 버튼 ── */}
                <button style={{ ...S.recBtn, opacity: loading ? .7 : 1 }}
                        onClick={handleRecommend} disabled={loading}>
                    {loading ? (
                        <span>⏳ &nbsp;AI가 코디를 분석 중...</span>
                    ) : isRetry ? (
                        <span>✨ &nbsp;다른 코디 {numOutfits}가지 더 받기</span>
                    ) : (
                        <span>🤖 &nbsp;{formatDate(selectedDate)} 코디 추천받기</span>
                    )}
                </button>

                {/* ── 풀 요약 배너 ── */}
                {outfitPool.length > 0 && (
                    <div style={S.poolBanner}>
                        <span style={S.poolBannerL}>총 {outfitPool.length}가지 코디</span>
                        {acceptedPoolIdx !== null && (
                            <span style={S.poolBannerR}>✅ 코디 {acceptedPoolIdx+1} 선택됨</span>
                        )}
                    </div>
                )}

                {/* ── 코디 카드들 ── */}
                {outfitPool.map((entry, poolIdx) => {
                    const isAccepted     = acceptedPoolIdx === poolIdx;
                    const isOtherAccepted = acceptedPoolIdx !== null && !isAccepted;
                    const outfit = entry.outfit;
                    const slots = [
                        outfit?.top    && { label:'상의',  ...outfit.top },
                        outfit?.bottom && { label:'하의',  ...outfit.bottom },
                        outfit?.outer  && { label:'아우터',...outfit.outer },
                    ].filter(Boolean);

                    return (
                        <div key={poolIdx} style={{
                            ...S.outfitCard,
                            opacity: isOtherAccepted ? .55 : 1,
                            borderColor: isAccepted ? theme.colors.primary : '#E8ECF0',
                            background: isAccepted ? '#F2FBF7' : '#fff',
                        }}>
                            {/* 카드 헤더 */}
                            <div style={S.cardHead}>
                                <div style={S.cardHeadLeft}>
                                    <span style={{
                                        ...S.cardNum,
                                        background: isAccepted ? theme.colors.primary : '#C8D4DC',
                                    }}>{poolIdx+1}</span>
                                    {outfit?.style && (
                                        <span style={{
                                            ...S.cardStyle,
                                            color: isAccepted ? theme.colors.primary : '#555',
                                        }}>{STYLE_LABELS[outfit.style] || outfit.style}</span>
                                    )}
                                </div>
                                {isAccepted && (
                                    <span style={S.acceptedBadge}>✅ 선택됨</span>
                                )}
                            </div>

                            {/* 코디 구성 */}
                            {slots.length > 0 && (
                                <div style={S.slotList}>
                                    {slots.map((s,i) => (
                                        <div key={i} style={S.slotRow}>
                                            <span style={{
                                                ...S.slotDot,
                                                background: CAT_COLOR[s.label]||theme.colors.primary
                                            }} />
                                            <span style={S.slotLabel}>{s.label}</span>
                                            <span style={S.slotName}>{s.type}</span>
                                            <span style={S.slotColor}>{s.color}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* 코디 설명 */}
                            {outfit?.description && (
                                <p style={S.cardDesc}>"{outfit.description}"</p>
                            )}

                            {/* 매칭 아이템 */}
                            {entry.matchedItems.length > 0 && (
                                <div style={S.matchedWrap}>
                                    <p style={S.matchedHdr}>내 옷장 아이템</p>
                                    <div style={S.matchedRow}>
                                        {entry.matchedItems.map((item,i) => (
                                            <div key={i} style={S.matchedItem}>
                                                {(item.imageUrl||item.imageB64) ? (
                                                    <img src={item.imageUrl||item.imageB64}
                                                         alt={item.type} style={S.matchedImg}/>
                                                ) : (
                                                    <div style={S.matchedImgEmpty}>👗</div>
                                                )}
                                                <span style={{
                                                    ...S.matchedCat,
                                                    background: CAT_COLOR[item.category]||theme.colors.primary
                                                }}>{item.category}</span>
                                                <p style={S.matchedType}>{item.type}</p>
                                                {item.matched === false && (
                                                    <p style={S.matchedNote}>보유 아이템 아님</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 선택 버튼 */}
                            {!isAccepted ? (
                                <button style={S.acceptBtn}
                                        onClick={()=>handleAccept(poolIdx)}
                                        disabled={accepting}>
                                    {accepting ? '선택 중...' : '이 코디 선택'}
                                </button>
                            ) : (
                                <div style={S.acceptedRow}>
                                    <span style={S.acceptedMsg}>선택한 코디입니다</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── 캘린더 팝업 ── */}
            {showCalendarPopup && (
                <>
                    <div style={S.overlay} onClick={()=>setShowCalendarPopup(false)}/>
                    <div style={S.calPopup}>
                        <div style={S.calHead}>
                            <button style={S.calNav} onClick={()=>{ if(calMonth===0){setCalYear(y=>y-1);setCalMonth(11);}else setCalMonth(m=>m-1); }}>‹</button>
                            <span style={S.calTitle}>{calYear}년 {calMonth+1}월</span>
                            <button style={S.calNav} onClick={()=>{ if(calMonth===11){setCalYear(y=>y+1);setCalMonth(0);}else setCalMonth(m=>m+1); }}>›</button>
                            <button style={S.calClose} onClick={()=>setShowCalendarPopup(false)}>✕</button>
                        </div>
                        <div style={S.calWeeks}>
                            {['일','월','화','수','목','금','토'].map((d,i)=>(
                                <div key={d} style={{...S.calWd, color:i===0?'#F05':i===6?'#4A90D9':'#888'}}>{d}</div>
                            ))}
                        </div>
                        <div style={S.calGrid}>
                            {Array.from({length:firstDay}).map((_,i)=><div key={`e${i}`}/>)}
                            {Array.from({length:daysInMonth}).map((_,i)=>{
                                const day=i+1, dow=(firstDay+i)%7;
                                const evts=getEventsOn(calYear,calMonth,day);
                                const isTod=today.getFullYear()===calYear&&today.getMonth()===calMonth&&today.getDate()===day;
                                const isSel=selectedDate.getFullYear()===calYear&&selectedDate.getMonth()===calMonth&&selectedDate.getDate()===day;
                                return (
                                    <div key={day} style={{...S.calDay,
                                        background: isSel?theme.colors.primary:isTod?theme.colors.primaryLight:'transparent',
                                        cursor:'pointer'
                                    }} onClick={()=>handleDaySelect(day)}>
                                        <span style={{fontSize:'13px',fontWeight:'500',
                                            color:isSel?'#fff':dow===0?'#F05':dow===6?'#4A90D9':'#333'}}>{day}</span>
                                        {evts.length>0&&(
                                            <div style={{display:'flex',gap:'2px',justifyContent:'center'}}>
                                                {evts.slice(0,3).map((ev,ei)=>(
                                                    <div key={ei} style={{width:'4px',height:'4px',borderRadius:'50%',
                                                        background:isSel?'#fff':getTpoColor(ev.tpoKeyword)}}/>
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

const S = {
    page:      { background: theme.colors.background, minHeight: '100vh' },
    container: { maxWidth: '480px', margin: '0 auto', padding: '20px 16px 90px' },

    // 날짜·날씨 카드
    topCard: {
        background: '#fff', borderRadius: '18px', padding: '16px 18px',
        marginBottom: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    },
    dateWeatherRow: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' },
    dateBtn: {
        display: 'flex', alignItems: 'center', gap: '8px', background: 'none',
        border: `1.5px solid ${theme.colors.border}`, borderRadius: '30px',
        padding: '8px 16px', cursor: 'pointer', flex: 1,
    },
    dateTxt:  { fontSize: '16px', fontWeight: '700', color: theme.colors.text },
    dateIcon: { fontSize: '16px', marginLeft: 'auto' },
    todayBtn: {
        padding: '7px 14px', background: theme.colors.primaryLight,
        color: theme.colors.primary, border: 'none', borderRadius: '20px',
        fontSize: '12px', cursor: 'pointer', fontWeight: '600', flexShrink: 0,
    },
    weatherRow: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' },
    weatherEmoji: { fontSize: '28px' },
    weatherTemp:  { fontSize: '20px', fontWeight: '800', color: theme.colors.text, marginRight: '6px' },
    weatherDesc:  { fontSize: '13px', color: theme.colors.textSub },
    weatherFeels: { fontSize: '12px', color: theme.colors.textLight, marginLeft: 'auto' },
    weatherNA:    { fontSize: '12px', color: theme.colors.textLight, margin: '4px 0 0' },
    evtWrap: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${theme.colors.border}` },
    evtChip: { padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', cursor: 'pointer' },

    // TPO
    secLabel: { fontSize: '14px', fontWeight: '700', color: theme.colors.text, margin: '0 0 10px' },
    tpoGrid:  { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px', marginBottom: '20px' },
    tpoBtn: {
        borderRadius: '14px', padding: '12px 6px', textAlign: 'center',
        cursor: 'pointer', border: 'none', transition: 'all .18s',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
    },
    tpoEmoji: { fontSize: '22px' },
    tpoName:  { fontSize: '12px', fontWeight: '600' },

    // 코디 수
    countWrap: { marginBottom: '16px' },
    countRow:  { display: 'flex', gap: '10px' },
    countBtn: {
        flex: 1, padding: '11px', borderRadius: '12px',
        fontSize: '14px', fontWeight: '700', cursor: 'pointer', transition: 'all .18s',
    },

    errorTxt: { color: theme.colors.danger, fontSize: '13px', marginBottom: '10px' },

    // 추천 버튼
    recBtn: {
        width: '100%', padding: '15px', background: theme.colors.primary, color: '#fff',
        border: 'none', borderRadius: '30px', fontSize: '15px',
        cursor: 'pointer', fontWeight: '800', marginBottom: '16px',
        boxShadow: `0 4px 16px ${theme.colors.primary}44`,
    },

    // 풀 배너
    poolBanner: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: theme.colors.primaryLight, borderRadius: '12px',
        padding: '10px 16px', marginBottom: '14px',
    },
    poolBannerL: { fontSize: '13px', fontWeight: '700', color: theme.colors.primary },
    poolBannerR: { fontSize: '13px', fontWeight: '700', color: theme.colors.primary },

    // 코디 카드
    outfitCard: {
        background: '#fff', borderRadius: '18px', padding: '18px 16px',
        marginBottom: '14px', border: '2px solid transparent',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)', transition: 'all .2s',
    },
    cardHead: {
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: '14px',
    },
    cardHeadLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
    cardNum: {
        width: '28px', height: '28px', borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '13px', fontWeight: '900', color: '#fff', flexShrink: 0,
    },
    cardStyle: { fontSize: '16px', fontWeight: '800' },
    acceptedBadge: {
        fontSize: '12px', fontWeight: '700', color: theme.colors.primary,
        background: '#fff', border: `1.5px solid ${theme.colors.primary}`,
        padding: '3px 10px', borderRadius: '20px',
    },

    // 코디 슬롯
    slotList: {
        background: '#F8FAFB', borderRadius: '12px', padding: '12px 14px',
        display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px',
    },
    slotRow:   { display: 'flex', alignItems: 'center', gap: '8px' },
    slotDot:   { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 },
    slotLabel: { fontSize: '11px', fontWeight: '700', color: '#888', width: '38px', flexShrink: 0 },
    slotName:  { fontSize: '13px', fontWeight: '600', color: theme.colors.text, flex: 1 },
    slotColor: { fontSize: '11px', color: theme.colors.textSub, flexShrink: 0 },

    // 설명
    cardDesc: {
        fontSize: '13px', color: theme.colors.textSub, lineHeight: '1.6',
        fontStyle: 'italic', margin: '0 0 14px', paddingLeft: '12px',
        borderLeft: `3px solid ${theme.colors.primaryLight}`,
    },

    // 매칭 아이템
    matchedWrap: {
        borderTop: `1px solid ${theme.colors.border}`,
        paddingTop: '12px', marginBottom: '14px',
    },
    matchedHdr: { fontSize: '11px', fontWeight: '700', color: theme.colors.textSub, margin: '0 0 10px' },
    matchedRow: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
    matchedItem:{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: '68px' },
    matchedImg: { width: '68px', height: '68px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #EEE' },
    matchedImgEmpty: {
        width: '68px', height: '68px', borderRadius: '10px',
        background: theme.colors.primaryLight,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px',
        border: '1.5px dashed #C8D4DC',  // 추가: 실물 없음을 시각적으로 구분
    },
    matchedNote: {
        fontSize: '8.5px', color: '#AAB4BC', margin: '1px 0 0',
        textAlign: 'center', fontStyle: 'italic',
    },
    matchedCat: {
        fontSize: '9px', fontWeight: '700', color: '#fff',
        padding: '2px 6px', borderRadius: '4px',
    },
    matchedType: {
        fontSize: '10px', color: theme.colors.text, fontWeight: '500',
        margin: 0, textAlign: 'center', maxWidth: '68px',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    },

    // 선택 버튼
    acceptBtn: {
        width: '100%', padding: '13px', background: theme.colors.primary, color: '#fff',
        border: 'none', borderRadius: '30px', fontSize: '14px',
        cursor: 'pointer', fontWeight: '700',
        boxShadow: `0 3px 10px ${theme.colors.primary}33`,
    },
    acceptedRow: {
        padding: '12px', background: theme.colors.primaryLight,
        borderRadius: '12px', textAlign: 'center',
    },
    acceptedMsg: { fontSize: '13px', fontWeight: '700', color: theme.colors.primary },

    // 캘린더
    overlay:  { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 },
    calPopup: {
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        background: '#fff', borderRadius: '20px', width: '340px', maxWidth: '90vw',
        zIndex: 201, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', padding: '20px',
    },
    calHead:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' },
    calNav:   { background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', padding: '4px 8px', color: '#333' },
    calTitle: { fontSize: '16px', fontWeight: '700' },
    calClose: { background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#999' },
    calWeeks: { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: '8px' },
    calWd:    { textAlign: 'center', fontSize: '12px', fontWeight: '600', padding: '4px 0' },
    calGrid:  { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px' },
    calDay: {
        minHeight: '40px', borderRadius: '8px', padding: '4px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
    },
};

export default Recommend;