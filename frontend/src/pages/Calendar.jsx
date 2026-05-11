import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import { calendarAPI } from '../api/api';

const TPO_OPTIONS = ['데이트', '직장', '캐주얼', '운동', '파티', '여행', '일상', '격식'];
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS = [1,2,3,4,5,6,7,8,9,10,11,12];

function Calendar() {
    const today = new Date();
    const [events, setEvents] = useState([]);
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [currentMonth, setCurrentMonth] = useState(today.getMonth());
    const [showMonthPicker, setShowMonthPicker] = useState(false);
    const [popup, setPopup] = useState(null); // { year, month, day }
    const [showAddForm, setShowAddForm] = useState(false);
    const [form, setForm] = useState({ eventName: '', eventDatetime: '', tpoKeyword: '일상' });

    useEffect(() => { fetchEvents(); }, []);

    const fetchEvents = async () => {
        try {
            const res = await calendarAPI.getEvents();
            setEvents(res.data);
        } catch (err) { console.error(err); }
    };

    const handleDayClick = (day) => {
        const pad = (n) => String(n).padStart(2, '0');
        const dateStr = `${currentYear}-${pad(currentMonth + 1)}-${pad(day)}T09:00`;
        setForm({ eventName: '', eventDatetime: dateStr, tpoKeyword: '일상' });
        setShowAddForm(false);
        setPopup({ year: currentYear, month: currentMonth, day });
    };

    const closePopup = () => {
        setPopup(null);
        setShowAddForm(false);
    };

    const handleAddEvent = async () => {
        if (!form.eventName || !form.eventDatetime) {
            alert('일정 이름과 날짜를 입력해주세요.');
            return;
        }
        try {
            await calendarAPI.addEvent(form);
            setShowAddForm(false);
            setForm(f => ({ ...f, eventName: '' }));
            await fetchEvents();
        } catch (err) { alert('일정 추가 실패'); }
    };

    const handleDelete = async (eventId) => {
        if (!window.confirm('삭제하시겠습니까?')) return;
        try {
            await calendarAPI.deleteEvent(eventId);
            setEvents(events.filter(e => e.eventId !== eventId));
        } catch (err) { alert('삭제 실패'); }
    };

    const getEventsOnDate = (year, month, day) =>
        events.filter(e => {
            const d = new Date(e.eventDatetime);
            return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
        });

    const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
    const getFirstDay = (y, m) => new Date(y, m, 1).getDay();

    const prevMonth = () => {
        if (currentMonth === 0) { setCurrentYear(y => y - 1); setCurrentMonth(11); }
        else setCurrentMonth(m => m - 1);
        setPopup(null);
    };

    const nextMonth = () => {
        if (currentMonth === 11) { setCurrentYear(y => y + 1); setCurrentMonth(0); }
        else setCurrentMonth(m => m + 1);
        setPopup(null);
    };

    const formatTime = (datetime) => {
        const d = new Date(datetime);
        return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    };

    const getDday = (datetime) => {
        const target = new Date(datetime);
        target.setHours(0,0,0,0);
        const now = new Date();
        now.setHours(0,0,0,0);
        const diff = Math.round((target - now) / (1000 * 60 * 60 * 24));
        if (diff === 0) return 'D-Day';
        if (diff > 0) return `D-${diff}`;
        return `D+${Math.abs(diff)}`;
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

    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDay(currentYear, currentMonth);
    const popupEvents = popup ? getEventsOnDate(popup.year, popup.month, popup.day) : [];

    return (
        <div style={styles.page}>
            <Navbar />
            <div style={styles.container}>

                {/* 헤더 */}
                <div style={styles.header}>
                    <div style={styles.headerLeft}>
                        <button style={styles.monthTitleBtn} onClick={() => setShowMonthPicker(!showMonthPicker)}>
                            <span style={styles.yearText}>{currentYear}년</span>
                            <span style={styles.monthText}>{currentMonth + 1}월</span>
                            <span style={styles.dropIcon}>{showMonthPicker ? '▲' : '▼'}</span>
                        </button>
                    </div>
                    <div style={styles.headerRight}>
                        <button style={styles.todayBtn} onClick={() => {
                            setCurrentYear(today.getFullYear());
                            setCurrentMonth(today.getMonth());
                            setPopup(null);
                            setShowMonthPicker(false);
                        }}>오늘</button>
                        <button style={styles.navBtn} onClick={prevMonth}>‹</button>
                        <button style={styles.navBtn} onClick={nextMonth}>›</button>
                    </div>
                </div>

                {/* 년/월 선택 피커 */}
                {showMonthPicker && (
                    <div style={styles.pickerBox}>
                        <div style={styles.yearPicker}>
                            <button style={styles.pickerNavBtn} onClick={() => setCurrentYear(y => y - 1)}>◀</button>
                            <span style={styles.pickerYear}>{currentYear}년</span>
                            <button style={styles.pickerNavBtn} onClick={() => setCurrentYear(y => y + 1)}>▶</button>
                        </div>
                        <div style={styles.monthGrid}>
                            {MONTHS.map(m => (
                                <button key={m}
                                        style={{
                                            ...styles.monthPickerBtn,
                                            backgroundColor: currentMonth === m - 1 ? '#333' : '#f5f5f5',
                                            color: currentMonth === m - 1 ? 'white' : '#333'
                                        }}
                                        onClick={() => {
                                            setCurrentMonth(m - 1);
                                            setShowMonthPicker(false);
                                            setPopup(null);
                                        }}
                                >
                                    {m}월
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* 캘린더 */}
                <div style={styles.calendarBox}>
                    <div style={styles.weekdayRow}>
                        {WEEKDAYS.map((d, i) => (
                            <div key={d} style={{
                                ...styles.weekday,
                                color: i === 0 ? '#FF3B30' : i === 6 ? '#007AFF' : '#666'
                            }}>{d}</div>
                        ))}
                    </div>
                    <div style={styles.daysGrid}>
                        {Array.from({ length: firstDay }).map((_, i) => (
                            <div key={`e-${i}`} style={styles.emptyCell} />
                        ))}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1;
                            const dayEvents = getEventsOnDate(currentYear, currentMonth, day);
                            const isToday = today.getFullYear() === currentYear &&
                                today.getMonth() === currentMonth &&
                                today.getDate() === day;
                            const isSelected = popup &&
                                popup.year === currentYear &&
                                popup.month === currentMonth &&
                                popup.day === day;
                            const dow = (firstDay + i) % 7;

                            return (
                                <div key={day}
                                     style={{
                                         ...styles.cell,
                                         backgroundColor: isSelected ? '#EEF2FF' : 'transparent',
                                         cursor: 'pointer'
                                     }}
                                     onClick={() => handleDayClick(day)}
                                >
                                    <div style={{
                                        ...styles.dayCircle,
                                        backgroundColor: isToday ? '#FF3B30' : 'transparent',
                                        color: isToday ? 'white'
                                            : dow === 0 ? '#FF3B30'
                                                : dow === 6 ? '#007AFF'
                                                    : '#333'
                                    }}>
                                        {day}
                                    </div>
                                    {dayEvents.slice(0, 3).map((ev, ei) => (
                                        <div key={ei} style={{
                                            ...styles.eventChip,
                                            backgroundColor: getTpoColor(ev.tpoKeyword) + '22',
                                            borderLeft: `3px solid ${getTpoColor(ev.tpoKeyword)}`
                                        }}>
                                            <span style={{ color: getTpoColor(ev.tpoKeyword), fontSize: '11px' }}>
                                                {ev.eventName}
                                            </span>
                                        </div>
                                    ))}
                                    {dayEvents.length > 3 && (
                                        <p style={styles.moreText}>+{dayEvents.length - 3}개 더</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* 날짜 클릭 팝업 */}
            {popup && (
                <>
                    {/* 배경 오버레이 */}
                    <div style={styles.overlay} onClick={closePopup} />

                    {/* 팝업 */}
                    <div style={styles.popupBox}>
                        {/* 팝업 헤더 */}
                        <div style={styles.popupHeader}>
                            <div>
                                <p style={styles.popupDate}>
                                    {popup.month + 1}월 {popup.day}일
                                    <span style={styles.popupWeekday}>
                                        ({WEEKDAYS[new Date(popup.year, popup.month, popup.day).getDay()]})
                                    </span>
                                </p>
                                <p style={styles.popupYear}>{popup.year}년</p>
                            </div>
                            <button style={styles.closeBtn} onClick={closePopup}>✕</button>
                        </div>

                        {/* 일정 목록 */}
                        <div style={styles.popupContent}>
                            {popupEvents.length === 0 && !showAddForm && (
                                <p style={styles.noEventText}>등록된 일정이 없습니다.</p>
                            )}
                            {popupEvents.map(ev => (
                                <div key={ev.eventId} style={styles.popupEventCard}>
                                    <div style={{
                                        width: '4px', alignSelf: 'stretch',
                                        backgroundColor: getTpoColor(ev.tpoKeyword),
                                        borderRadius: '2px', flexShrink: 0
                                    }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '18px' }}>{getTpoEmoji(ev.tpoKeyword)}</span>
                                            <p style={styles.popupEventName}>{ev.eventName}</p>
                                            <span style={{
                                                ...styles.ddayBadge,
                                                backgroundColor: getTpoColor(ev.tpoKeyword)
                                            }}>
                                                {getDday(ev.eventDatetime)}
                                            </span>
                                        </div>
                                        <p style={styles.popupEventTime}>{formatTime(ev.eventDatetime)}</p>
                                        <span style={{
                                            ...styles.tpoTag,
                                            backgroundColor: getTpoColor(ev.tpoKeyword) + '22',
                                            color: getTpoColor(ev.tpoKeyword)
                                        }}>
                                            {ev.tpoKeyword}
                                        </span>
                                    </div>
                                    <button style={styles.deleteBtn} onClick={() => handleDelete(ev.eventId)}>
                                        삭제
                                    </button>
                                </div>
                            ))}

                            {/* 일정 추가 폼 */}
                            {showAddForm ? (
                                <div style={styles.addFormInPopup}>
                                    <input
                                        style={styles.popupInput}
                                        type="text"
                                        placeholder="일정 이름"
                                        value={form.eventName}
                                        onChange={e => setForm({ ...form, eventName: e.target.value })}
                                        autoFocus
                                    />
                                    <input
                                        style={styles.popupInput}
                                        type="datetime-local"
                                        value={form.eventDatetime}
                                        onChange={e => setForm({ ...form, eventDatetime: e.target.value })}
                                    />
                                    <select
                                        style={styles.popupInput}
                                        value={form.tpoKeyword}
                                        onChange={e => setForm({ ...form, tpoKeyword: e.target.value })}
                                    >
                                        {TPO_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button style={styles.saveBtn} onClick={handleAddEvent}>저장</button>
                                        <button style={styles.cancelBtn} onClick={() => setShowAddForm(false)}>취소</button>
                                    </div>
                                </div>
                            ) : (
                                <button style={styles.addEventBtn} onClick={() => setShowAddForm(true)}>
                                    + 이 날 일정 추가
                                </button>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

const styles = {
    page: { backgroundColor: '#f5f5f5', minHeight: '100vh' },
    container: { maxWidth: '1000px', margin: '0 auto', padding: '24px 16px' },
    header: {
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: '16px'
    },
    headerLeft: { display: 'flex', alignItems: 'center' },
    headerRight: { display: 'flex', alignItems: 'center', gap: '8px' },
    monthTitleBtn: {
        background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'baseline', gap: '6px', padding: '4px 8px'
    },
    yearText: { fontSize: '16px', color: '#888' },
    monthText: { fontSize: '32px', fontWeight: 'bold', color: '#333' },
    dropIcon: { fontSize: '12px', color: '#888' },
    todayBtn: {
        padding: '6px 14px', backgroundColor: 'white', color: '#333',
        border: '1px solid #ddd', borderRadius: '8px', fontSize: '13px', cursor: 'pointer'
    },
    navBtn: {
        padding: '6px 12px', backgroundColor: 'white', color: '#333',
        border: '1px solid #ddd', borderRadius: '8px', fontSize: '18px', cursor: 'pointer'
    },
    pickerBox: {
        backgroundColor: 'white', borderRadius: '16px', padding: '20px',
        marginBottom: '16px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)'
    },
    yearPicker: {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '20px', marginBottom: '16px'
    },
    pickerNavBtn: {
        background: 'none', border: 'none', fontSize: '16px',
        cursor: 'pointer', color: '#333', padding: '4px 8px'
    },
    pickerYear: { fontSize: '20px', fontWeight: 'bold', color: '#333' },
    monthGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' },
    monthPickerBtn: {
        padding: '10px', border: 'none', borderRadius: '8px',
        fontSize: '14px', cursor: 'pointer', fontWeight: '500'
    },
    calendarBox: {
        backgroundColor: 'white', borderRadius: '16px', padding: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
    },
    weekdayRow: {
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        borderBottom: '1px solid #f0f0f0', paddingBottom: '8px', marginBottom: '4px'
    },
    weekday: { textAlign: 'center', fontSize: '13px', fontWeight: '600', padding: '4px 0' },
    daysGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' },
    emptyCell: { minHeight: '100px', borderBottom: '1px solid #f8f8f8' },
    cell: {
        minHeight: '100px', padding: '6px 4px',
        borderBottom: '1px solid #f8f8f8', borderRadius: '8px',
        transition: 'background 0.15s'
    },
    dayCircle: {
        width: '28px', height: '28px', borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '14px', fontWeight: '500', marginBottom: '4px'
    },
    eventChip: {
        borderRadius: '4px', padding: '2px 6px', marginBottom: '2px',
        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis'
    },
    moreText: { fontSize: '10px', color: '#888', margin: '2px 0 0 4px' },

    // 오버레이
    overlay: {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 200
    },

    // 팝업
    popupBox: {
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'white', borderRadius: '20px',
        width: '400px', maxWidth: '90vw',
        maxHeight: '80vh', overflowY: 'auto',
        zIndex: 201, boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
    },
    popupHeader: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        padding: '20px 20px 0', position: 'sticky', top: 0,
        backgroundColor: 'white', borderBottom: '1px solid #f0f0f0', paddingBottom: '16px'
    },
    popupDate: { fontSize: '22px', fontWeight: 'bold', color: '#333', margin: 0 },
    popupWeekday: { fontSize: '16px', fontWeight: '400', color: '#888', marginLeft: '6px' },
    popupYear: { fontSize: '13px', color: '#aaa', margin: '4px 0 0' },
    closeBtn: {
        background: 'none', border: 'none', fontSize: '18px',
        color: '#999', cursor: 'pointer', padding: '4px'
    },
    popupContent: { padding: '16px 20px 20px' },
    noEventText: { color: '#aaa', fontSize: '14px', textAlign: 'center', padding: '16px 0' },
    popupEventCard: {
        display: 'flex', gap: '12px', alignItems: 'flex-start',
        backgroundColor: '#f9f9f9', borderRadius: '12px',
        padding: '12px', marginBottom: '10px'
    },
    popupEventName: { fontSize: '15px', fontWeight: 'bold', color: '#333', margin: 0 },
    popupEventTime: { fontSize: '12px', color: '#888', margin: '4px 0 6px' },
    ddayBadge: {
        padding: '2px 8px', borderRadius: '10px', color: 'white',
        fontSize: '11px', fontWeight: 'bold', marginLeft: 'auto', flexShrink: 0
    },
    tpoTag: { padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '500' },
    deleteBtn: {
        padding: '4px 10px', backgroundColor: 'white', color: '#FF3B30',
        border: '1px solid #FF3B30', borderRadius: '6px',
        fontSize: '12px', cursor: 'pointer', flexShrink: 0
    },
    addFormInPopup: { marginTop: '12px' },
    popupInput: {
        width: '100%', padding: '10px 12px', marginBottom: '8px',
        borderRadius: '8px', border: '1px solid #e0e0e0',
        fontSize: '14px', boxSizing: 'border-box', outline: 'none'
    },
    saveBtn: {
        flex: 1, padding: '10px', backgroundColor: '#333', color: 'white',
        border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer'
    },
    cancelBtn: {
        flex: 1, padding: '10px', backgroundColor: '#f0f0f0', color: '#333',
        border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer'
    },
    addEventBtn: {
        width: '100%', padding: '12px', backgroundColor: '#f5f5f5', color: '#333',
        border: '2px dashed #ddd', borderRadius: '10px',
        fontSize: '14px', cursor: 'pointer', marginTop: '8px'
    }
};

export default Calendar;