import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import { calendarAPI, recommendationAPI } from '../api/api';
import { theme } from '../styles/theme';

const TPO_OPTIONS = ['데이트', '직장', '캐주얼', '운동', '파티', '여행', '일상', '격식'];
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS = [1,2,3,4,5,6,7,8,9,10,11,12];

function Calendar() {
    const today = new Date();
    const [events, setEvents] = useState([]);
    const [outfits, setOutfits] = useState([]);
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [currentMonth, setCurrentMonth] = useState(today.getMonth());
    const [showMonthPicker, setShowMonthPicker] = useState(false);
    const [popup, setPopup] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ eventName: '', eventDatetime: '', tpoKeyword: '일상' });

    useEffect(() => { fetchEvents(); fetchOutfits(); }, []);

    const fetchEvents = async () => {
        try {
            const res = await calendarAPI.getEvents();
            setEvents(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchOutfits = async () => {
        try {
            const now = new Date();
            const pad = (n) => String(n).padStart(2,'0');
            const start = `${now.getFullYear()}-01-01`;
            const end = `${now.getFullYear()}-12-31`;
            const res = await recommendationAPI.getWeekOutfits(start, end);
            setOutfits(res.data || []);
        } catch (err) { console.error(err); }
    };

    const handleAddEvent = async () => {
        if (!form.eventName || !form.eventDatetime) {
            alert('일정 이름과 날짜를 입력해주세요.'); return;
        }
        try {
            await calendarAPI.addEvent(form);
            setForm({ eventName: '', eventDatetime: '', tpoKeyword: '일상' });
            setShowForm(false);
            await fetchEvents();
        } catch (err) { alert('일정 추가 실패'); }
    };

    const handleDelete = async (eventId) => {
        if (!window.confirm('삭제하시겠습니까?')) return;
        try {
            await calendarAPI.deleteEvent(eventId);
            setEvents(events.filter(e => e.eventId !== eventId));
            setPopup(null);
        } catch (err) { alert('삭제 실패'); }
    };

    const getEventsOnDate = (year, month, day) =>
        events.filter(e => {
            const d = new Date(e.eventDatetime);
            return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
        });

    const getOutfitsOnDate = (year, month, day) => {
        const pad = (n) => String(n).padStart(2,'0');
        const dateStr = `${year}-${pad(month+1)}-${pad(day)}`;
        return outfits.filter(o => o.outfitDate === dateStr);
    };

    const getDaysInMonth = (y, m) => new Date(y, m+1, 0).getDate();
    const getFirstDay = (y, m) => new Date(y, m, 1).getDay();

    const prevMonth = () => {
        if (currentMonth === 0) { setCurrentYear(y => y-1); setCurrentMonth(11); }
        else setCurrentMonth(m => m-1);
        setPopup(null);
    };

    const nextMonth = () => {
        if (currentMonth === 11) { setCurrentYear(y => y+1); setCurrentMonth(0); }
        else setCurrentMonth(m => m+1);
        setPopup(null);
    };

    const formatTime = (datetime) => {
        const d = new Date(datetime);
        return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    };

    const getDday = (datetime) => {
        const target = new Date(datetime); target.setHours(0,0,0,0);
        const now = new Date(); now.setHours(0,0,0,0);
        const diff = Math.round((target - now) / (1000*60*60*24));
        if (diff === 0) return 'D-Day';
        if (diff > 0) return `D-${diff}`;
        return `D+${Math.abs(diff)}`;
    };

    const getTpoColor = (tpo) => {
        const map = {
            '데이트':'#FF6B9D','직장':'#4A90D9','캐주얼':'#7EC8A4',
            '운동':'#F5A623','파티':'#BD10E0','여행':'#50E3C2','일상':'#9B9B9B','격식':'#4A4A4A'
        };
        return map[tpo] || theme.colors.primary;
    };

    const getTpoEmoji = (tpo) => {
        const map = { '데이트':'💑','직장':'💼','캐주얼':'👟','운동':'🏃','파티':'🎉','여행':'✈️','일상':'☀️','격식':'👔' };
        return map[tpo] || '📅';
    };

    const handleDayClick = (day) => {
        const pad = (n) => String(n).padStart(2,'0');
        const dateStr = `${currentYear}-${pad(currentMonth+1)}-${pad(day)}T09:00`;
        setForm(f => ({ ...f, eventDatetime: dateStr }));
        setShowForm(false);
        setPopup({
            year: currentYear, month: currentMonth, day,
            events: getEventsOnDate(currentYear, currentMonth, day),
            outfits: getOutfitsOnDate(currentYear, currentMonth, day)
        });
    };

    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDay(currentYear, currentMonth);

    return (
        <div style={styles.page}>
            <Navbar />
            <div style={styles.container}>

                {/* 헤더 */}
                <div style={styles.header}>
                    <button style={styles.monthTitleBtn}
                            onClick={() => setShowMonthPicker(!showMonthPicker)}>
                        <span style={styles.yearText}>{currentYear}년</span>
                        <span style={styles.monthText}>{currentMonth+1}월</span>
                        <span style={styles.dropIcon}>{showMonthPicker ? '▲' : '▼'}</span>
                    </button>
                    <div style={styles.headerRight}>
                        <button style={styles.todayBtn} onClick={() => {
                            setCurrentYear(today.getFullYear());
                            setCurrentMonth(today.getMonth());
                            setPopup(null); setShowMonthPicker(false);
                        }}>오늘</button>
                        <button style={styles.navBtn} onClick={prevMonth}>‹</button>
                        <button style={styles.navBtn} onClick={nextMonth}>›</button>
                        <button style={styles.addBtn} onClick={() => { setShowForm(!showForm); setPopup(null); }}>
                            + 일정
                        </button>
                    </div>
                </div>

                {/* 년/월 피커 */}
                {showMonthPicker && (
                    <div style={styles.pickerBox}>
                        <div style={styles.yearPicker}>
                            <button style={styles.pickerNavBtn} onClick={() => setCurrentYear(y => y-1)}>◀</button>
                            <span style={styles.pickerYear}>{currentYear}년</span>
                            <button style={styles.pickerNavBtn} onClick={() => setCurrentYear(y => y+1)}>▶</button>
                        </div>
                        <div style={styles.monthGrid}>
                            {MONTHS.map(m => (
                                <button key={m} style={{
                                    ...styles.monthPickerBtn,
                                    backgroundColor: currentMonth === m-1 ? theme.colors.primary : theme.colors.background,
                                    color: currentMonth === m-1 ? 'white' : theme.colors.text
                                }} onClick={() => { setCurrentMonth(m-1); setShowMonthPicker(false); setPopup(null); }}>
                                    {m}월
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* 일정 추가 폼 */}
                {showForm && (
                    <div style={styles.formBox}>
                        <p style={styles.formTitle}>새 일정 추가</p>
                        <input style={styles.input} type="text" placeholder="일정 이름"
                               value={form.eventName}
                               onChange={e => setForm({ ...form, eventName: e.target.value })} />
                        <input style={styles.input} type="datetime-local"
                               value={form.eventDatetime}
                               onChange={e => setForm({ ...form, eventDatetime: e.target.value })} />
                        <select style={styles.input} value={form.tpoKeyword}
                                onChange={e => setForm({ ...form, tpoKeyword: e.target.value })}>
                            {TPO_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button style={styles.submitBtn} onClick={handleAddEvent}>저장</button>
                            <button style={styles.cancelBtn} onClick={() => setShowForm(false)}>취소</button>
                        </div>
                    </div>
                )}

                {/* 캘린더 */}
                <div style={styles.calendarBox}>
                    <div style={styles.weekdayRow}>
                        {WEEKDAYS.map((d, i) => (
                            <div key={d} style={{
                                ...styles.weekday,
                                color: i===0 ? '#FF5A5A' : i===6 ? theme.colors.blue : theme.colors.textSub
                            }}>{d}</div>
                        ))}
                    </div>
                    <div style={styles.daysGrid}>
                        {Array.from({ length: firstDay }).map((_, i) => (
                            <div key={`e-${i}`} style={styles.emptyCell} />
                        ))}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i+1;
                            const dayEvents = getEventsOnDate(currentYear, currentMonth, day);
                            const dayOutfits = getOutfitsOnDate(currentYear, currentMonth, day);
                            const isToday = today.getFullYear()===currentYear &&
                                today.getMonth()===currentMonth && today.getDate()===day;
                            const isSelected = popup &&
                                popup.year===currentYear &&
                                popup.month===currentMonth &&
                                popup.day===day;
                            const dow = (firstDay+i) % 7;

                            return (
                                <div key={day} style={{
                                    ...styles.cell,
                                    backgroundColor: isSelected ? theme.colors.primaryLight : 'transparent',
                                    cursor: 'pointer'
                                }} onClick={() => handleDayClick(day)}>
                                    <div style={{
                                        ...styles.dayCircle,
                                        backgroundColor: isToday ? theme.colors.primary : 'transparent',
                                        color: isToday ? 'white'
                                            : dow===0 ? '#FF5A5A'
                                                : dow===6 ? theme.colors.blue
                                                    : theme.colors.text
                                    }}>
                                        {day}
                                    </div>
                                    {dayEvents.slice(0,2).map((ev, ei) => (
                                        <div key={ei} style={{
                                            ...styles.eventChip,
                                            backgroundColor: getTpoColor(ev.tpoKeyword) + '22',
                                            borderLeft: `2px solid ${getTpoColor(ev.tpoKeyword)}`
                                        }}>
                                            <span style={{ color: getTpoColor(ev.tpoKeyword), fontSize: '10px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                                {ev.eventName}
                                            </span>
                                        </div>
                                    ))}
                                    {dayOutfits.length > 0 && (
                                        <div style={styles.outfitDot}>👗</div>
                                    )}
                                    {dayEvents.length > 2 && (
                                        <p style={styles.moreText}>+{dayEvents.length-2}</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* 날짜 팝업 */}
            {popup && (
                <>
                    <div style={styles.overlay} onClick={() => setPopup(null)} />
                    <div style={styles.popupBox}>
                        <div style={styles.popupHeader}>
                            <div>
                                <p style={styles.popupDate}>
                                    {popup.month+1}월 {popup.day}일
                                    <span style={styles.popupWeekday}>
                                        ({WEEKDAYS[new Date(popup.year, popup.month, popup.day).getDay()]})
                                    </span>
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <button style={styles.addEventOnDayBtn}
                                        onClick={() => setShowForm(true)}>
                                    + 일정 추가
                                </button>
                                <button style={styles.closeBtn} onClick={() => setPopup(null)}>✕</button>
                            </div>
                        </div>
                        <div style={styles.popupContent}>
                            {popup.events.length === 0 && popup.outfits.length === 0 && !showForm && (
                                <p style={styles.noEvent}>등록된 일정이 없습니다.</p>
                            )}

                            {popup.events.map(ev => (
                                <div key={ev.eventId} style={styles.eventCard}>
                                    <div style={{ width: '4px', alignSelf: 'stretch', backgroundColor: getTpoColor(ev.tpoKeyword), borderRadius: '2px', flexShrink: 0 }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '18px' }}>{getTpoEmoji(ev.tpoKeyword)}</span>
                                            <p style={styles.eventName}>{ev.eventName}</p>
                                            <span style={{ ...styles.ddayBadge, backgroundColor: getTpoColor(ev.tpoKeyword) }}>
                                                {getDday(ev.eventDatetime)}
                                            </span>
                                        </div>
                                        <p style={styles.eventTime}>{formatTime(ev.eventDatetime)}</p>
                                        <span style={{ ...styles.tpoTag, backgroundColor: getTpoColor(ev.tpoKeyword)+'22', color: getTpoColor(ev.tpoKeyword) }}>
                                            {ev.tpoKeyword}
                                        </span>
                                    </div>
                                    <button style={styles.deleteBtn} onClick={() => handleDelete(ev.eventId)}>삭제</button>
                                </div>
                            ))}

                            {popup.outfits.map((outfit, i) => (
                                <div key={i} style={styles.outfitCard}>
                                    <p style={styles.outfitCardTitle}>👗 저장된 코디</p>
                                    {outfit.style && <span style={styles.outfitStyle}>{outfit.style}</span>}
                                    {outfit.description && <p style={styles.outfitDesc}>{outfit.description}</p>}
                                    {outfit.matchedItems?.length > 0 && (
                                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                            {outfit.matchedItems.map((item, mi) => item.imageUrl && (
                                                <img key={mi} src={item.imageUrl} alt=""
                                                     style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: theme.radius.md }} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}

                            {showForm && (
                                <div style={styles.inlineForm}>
                                    <input style={styles.input} type="text" placeholder="일정 이름"
                                           value={form.eventName} autoFocus
                                           onChange={e => setForm({ ...form, eventName: e.target.value })} />
                                    <input style={styles.input} type="datetime-local"
                                           value={form.eventDatetime}
                                           onChange={e => setForm({ ...form, eventDatetime: e.target.value })} />
                                    <select style={styles.input} value={form.tpoKeyword}
                                            onChange={e => setForm({ ...form, tpoKeyword: e.target.value })}>
                                        {TPO_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button style={styles.submitBtn} onClick={handleAddEvent}>저장</button>
                                        <button style={styles.cancelBtn} onClick={() => setShowForm(false)}>취소</button>
                                    </div>
                                </div>
                            )}
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
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' },
    headerRight: { display: 'flex', alignItems: 'center', gap: '6px' },
    monthTitleBtn: {
        background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'baseline', gap: '6px', padding: '4px 8px'
    },
    yearText: { fontSize: '14px', color: theme.colors.textSub },
    monthText: { fontSize: '28px', fontWeight: '700', color: theme.colors.text },
    dropIcon: { fontSize: '11px', color: theme.colors.textSub },
    todayBtn: {
        padding: '6px 12px', backgroundColor: theme.colors.white, color: theme.colors.text,
        border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.full,
        fontSize: '12px', cursor: 'pointer'
    },
    navBtn: {
        padding: '6px 10px', backgroundColor: theme.colors.white, color: theme.colors.text,
        border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.full,
        fontSize: '18px', cursor: 'pointer'
    },
    addBtn: {
        padding: '7px 14px', backgroundColor: theme.colors.primary, color: 'white',
        border: 'none', borderRadius: theme.radius.full, fontSize: '13px',
        cursor: 'pointer', fontWeight: '600'
    },
    pickerBox: {
        backgroundColor: theme.colors.white, borderRadius: theme.radius.xl, padding: '20px',
        marginBottom: '16px', boxShadow: theme.colors.cardShadow
    },
    yearPicker: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginBottom: '16px' },
    pickerNavBtn: { background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: theme.colors.text },
    pickerYear: { fontSize: '18px', fontWeight: '700', color: theme.colors.text },
    monthGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' },
    monthPickerBtn: {
        padding: '10px', border: 'none', borderRadius: theme.radius.md,
        fontSize: '13px', cursor: 'pointer', fontWeight: '500'
    },
    formBox: {
        backgroundColor: theme.colors.white, borderRadius: theme.radius.xl, padding: '20px',
        marginBottom: '16px', boxShadow: theme.colors.cardShadow
    },
    formTitle: { fontSize: '15px', fontWeight: '700', color: theme.colors.text, marginBottom: '12px' },
    input: {
        width: '100%', padding: '11px 14px', marginBottom: '10px',
        borderRadius: theme.radius.md, border: `1px solid ${theme.colors.border}`,
        fontSize: '14px', boxSizing: 'border-box', backgroundColor: theme.colors.white
    },
    submitBtn: {
        flex: 1, padding: '11px', backgroundColor: theme.colors.primary, color: 'white',
        border: 'none', borderRadius: theme.radius.full, fontSize: '14px',
        cursor: 'pointer', fontWeight: '600'
    },
    cancelBtn: {
        flex: 1, padding: '11px', backgroundColor: theme.colors.background, color: theme.colors.textSub,
        border: 'none', borderRadius: theme.radius.full, fontSize: '14px', cursor: 'pointer'
    },
    calendarBox: {
        backgroundColor: theme.colors.white, borderRadius: theme.radius.xl,
        padding: '16px', boxShadow: theme.colors.cardShadow
    },
    weekdayRow: {
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        borderBottom: `1px solid ${theme.colors.border}`, paddingBottom: '8px', marginBottom: '4px'
    },
    weekday: { textAlign: 'center', fontSize: '12px', fontWeight: '600', padding: '4px 0' },
    daysGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' },
    emptyCell: { minHeight: '72px', borderBottom: `1px solid ${theme.colors.background}` },
    cell: {
        minHeight: '72px', padding: '4px 3px',
        borderBottom: `1px solid ${theme.colors.background}`,
        borderRadius: theme.radius.md, transition: 'background 0.15s'
    },
    dayCircle: {
        width: '26px', height: '26px', borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '13px', fontWeight: '500', marginBottom: '3px'
    },
    eventChip: {
        borderRadius: '3px', padding: '1px 5px', marginBottom: '2px',
        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis'
    },
    outfitDot: { fontSize: '10px', textAlign: 'center' },
    moreText: { fontSize: '10px', color: theme.colors.textSub, margin: '1px 0 0 3px' },
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 200 },
    popupBox: {
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        backgroundColor: theme.colors.white, borderRadius: theme.radius.xl,
        width: '380px', maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto',
        zIndex: 201, boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
    },
    popupHeader: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '20px 20px 0', borderBottom: `1px solid ${theme.colors.border}`,
        paddingBottom: '16px', position: 'sticky', top: 0, backgroundColor: theme.colors.white
    },
    popupDate: { fontSize: '20px', fontWeight: '700', color: theme.colors.text, margin: 0 },
    popupWeekday: { fontSize: '15px', fontWeight: '400', color: theme.colors.textSub, marginLeft: '6px' },
    addEventOnDayBtn: {
        padding: '6px 12px', backgroundColor: theme.colors.primaryLight, color: theme.colors.primary,
        border: 'none', borderRadius: theme.radius.full, fontSize: '12px', cursor: 'pointer', fontWeight: '500'
    },
    closeBtn: { background: 'none', border: 'none', fontSize: '18px', color: '#999', cursor: 'pointer' },
    popupContent: { padding: '16px 20px 20px' },
    noEvent: { color: theme.colors.textLight, fontSize: '14px', textAlign: 'center', padding: '20px 0' },
    eventCard: {
        display: 'flex', gap: '10px', alignItems: 'flex-start',
        backgroundColor: theme.colors.background, borderRadius: theme.radius.md,
        padding: '12px', marginBottom: '10px'
    },
    eventName: { fontSize: '14px', fontWeight: '600', color: theme.colors.text, margin: 0, flex: 1 },
    eventTime: { fontSize: '12px', color: theme.colors.textSub, margin: '4px 0 6px' },
    ddayBadge: {
        padding: '2px 8px', borderRadius: theme.radius.full, color: 'white',
        fontSize: '11px', fontWeight: '700', flexShrink: 0
    },
    tpoTag: { padding: '2px 10px', borderRadius: theme.radius.full, fontSize: '12px', fontWeight: '500' },
    deleteBtn: {
        padding: '4px 10px', backgroundColor: 'white', color: theme.colors.danger,
        border: `1px solid ${theme.colors.danger}`, borderRadius: theme.radius.full,
        fontSize: '12px', cursor: 'pointer'
    },
    outfitCard: {
        backgroundColor: theme.colors.primaryLight, borderRadius: theme.radius.md,
        padding: '14px', marginBottom: '10px'
    },
    outfitCardTitle: { fontSize: '13px', fontWeight: '700', color: theme.colors.primary, margin: '0 0 6px' },
    outfitStyle: {
        display: 'inline-block', backgroundColor: 'white', borderRadius: theme.radius.full,
        padding: '2px 10px', fontSize: '12px', color: theme.colors.primary, marginBottom: '6px'
    },
    outfitDesc: { fontSize: '13px', color: theme.colors.text, lineHeight: '1.5', margin: 0 },
    inlineForm: { marginTop: '12px' },
};

export default Calendar;