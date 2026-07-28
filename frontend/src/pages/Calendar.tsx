import React, { useEffect, useState } from 'react';
import { calendarAPI, recommendationAPI } from '../api/api';
import { WardrobeIcon } from '../components/Icons';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
dayjs.locale('ko');

const TPO_OPTIONS = ['데이트', '직장', '캐주얼', '운동', '파티', '여행', '일상', '격식'];
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const DAY_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const TPO_COLORS: Record<string, string> = {
    '데이트': '#FF6B9D', '직장': '#5B8FF9', '캐주얼': '#5AD8A6',
    '운동': '#F6AE2D', '파티': '#9B59B6', '여행': '#1ABC9C', '일상': '#8C9BAB', '격식': '#4A5568',
};

const START_HOUR = 8;
const END_HOUR = 22;
const HOUR_H = 64;

interface CalendarEvent {
    eventId: number;
    eventName: string;
    eventDatetime: string;
    tpoKeyword: string;
}

interface Outfit {
    outfitDate: string;
    style?: string;
    description?: string;
    matchedItems?: { imageUrl?: string }[];
}

interface EventForm {
    eventName: string;
    eventDatetime: string;
    tpoKeyword: string;
}

function getWeekMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function Calendar() {
    const today = new Date();
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [outfits, setOutfits] = useState<Outfit[]>([]);
    const [calYear, setCalYear] = useState(today.getFullYear());
    const [calMonth, setCalMonth] = useState(today.getMonth());
    const [weekBase, setWeekBase] = useState<Date>(today);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<EventForm>({ eventName: '', eventDatetime: '', tpoKeyword: '일상' });
    const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);

    const weekStart = getWeekMonday(weekBase);
    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { fetchEvents(); fetchOutfits(); }, []);

    const fetchEvents = async () => {
        try { const res = await calendarAPI.getEvents(); setEvents(res.data); } catch (err) { console.error(err); }
    };

    const fetchOutfits = async () => {
        try {
            const now = new Date();
            const res = await recommendationAPI.getWeekOutfits(`${now.getFullYear()}-01-01`, `${now.getFullYear()}-12-31`);
            setOutfits(res.data || []);
        } catch (err) { console.error(err); }
    };

    const handleAddEvent = async () => {
        if (!form.eventName || !form.eventDatetime) { alert('일정 이름과 날짜를 입력해주세요.'); return; }
        try {
            await calendarAPI.addEvent(form);
            setForm({ eventName: '', eventDatetime: '', tpoKeyword: '일상' });
            setShowForm(false);
            await fetchEvents();
        } catch (err) { alert('일정 추가 실패'); }
    };

    const handleDelete = async (eventId: number) => {
        if (!window.confirm('삭제하시겠습니까?')) return;
        try {
            await calendarAPI.deleteEvent(eventId);
            setEvents(events.filter(e => e.eventId !== eventId));
            setActiveEvent(null);
        } catch (err) { alert('삭제 실패'); }
    };

    const daysInMonth = dayjs().year(calYear).month(calMonth).daysInMonth();
    const firstDay = dayjs().year(calYear).month(calMonth).date(1).day();

    const prevMonth = () => {
        if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
        else setCalMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
        else setCalMonth(m => m + 1);
    };
    const prevWeek = () => { const d = new Date(weekBase); d.setDate(d.getDate() - 7); setWeekBase(d); };
    const nextWeek = () => { const d = new Date(weekBase); d.setDate(d.getDate() + 7); setWeekBase(d); };

    const getEventsOnDay = (date: Date): CalendarEvent[] =>
        events.filter(e => {
            const d = new Date(e.eventDatetime);
            return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth() && d.getDate() === date.getDate();
        });

    const getOutfitsOnDay = (date: Date): Outfit[] => {
        const dateStr = dayjs(date).format('YYYY-MM-DD');
        return outfits.filter(o => o.outfitDate === dateStr);
    };

    const getEventTop = (datetime: string): number => {
        const d = new Date(datetime);
        const h = d.getHours(); const m = d.getMinutes();
        if (h < START_HOUR) return 0;
        if (h >= END_HOUR) return (END_HOUR - START_HOUR) * HOUR_H - 80;
        return (h - START_HOUR) * HOUR_H + (m / 60) * HOUR_H;
    };

    const weekLabel = (() => {
        const s = weekDays[0]; const e = weekDays[6];
        if (s.getMonth() === e.getMonth())
            return `${s.getFullYear()}년 ${s.getMonth() + 1}월 ${s.getDate()} - ${e.getDate()}일`;
        return `${s.getFullYear()}년 ${s.getMonth() + 1}월 ${s.getDate()}일 - ${e.getMonth() + 1}월 ${e.getDate()}일`;
    })();

    const tpoStats = Object.entries(TPO_COLORS)
        .map(([tpo, color]) => ({ tpo, color, count: events.filter(e => e.tpoKeyword === tpo).length }))
        .filter(s => s.count > 0);

    const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

    const btnBase: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

    return (
        <div style={{ padding: '70px 28px', width: '100%' }}>
            {/* Header */}
            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontFamily: 'Hahmlet, sans-serif', fontWeight: 700, fontSize: 28, color: '#1a1a2e', margin: 0 }}>캘린더</h1>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#888', margin: '5px 0 0' }}>일정과 코디를 한눈에 확인하세요</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '228px 1fr', gap: 18, alignItems: 'start' }}>

                {/* ── Left sidebar ── */}
                <div>
                    {/* Mini calendar */}
                    <div style={{ background: 'white', borderRadius: 18, padding: 16, border: '1px solid #eaedf2', marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <span style={{ fontFamily: 'Hahmlet, sans-serif', fontWeight: 700, fontSize: 13, color: '#1a1a2e' }}>
                                {calYear}년 {calMonth + 1}월
                            </span>
                            <div style={{ display: 'flex', gap: 2 }}>
                                {[{ fn: prevMonth, ch: '‹' }, { fn: nextMonth, ch: '›' }].map(({ fn, ch }) => (
                                    <button key={ch} onClick={fn} style={{ ...btnBase, width: 24, height: 24, borderRadius: 6, color: '#71b3e5', fontSize: 15 }}>{ch}</button>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
                            {WEEKDAYS.map((d, i) => (
                                <div key={d} style={{ textAlign: 'center', fontSize: 9, fontWeight: 600, fontFamily: 'Inter, sans-serif', padding: '2px 0', color: i === 0 ? '#e74c3c' : i === 6 ? '#3498db' : '#bbb' }}>{d}</div>
                            ))}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
                            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                            {Array.from({ length: daysInMonth }).map((_, i) => {
                                const day = i + 1;
                                const dow = (firstDay + i) % 7;
                                const isToday = today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === day;
                                const inWeek = weekDays.some(wd => wd.getFullYear() === calYear && wd.getMonth() === calMonth && wd.getDate() === day);
                                const evtsOnDay = events.filter(e => {
                                    const d = new Date(e.eventDatetime);
                                    return d.getFullYear() === calYear && d.getMonth() === calMonth && d.getDate() === day;
                                });
                                return (
                                    <div key={day} onClick={() => setWeekBase(new Date(calYear, calMonth, day))} style={{
                                        textAlign: 'center', padding: '3px 1px', cursor: 'pointer', borderRadius: 6,
                                        background: isToday ? 'linear-gradient(135deg, #71b3e5, #5a9fd4)' : inWeek ? 'rgba(113,179,229,0.1)' : 'transparent',
                                    }}>
                                        <span style={{ fontSize: 11, fontFamily: 'Hahmlet, sans-serif', display: 'block', fontWeight: isToday || inWeek ? 700 : 400, color: isToday ? 'white' : dow === 0 ? '#e74c3c' : dow === 6 ? '#3498db' : '#1a1a2e' }}>{day}</span>
                                        {evtsOnDay.length > 0 && (
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginTop: 1 }}>
                                                {evtsOnDay.slice(0, 2).map((ev, ei) => (
                                                    <div key={ei} style={{ width: 3, height: 3, borderRadius: '50%', background: isToday ? 'rgba(255,255,255,0.8)' : (TPO_COLORS[ev.tpoKeyword] || '#71b3e5') }} />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* TPO categories legend */}
                    {tpoStats.length > 0 && (
                        <div style={{ background: 'white', borderRadius: 18, padding: 16, border: '1px solid #eaedf2' }}>
                            <h3 style={{ fontFamily: 'Hahmlet, sans-serif', fontWeight: 700, fontSize: 13, color: '#1a1a2e', margin: '0 0 12px' }}>일정 유형</h3>
                            {tpoStats.map(({ tpo, color, count }) => (
                                <div key={tpo} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f8f8f8' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
                                        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#555' }}>{tpo}</span>
                                    </div>
                                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#bbb' }}>{count}개</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Right: Week view ── */}
                <div style={{ background: 'white', borderRadius: 20, border: '1px solid #eaedf2', overflow: 'hidden' }}>

                    {/* Week header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #eaedf2' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {[{ fn: prevWeek, ch: '‹' }, { fn: nextWeek, ch: '›' }].map(({ fn, ch }) => (
                                <button key={ch} onClick={fn} style={{ ...btnBase, width: 30, height: 30, background: '#f5f7fa', borderRadius: 8, fontSize: 17, color: '#666' }}>{ch}</button>
                            ))}
                            <span style={{ fontFamily: 'Hahmlet, sans-serif', fontWeight: 700, fontSize: 16, color: '#1a1a2e' }}>{weekLabel}</span>
                            <button onClick={() => setWeekBase(today)} style={{ background: 'rgba(113,179,229,0.12)', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontFamily: 'Kedebideri, sans-serif', fontSize: 11, color: '#71b3e5', fontWeight: 600 }}>오늘</button>
                        </div>
                        <button
                            onClick={() => { setForm({ eventName: '', eventDatetime: dayjs(weekBase).format('YYYY-MM-DD') + 'T09:00', tpoKeyword: '일상' }); setShowForm(true); }}
                            style={{ background: 'linear-gradient(135deg, #71b3e5, #5a9fd4)', border: 'none', borderRadius: 10, padding: '9px 16px', cursor: 'pointer', fontFamily: 'Kedebideri, sans-serif', fontWeight: 700, fontSize: 13, color: 'white', display: 'flex', alignItems: 'center', gap: 5 }}
                        >+ 일정 추가</button>
                    </div>

                    {/* Day column headers */}
                    <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(7, 1fr)', borderBottom: '1px solid #eaedf2' }}>
                        <div style={{ borderRight: '1px solid #eaedf2' }} />
                        {weekDays.map((day, i) => {
                            const isTod = dayjs(day).isSame(dayjs(), 'day');
                            const dow = day.getDay();
                            const evtsOnDay = getEventsOnDay(day);
                            const outfitsOnDay = getOutfitsOnDay(day);
                            return (
                                <div key={i} style={{ textAlign: 'center', padding: '10px 4px 8px', borderRight: i < 6 ? '1px solid #eaedf2' : 'none' }}>
                                    <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 10, margin: 0, letterSpacing: '0.07em', color: isTod ? '#71b3e5' : dow === 0 ? '#e74c3c' : dow === 6 ? '#3498db' : '#aaa' }}>
                                        {DAY_EN[dow]}
                                    </p>
                                    <div style={{ width: 30, height: 30, borderRadius: '50%', margin: '3px auto 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isTod ? 'linear-gradient(135deg, #71b3e5, #5a9fd4)' : 'transparent' }}>
                                        <span style={{ fontFamily: 'Hahmlet, sans-serif', fontWeight: 700, fontSize: 17, color: isTod ? 'white' : dow === 0 ? '#e74c3c' : dow === 6 ? '#3498db' : '#1a1a2e' }}>{day.getDate()}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: 3, minHeight: 8 }}>
                                        {evtsOnDay.slice(0, 3).map((ev, ei) => (
                                            <div key={ei} style={{ width: 5, height: 5, borderRadius: '50%', background: TPO_COLORS[ev.tpoKeyword] || '#71b3e5' }} />
                                        ))}
                                        {outfitsOnDay.length > 0 && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#e625c6' }} />}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Time grid */}
                    <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 310px)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(7, 1fr)' }}>
                            {/* Time labels */}
                            <div style={{ borderRight: '1px solid #eaedf2' }}>
                                {hours.map(h => (
                                    <div key={h} style={{ height: HOUR_H, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: 8, paddingTop: 5, borderBottom: '1px solid #f8f9fc' }}>
                                        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, color: '#ccc', whiteSpace: 'nowrap' }}>{String(h).padStart(2, '0')}:00</span>
                                    </div>
                                ))}
                            </div>

                            {/* Day columns */}
                            {weekDays.map((day, colIdx) => {
                                const dayEvents = getEventsOnDay(day);
                                const dayOutfits = getOutfitsOnDay(day);
                                const isTod = dayjs(day).isSame(dayjs(), 'day');
                                return (
                                    <div key={colIdx} style={{ borderRight: colIdx < 6 ? '1px solid #eaedf2' : 'none', position: 'relative', background: isTod ? 'rgba(113,179,229,0.02)' : 'transparent' }}>
                                        {/* Hour rows */}
                                        {hours.map(h => (
                                            <div key={h} style={{ height: HOUR_H, borderBottom: '1px solid #f8f9fc' }} />
                                        ))}

                                        {/* Events */}
                                        {dayEvents.map((evt, ei) => {
                                            const color = TPO_COLORS[evt.tpoKeyword] || '#71b3e5';
                                            const top = getEventTop(evt.eventDatetime);
                                            const timeStr = (() => {
                                                const d = new Date(evt.eventDatetime);
                                                return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                                            })();
                                            return (
                                                <div key={ei} onClick={() => setActiveEvent(evt)} style={{
                                                    position: 'absolute', top, left: 3, right: 3, height: 76,
                                                    background: `${color}20`,
                                                    borderLeft: `3px solid ${color}`,
                                                    borderRadius: '0 8px 8px 0',
                                                    padding: '6px 8px', overflow: 'hidden',
                                                    cursor: 'pointer', transition: 'opacity 0.15s',
                                                    zIndex: ei + 1,
                                                }}>
                                                    <p style={{ fontFamily: 'Kedebideri, sans-serif', fontWeight: 700, fontSize: 11, color, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{evt.eventName}</p>
                                                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#999', margin: '4px 0 0' }}>{timeStr}</p>
                                                </div>
                                            );
                                        })}

                                        {/* Outfit badge */}
                                        {dayOutfits.length > 0 && (
                                            <div style={{ position: 'absolute', bottom: 6, right: 4, background: 'rgba(230,37,198,0.1)', borderRadius: 6, padding: '2px 7px', pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <WardrobeIcon color="#e625c6" size={11} />
                                                <span style={{ fontSize: 10, color: '#e625c6', fontFamily: 'Kedebideri, sans-serif', fontWeight: 600 }}>코디</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Event detail popup */}
            {activeEvent && (
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={() => setActiveEvent(null)} />
                    <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'white', borderRadius: 20, width: 320, zIndex: 201, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', padding: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 10, height: 10, borderRadius: 3, background: TPO_COLORS[activeEvent.tpoKeyword] || '#71b3e5' }} />
                                <span style={{ fontFamily: 'Kedebideri, sans-serif', fontWeight: 700, fontSize: 11, color: TPO_COLORS[activeEvent.tpoKeyword] || '#71b3e5' }}>{activeEvent.tpoKeyword}</span>
                            </div>
                            <button onClick={() => setActiveEvent(null)} style={{ ...btnBase, fontSize: 18, color: '#aaa' }}>✕</button>
                        </div>
                        <h3 style={{ fontFamily: 'Hahmlet, sans-serif', fontWeight: 700, fontSize: 18, color: '#1a1a2e', margin: '0 0 8px' }}>{activeEvent.eventName}</h3>
                        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#888', margin: '0 0 20px' }}>
                            {dayjs(activeEvent.eventDatetime).format('YYYY년 M월 D일 (ddd) HH:mm')}
                        </p>
                        <button onClick={() => handleDelete(activeEvent.eventId)} style={{ width: '100%', padding: 11, background: 'none', border: '1.5px solid #ffcdd2', borderRadius: 10, color: '#e57373', cursor: 'pointer', fontFamily: 'Kedebideri, sans-serif', fontWeight: 600, fontSize: 13 }}>
                            삭제
                        </button>
                    </div>
                </>
            )}

            {/* Add event modal */}
            {showForm && (
                <>
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} onClick={() => setShowForm(false)} />
                    <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'white', borderRadius: 20, width: 380, maxWidth: '90vw', zIndex: 201, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', padding: 28 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                            <h2 style={{ fontFamily: 'Hahmlet, sans-serif', fontWeight: 700, fontSize: 18, color: '#1a1a2e', margin: 0 }}>일정 추가</h2>
                            <button onClick={() => setShowForm(false)} style={{ ...btnBase, fontSize: 18, color: '#aaa' }}>✕</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                                <label style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>일정 이름</label>
                                <input
                                    value={form.eventName}
                                    onChange={e => setForm({ ...form, eventName: e.target.value })}
                                    placeholder="예: 친구 생일파티"
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #eaedf2', fontSize: 14, fontFamily: 'Inter, sans-serif', boxSizing: 'border-box', outline: 'none' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>날짜 & 시간</label>
                                <input
                                    type="datetime-local"
                                    value={form.eventDatetime}
                                    onChange={e => setForm({ ...form, eventDatetime: e.target.value })}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #eaedf2', fontSize: 14, fontFamily: 'Inter, sans-serif', boxSizing: 'border-box', outline: 'none' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#888', display: 'block', marginBottom: 8 }}>TPO</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {TPO_OPTIONS.map(t => (
                                        <button key={t} onClick={() => setForm({ ...form, tpoKeyword: t })} style={{
                                            padding: '6px 14px', borderRadius: 999, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'Kedebideri, sans-serif', fontSize: 12,
                                            border: form.tpoKeyword === t ? `2px solid ${TPO_COLORS[t] || '#71b3e5'}` : '1.5px solid #eaedf2',
                                            background: form.tpoKeyword === t ? `${TPO_COLORS[t] || '#71b3e5'}18` : '#f8f9fc',
                                            color: form.tpoKeyword === t ? (TPO_COLORS[t] || '#71b3e5') : '#555',
                                            fontWeight: form.tpoKeyword === t ? 700 : 400,
                                        }}>{t}</button>
                                    ))}
                                </div>
                            </div>
                            <button onClick={handleAddEvent} style={{ width: '100%', padding: 13, background: 'linear-gradient(135deg, #71b3e5, #5a9fd4)', border: 'none', borderRadius: 12, color: 'white', fontFamily: 'Kedebideri, sans-serif', fontWeight: 700, fontSize: 15, cursor: 'pointer', marginTop: 4 }}>
                                추가하기
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default Calendar;
