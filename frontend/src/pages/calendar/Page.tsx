import React, { useEffect, useState, useCallback } from 'react';
import { theme } from '../../styles/theme';
import { calendarAPI, recommendationAPI } from '../../api/api';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import { TPO_COLORS } from './constants';
import { CalendarEvent, Outfit, EventForm } from './types';
import MiniCalendar from './MiniCalendar';
import WeekView from './WeekView';
import EventDetailModal from './EventDetailModal';
import AddEventModal from './AddEventModal';
dayjs.locale('ko');

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
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const showToast = useCallback((message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 2500);
    }, []);

    const fetchEvents = useCallback(async () => {
        try { const res = await calendarAPI.getEvents(); setEvents(res.data); } catch (err) { console.error(err); }
    }, []);

    const fetchOutfits = useCallback(async () => {
        try {
            const now = new Date();
            const res = await recommendationAPI.getWeekOutfits(`${now.getFullYear()}-01-01`, `${now.getFullYear()}-12-31`);
            setOutfits(res.data || []);
        } catch (err) { console.error(err); }
    }, []);

    useEffect(() => { fetchEvents(); fetchOutfits(); }, [fetchEvents, fetchOutfits]);

    const weekStart = getWeekMonday(weekBase);
    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
    });

    const handleAddEvent = async () => {
        if (!form.eventName || !form.eventDatetime) { showToast('일정 이름과 날짜를 입력해주세요', 'error'); return; }
        try {
            await calendarAPI.addEvent(form);
            setForm({ eventName: '', eventDatetime: '', tpoKeyword: '일상' });
            setShowForm(false);
            await fetchEvents();
            showToast('일정이 추가됐습니다', 'success');
        } catch (err) { showToast('일정 추가에 실패했습니다', 'error'); }
    };

    const handleDelete = async (eventId: number) => {
        if (!window.confirm('삭제하시겠습니까?')) return;
        try {
            await calendarAPI.deleteEvent(eventId);
            setEvents(events.filter(e => e.eventId !== eventId));
            setActiveEvent(null);
            showToast('일정이 삭제됐습니다', 'success');
        } catch (err) { showToast('삭제에 실패했습니다', 'error'); }
    };

    const handlePrevMonth = () => {
        if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
        else setCalMonth(m => m - 1);
    };
    const handleNextMonth = () => {
        if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
        else setCalMonth(m => m + 1);
    };
    const prevWeek = () => { const d = new Date(weekBase); d.setDate(d.getDate() - 7); setWeekBase(d); };
    const nextWeek = () => { const d = new Date(weekBase); d.setDate(d.getDate() + 7); setWeekBase(d); };

    const handleOpenAddForm = () => {
        setForm({ eventName: '', eventDatetime: dayjs(weekBase).format('YYYY-MM-DD') + 'T09:00', tpoKeyword: '일상' });
        setShowForm(true);
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

    return (
        <div style={{ padding: '70px 28px', width: '100%' }}>
            {/* Header */}
            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontFamily: theme.fontFamily.heading, fontWeight: 700, fontSize: 28, color: '#1a1a2e', margin: 0 }}>캘린더</h1>
                <p style={{ fontFamily: theme.fontFamily.body, fontSize: 13, color: '#888', margin: '5px 0 0' }}>일정과 코디를 한눈에 확인하세요</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '228px 1fr', gap: 18, alignItems: 'start' }}>

                {/* Left sidebar */}
                <div>
                    <MiniCalendar
                        calYear={calYear}
                        calMonth={calMonth}
                        today={today}
                        weekDays={weekDays}
                        events={events}
                        onPrevMonth={handlePrevMonth}
                        onNextMonth={handleNextMonth}
                        onDayClick={setWeekBase}
                    />
                    {tpoStats.length > 0 && (
                        <div style={{ background: 'white', borderRadius: 18, padding: 16, border: '1px solid #eaedf2' }}>
                            <h3 style={{ fontFamily: theme.fontFamily.heading, fontWeight: 700, fontSize: 13, color: '#1a1a2e', margin: '0 0 12px' }}>일정 유형</h3>
                            {tpoStats.map(({ tpo, color, count }) => (
                                <div key={tpo} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f8f8f8' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
                                        <span style={{ fontFamily: theme.fontFamily.body, fontSize: 12, color: '#555' }}>{tpo}</span>
                                    </div>
                                    <span style={{ fontFamily: theme.fontFamily.body, fontSize: 11, color: '#bbb' }}>{count}개</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right: Week view */}
                <WeekView
                    weekDays={weekDays}
                    weekLabel={weekLabel}
                    events={events}
                    outfits={outfits}
                    onPrevWeek={prevWeek}
                    onNextWeek={nextWeek}
                    onGoToToday={() => setWeekBase(today)}
                    onOpenAddForm={handleOpenAddForm}
                    onSelectEvent={setActiveEvent}
                />
            </div>

            {activeEvent && (
                <EventDetailModal
                    event={activeEvent}
                    onClose={() => setActiveEvent(null)}
                    onDelete={handleDelete}
                />
            )}

            {showForm && (
                <AddEventModal
                    form={form}
                    onFormChange={setForm}
                    onClose={() => setShowForm(false)}
                    onSubmit={handleAddEvent}
                />
            )}

            {toast && (
                <div style={{
                    position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
                    background: toast.type === 'success' ? '#1a1a2e' : '#e57373',
                    color: 'white', borderRadius: 12, padding: '12px 24px',
                    fontFamily: theme.fontFamily.ui, fontSize: 14, fontWeight: 600,
                    zIndex: 300, boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                    display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
                }}>
                    {toast.type === 'success' ? '✓' : '✕'} {toast.message}
                </div>
            )}
        </div>
    );
}

export default Calendar;

function getWeekMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}
