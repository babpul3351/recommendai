import React, { useEffect, useState, useCallback } from 'react';
import { calendarAPI, recommendationAPI } from '../../api/api';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import { TPO_COLORS } from './constants';
import { CalendarEvent, Outfit, EventForm } from './types';
import MonthView from './MonthView';
import DayView from './DayView';
import EventDetailModal from './EventDetailModal';
import AddEventModal from './AddEventModal';
dayjs.locale('ko');

type ViewMode = 'month' | 'day';

function Calendar() {
    const today = new Date();
    const [view, setView] = useState<ViewMode>('month');
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [outfits, setOutfits] = useState<Outfit[]>([]);
    const [calYear, setCalYear] = useState(today.getFullYear());
    const [calMonth, setCalMonth] = useState(today.getMonth());
    const [selectedDate, setSelectedDate] = useState<Date>(today);
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

    // Month navigation
    const handlePrevMonth = () => {
        if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
        else setCalMonth(m => m - 1);
    };
    const handleNextMonth = () => {
        if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
        else setCalMonth(m => m + 1);
    };

    // Day navigation
    const handlePrevDay = () => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() - 1);
        setSelectedDate(d);
    };
    const handleNextDay = () => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + 1);
        setSelectedDate(d);
    };

    const handleGoToToday = () => {
        setSelectedDate(today);
        setCalYear(today.getFullYear());
        setCalMonth(today.getMonth());
    };

    // Month grid date click → switch to day view
    const handleMonthDayClick = (date: Date) => {
        setSelectedDate(date);
        setView('day');
    };

    const handleOpenAddForm = (date?: Date) => {
        const base = date ?? (view === 'month' ? new Date(calYear, calMonth, today.getDate()) : selectedDate);
        setForm({ eventName: '', eventDatetime: dayjs(base).format('YYYY-MM-DD') + 'T09:00', tpoKeyword: '일상' });
        setShowForm(true);
    };

    const handleAddEvent = async () => {
        if (!form.eventName || !form.eventDatetime) { showToast('일정 이름과 날짜를 입력해주세요', 'error'); return; }
        try {
            const { selectedOutfit, ...eventData } = form;
            const res = await calendarAPI.addEvent(eventData);
            if (selectedOutfit?.imageUrl && res.data?.eventId) {
                localStorage.setItem(`calendar_outfit_${res.data.eventId}`, selectedOutfit.imageUrl);
            }
            setForm({ eventName: '', eventDatetime: '', tpoKeyword: '일상', selectedOutfit: null });
            setShowForm(false);
            await fetchEvents();
            showToast('일정이 추가됐습니다', 'success');
        } catch (err) { showToast('일정 추가에 실패했습니다', 'error'); }
    };

    const handleDelete = async (eventId: number) => {
        if (!window.confirm('삭제하시겠습니까?')) return;
        try {
            await calendarAPI.deleteEvent(eventId);
            localStorage.removeItem(`calendar_outfit_${eventId}`);
            setEvents(events.filter(e => e.eventId !== eventId));
            setActiveEvent(null);
            showToast('일정이 삭제됐습니다', 'success');
        } catch (err) { showToast('삭제에 실패했습니다', 'error'); }
    };

    const handleViewChange = (next: ViewMode) => {
        if (next === 'month') {
            // Sync month view to the currently selected date
            setCalYear(selectedDate.getFullYear());
            setCalMonth(selectedDate.getMonth());
        }
        setView(next);
    };

    return (
        <div style={{ padding: '70px 36px', maxWidth: 1200, width: '100%', boxSizing: 'border-box' }}>

            {/* Header */}
            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontWeight: 700, fontSize: 28, color: '#1a1a2e', margin: 0 }}>캘린더</h1>
                <p style={{ fontSize: 14, color: '#888', margin: '6px 0 0' }}>일정과 코디를 한눈에 확인하세요</p>
            </div>

            {/* Tab bar — same style as 내옷장 */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#f0f2f5', borderRadius: 12, padding: 4, width: 'fit-content' }}>
                {([{ id: 'month', label: '월간' }, { id: 'day', label: '일간' }] as { id: ViewMode; label: string }[]).map(({ id, label }) => {
                    const active = view === id;
                    return (
                        <button
                            key={id}
                            onClick={() => handleViewChange(id)}
                            style={{
                                background: active ? 'white' : 'transparent',
                                border: 'none',
                                borderRadius: 9,
                                padding: '8px 24px',
                                fontWeight: active ? 600 : 400,
                                fontSize: 14,
                                color: active ? '#1a1a2e' : '#888',
                                cursor: 'pointer',
                                boxShadow: active ? '0 1px 6px rgba(0,0,0,0.08)' : 'none',
                                transition: 'all 0.15s',
                            }}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>

            {/* Main content + right sidebar */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 18, alignItems: 'start' }}>

            {view === 'month' ? (
                <MonthView
                    calYear={calYear}
                    calMonth={calMonth}
                    today={today}
                    events={events}
                    outfits={outfits}
                    onPrevMonth={handlePrevMonth}
                    onNextMonth={handleNextMonth}
                    onGoToToday={handleGoToToday}
                    onOpenAddForm={handleOpenAddForm}
                    onSelectEvent={setActiveEvent}
                    onDayClick={handleMonthDayClick}
                />
            ) : (
                <DayView
                    selectedDate={selectedDate}
                    today={today}
                    events={events}
                    outfits={outfits}
                    onPrevDay={handlePrevDay}
                    onNextDay={handleNextDay}
                    onGoToToday={handleGoToToday}
                    onOpenAddForm={handleOpenAddForm}
                    onSelectEvent={setActiveEvent}
                />
            )}

            {/* Right sidebar — TPO stats */}
            <div style={{ background: 'white', borderRadius: 18, padding: 18, border: '1px solid #eaedf2', position: 'sticky', top: 80 }}>
                <h3 style={{ fontWeight: 700, fontSize: 13, color: '#1a1a2e', margin: '0 0 14px' }}>일정 유형</h3>
                {Object.entries(TPO_COLORS).map(([tpo, color]) => {
                    const count = events.filter(e => e.tpoKeyword === tpo).length;
                    if (count === 0) return null;
                    return (
                        <div key={tpo} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f8f8f8' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
                                <span style={{ fontSize: 12, color: '#555' }}>{tpo}</span>
                            </div>
                            <span style={{ fontSize: 11, color: '#bbb' }}>{count}개</span>
                        </div>
                    );
                })}
                {events.length === 0 && (
                    <p style={{ fontSize: 12, color: '#ccc', margin: 0, textAlign: 'center', padding: '12px 0' }}>일정이 없습니다</p>
                )}
            </div>

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
                    background: toast.type === 'success' ? '#71B3E5' : '#e57373',
                    color: 'white', borderRadius: 12, padding: '12px 24px',
                    fontSize: 14, fontWeight: 600, zIndex: 300,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                    display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
                }}>
                    {toast.type === 'success' ? '✓' : '✕'} {toast.message}
                </div>
            )}
        </div>
    );
}

export default Calendar;
