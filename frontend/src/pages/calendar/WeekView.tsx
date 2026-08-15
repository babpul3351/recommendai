import React from 'react';
import { theme } from '../../styles/theme';
import { WardrobeIcon } from '../../components/Icons';
import { DAY_EN, TPO_COLORS, START_HOUR, END_HOUR, HOUR_H } from './constants';
import { CalendarEvent, Outfit } from './types';
import dayjs from 'dayjs';

const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const btnBase: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

function getEventTop(datetime: string): number {
    const d = new Date(datetime);
    const h = d.getHours(); const m = d.getMinutes();
    if (h < START_HOUR) return 0;
    if (h >= END_HOUR) return (END_HOUR - START_HOUR) * HOUR_H - 80;
    return (h - START_HOUR) * HOUR_H + (m / 60) * HOUR_H;
}

interface Props {
    weekDays: Date[];
    weekLabel: string;
    events: CalendarEvent[];
    outfits: Outfit[];
    onPrevWeek: () => void;
    onNextWeek: () => void;
    onGoToToday: () => void;
    onOpenAddForm: () => void;
    onSelectEvent: (event: CalendarEvent) => void;
}

function WeekView({ weekDays, weekLabel, events, outfits, onPrevWeek, onNextWeek, onGoToToday, onOpenAddForm, onSelectEvent }: Props) {
    const getEventsOnDay = (date: Date): CalendarEvent[] =>
        events.filter(e => {
            const d = new Date(e.eventDatetime);
            return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth() && d.getDate() === date.getDate();
        });

    const getOutfitsOnDay = (date: Date): Outfit[] => {
        const dateStr = dayjs(date).format('YYYY-MM-DD');
        return outfits.filter(o => o.outfitDate === dateStr);
    };

    return (
        <div style={{ background: 'white', borderRadius: 20, border: '1px solid #eaedf2', overflow: 'hidden' }}>

            {/* Week header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #eaedf2' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {[{ fn: onPrevWeek, ch: '‹' }, { fn: onNextWeek, ch: '›' }].map(({ fn, ch }) => (
                        <button key={ch} onClick={fn} style={{ ...btnBase, width: 30, height: 30, background: '#f5f7fa', borderRadius: 8, fontSize: 17, color: '#666' }}>{ch}</button>
                    ))}
                    <span style={{  fontWeight: 700, fontSize: 16, color: '#1a1a2e' }}>{weekLabel}</span>
                    <button onClick={onGoToToday} style={{ background: 'rgba(113,179,229,0.12)', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer',  fontSize: 11, color: '#71b3e5', fontWeight: 600 }}>오늘</button>
                </div>
                <button onClick={onOpenAddForm} style={{ background: 'linear-gradient(135deg, #71b3e5, #5a9fd4)', border: 'none', borderRadius: 10, padding: '9px 16px', cursor: 'pointer',  fontWeight: 700, fontSize: 13, color: 'white', display: 'flex', alignItems: 'center', gap: 5 }}>
                    + 일정 추가
                </button>
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
                            <p style={{  fontWeight: 600, fontSize: 10, margin: 0, letterSpacing: '0.07em', color: isTod ? '#71b3e5' : dow === 0 ? '#e74c3c' : dow === 6 ? '#3498db' : '#aaa' }}>
                                {DAY_EN[dow]}
                            </p>
                            <div style={{ width: 30, height: 30, borderRadius: '50%', margin: '3px auto 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isTod ? 'linear-gradient(135deg, #71b3e5, #5a9fd4)' : 'transparent' }}>
                                <span style={{  fontWeight: 700, fontSize: 17, color: isTod ? 'white' : dow === 0 ? '#e74c3c' : dow === 6 ? '#3498db' : '#1a1a2e' }}>{day.getDate()}</span>
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
                                <span style={{  fontSize: 9, color: '#ccc', whiteSpace: 'nowrap' }}>{String(h).padStart(2, '0')}:00</span>
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
                                {hours.map(h => (
                                    <div key={h} style={{ height: HOUR_H, borderBottom: '1px solid #f8f9fc' }} />
                                ))}
                                {dayEvents.map((evt, ei) => {
                                    const color = TPO_COLORS[evt.tpoKeyword] || '#71b3e5';
                                    const top = getEventTop(evt.eventDatetime);
                                    const timeStr = (() => {
                                        const d = new Date(evt.eventDatetime);
                                        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                                    })();
                                    return (
                                        <div key={ei} onClick={() => onSelectEvent(evt)} style={{
                                            position: 'absolute', top, left: 3, right: 3, height: 76,
                                            background: `${color}20`,
                                            borderLeft: `3px solid ${color}`,
                                            borderRadius: '0 8px 8px 0',
                                            padding: '6px 8px', overflow: 'hidden',
                                            cursor: 'pointer', transition: 'opacity 0.15s',
                                            zIndex: ei + 1,
                                        }}>
                                            <p style={{  fontWeight: 700, fontSize: 11, color, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{evt.eventName}</p>
                                            <p style={{  fontSize: 10, color: '#999', margin: '4px 0 0' }}>{timeStr}</p>
                                        </div>
                                    );
                                })}
                                {dayOutfits.length > 0 && (
                                    <div style={{ position: 'absolute', bottom: 6, right: 4, background: 'rgba(230,37,198,0.1)', borderRadius: 6, padding: '2px 7px', pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <WardrobeIcon color="#e625c6" size={11} />
                                        <span style={{ fontSize: 10, color: '#e625c6',  fontWeight: 600 }}>코디</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default WeekView;
