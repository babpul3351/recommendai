import React from 'react';
import { WEEKDAYS, TPO_COLORS } from './constants';
import { CalendarEvent, Outfit } from './types';
import dayjs from 'dayjs';
import { WardrobeIcon } from '../../components/Icons';

const btnBase: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
};

interface Props {
    calYear: number;
    calMonth: number;
    today: Date;
    events: CalendarEvent[];
    outfits: Outfit[];
    onPrevMonth: () => void;
    onNextMonth: () => void;
    onGoToToday: () => void;
    onOpenAddForm: (date?: Date) => void;
    onSelectEvent: (event: CalendarEvent) => void;
    onDayClick: (date: Date) => void;
}

function MonthView({ calYear, calMonth, today, events, outfits, onPrevMonth, onNextMonth, onGoToToday, onOpenAddForm, onSelectEvent, onDayClick }: Props) {
    const daysInMonth = dayjs().year(calYear).month(calMonth).daysInMonth();
    const firstDay = dayjs().year(calYear).month(calMonth).date(1).day();

    const cells: (number | null)[] = [
        ...Array(firstDay).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    const getEventsOnDay = (day: number): CalendarEvent[] =>
        events.filter(e => {
            const d = new Date(e.eventDatetime);
            return d.getFullYear() === calYear && d.getMonth() === calMonth && d.getDate() === day;
        });

    const hasOutfit = (day: number): boolean => {
        const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return outfits.some(o => o.outfitDate === dateStr);
    };

    const rows = cells.length / 7;
    const cellMinHeight = rows <= 5 ? 116 : 100;

    return (
        <div style={{ background: 'white', borderRadius: 20, border: '1px solid #eaedf2', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #eaedf2' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {[{ fn: onPrevMonth, ch: '‹' }, { fn: onNextMonth, ch: '›' }].map(({ fn, ch }) => (
                        <button key={ch} onClick={fn} style={{ ...btnBase, width: 30, height: 30, background: '#f5f7fa', borderRadius: 8, fontSize: 17, color: '#666' }}>{ch}</button>
                    ))}
                    <span style={{ fontWeight: 700, fontSize: 16, color: '#1a1a2e' }}>
                        {calYear}년 {calMonth + 1}월
                    </span>
                    <button onClick={onGoToToday} style={{ background: 'rgba(113,179,229,0.12)', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 11, color: '#71b3e5', fontWeight: 600 }}>
                        오늘
                    </button>
                </div>
                <button
                    onClick={() => onOpenAddForm()}
                    style={{ background: 'linear-gradient(135deg, #71b3e5, #5a9fd4)', border: 'none', borderRadius: 10, padding: '9px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 13, color: 'white', display: 'flex', alignItems: 'center', gap: 5 }}
                >
                    + 일정 추가
                </button>
            </div>

            {/* Day-of-week header */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #eaedf2' }}>
                {WEEKDAYS.map((d, i) => (
                    <div key={d} style={{ textAlign: 'center', padding: '10px 0', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: i === 0 ? '#e74c3c' : i === 6 ? '#3498db' : '#aaa' }}>
                        {d}
                    </div>
                ))}
            </div>

            {/* Month grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {cells.map((day, i) => {
                    const dow = i % 7;
                    const isLastRow = i >= cells.length - 7;

                    if (day === null) {
                        return (
                            <div key={`empty-${i}`} style={{
                                minHeight: cellMinHeight,
                                borderRight: dow < 6 ? '1px solid #eaedf2' : 'none',
                                borderBottom: !isLastRow ? '1px solid #eaedf2' : 'none',
                                background: '#fafbfc',
                            }} />
                        );
                    }

                    const isToday = today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === day;
                    const dayEvents = getEventsOnDay(day);
                    const hasOutfitToday = hasOutfit(day);

                    return (
                        <div key={day} style={{
                            minHeight: cellMinHeight,
                            borderRight: dow < 6 ? '1px solid #eaedf2' : 'none',
                            borderBottom: !isLastRow ? '1px solid #eaedf2' : 'none',
                            padding: '7px 7px 6px',
                            background: isToday ? 'rgba(113,179,229,0.04)' : 'transparent',
                            boxSizing: 'border-box',
                        }}>
                            {/* Date number — click to go to day view */}
                            <div style={{ marginBottom: 5 }}>
                                <span
                                    onClick={() => onDayClick(new Date(calYear, calMonth, day))}
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                        width: 26, height: 26, borderRadius: '50%', cursor: 'pointer',
                                        fontSize: 12, fontWeight: isToday ? 700 : 500,
                                        background: isToday ? 'linear-gradient(135deg, #71b3e5, #5a9fd4)' : 'transparent',
                                        color: isToday ? 'white' : dow === 0 ? '#e74c3c' : dow === 6 ? '#3498db' : '#1a1a2e',
                                    }}
                                >
                                    {day}
                                </span>
                            </div>

                            {/* Event chips */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {dayEvents.slice(0, 3).map((evt, ei) => {
                                    const color = TPO_COLORS[evt.tpoKeyword] || '#71b3e5';
                                    return (
                                        <div
                                            key={ei}
                                            onClick={() => onSelectEvent(evt)}
                                            style={{
                                                background: `${color}18`,
                                                borderLeft: `2.5px solid ${color}`,
                                                borderRadius: '0 5px 5px 0',
                                                padding: '2px 5px',
                                                cursor: 'pointer',
                                                overflow: 'hidden',
                                            }}
                                        >
                                            <span style={{ fontSize: 10, fontWeight: 600, color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                                                {evt.eventName}
                                            </span>
                                        </div>
                                    );
                                })}
                                {dayEvents.length > 3 && (
                                    <span style={{ fontSize: 9, color: '#bbb', fontWeight: 600, paddingLeft: 4 }}>
                                        +{dayEvents.length - 3}개 더
                                    </span>
                                )}
                            </div>

                            {/* Outfit badge */}
                            {hasOutfitToday && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 4 }}>
                                    <WardrobeIcon color="#c89000" size={9} />
                                    <span style={{ fontSize: 9, color: '#c89000', fontWeight: 600 }}>코디</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default MonthView;
