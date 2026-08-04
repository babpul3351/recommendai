import React from 'react';
import { theme } from '../../styles/theme';
import { WEEKDAYS, TPO_COLORS } from './constants';
import { CalendarEvent } from './types';
import dayjs from 'dayjs';

const btnBase: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

interface Props {
    calYear: number;
    calMonth: number;
    today: Date;
    weekDays: Date[];
    events: CalendarEvent[];
    onPrevMonth: () => void;
    onNextMonth: () => void;
    onDayClick: (date: Date) => void;
}

function MiniCalendar({ calYear, calMonth, today, weekDays, events, onPrevMonth, onNextMonth, onDayClick }: Props) {
    const daysInMonth = dayjs().year(calYear).month(calMonth).daysInMonth();
    const firstDay = dayjs().year(calYear).month(calMonth).date(1).day();

    return (
        <div style={{ background: 'white', borderRadius: 18, padding: 16, border: '1px solid #eaedf2', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontFamily: theme.fontFamily.heading, fontWeight: 700, fontSize: 13, color: '#1a1a2e' }}>
                    {calYear}년 {calMonth + 1}월
                </span>
                <div style={{ display: 'flex', gap: 2 }}>
                    {[{ fn: onPrevMonth, ch: '‹' }, { fn: onNextMonth, ch: '›' }].map(({ fn, ch }) => (
                        <button key={ch} onClick={fn} style={{ ...btnBase, width: 24, height: 24, borderRadius: 6, color: '#71b3e5', fontSize: 15 }}>{ch}</button>
                    ))}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
                {WEEKDAYS.map((d, i) => (
                    <div key={d} style={{ textAlign: 'center', fontSize: 9, fontWeight: 600, fontFamily: theme.fontFamily.body, padding: '2px 0', color: i === 0 ? '#e74c3c' : i === 6 ? '#3498db' : '#bbb' }}>{d}</div>
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
                        <div key={day} onClick={() => onDayClick(new Date(calYear, calMonth, day))} style={{
                            textAlign: 'center', padding: '3px 1px', cursor: 'pointer', borderRadius: 6,
                            background: isToday ? 'linear-gradient(135deg, #71b3e5, #5a9fd4)' : inWeek ? 'rgba(113,179,229,0.1)' : 'transparent',
                        }}>
                            <span style={{ fontSize: 11, fontFamily: theme.fontFamily.heading, display: 'block', fontWeight: isToday || inWeek ? 700 : 400, color: isToday ? 'white' : dow === 0 ? '#e74c3c' : dow === 6 ? '#3498db' : '#1a1a2e' }}>{day}</span>
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
    );
}

export default MiniCalendar;
