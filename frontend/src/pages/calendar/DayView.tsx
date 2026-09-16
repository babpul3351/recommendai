import React, { useEffect, useRef } from 'react';
import { WardrobeIcon } from '../../components/Icons';
import { DAY_KO, TPO_COLORS, START_HOUR, END_HOUR, HOUR_H } from './constants';
import { CalendarEvent, Outfit } from './types';
import dayjs from 'dayjs';

const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const btnBase: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

function getEventTop(datetime: string): number {
    const d = new Date(datetime);
    const h = d.getHours(); const m = d.getMinutes();
    if (h < START_HOUR) return 0;
    if (h >= END_HOUR) return (END_HOUR - START_HOUR) * HOUR_H - 72;
    return (h - START_HOUR) * HOUR_H + (m / 60) * HOUR_H;
}

function getCurrentTimeTop(): number {
    const now = new Date();
    const h = now.getHours(); const m = now.getMinutes();
    if (h < START_HOUR) return 0;
    if (h >= END_HOUR) return (END_HOUR - START_HOUR) * HOUR_H;
    return (h - START_HOUR) * HOUR_H + (m / 60) * HOUR_H;
}

interface Props {
    selectedDate: Date;
    today: Date;
    events: CalendarEvent[];
    outfits: Outfit[];
    onPrevDay: () => void;
    onNextDay: () => void;
    onGoToToday: () => void;
    onOpenAddForm: (date?: Date) => void;
    onSelectEvent: (event: CalendarEvent) => void;
}

function DayView({ selectedDate, today, events, outfits, onPrevDay, onNextDay, onGoToToday, onOpenAddForm, onSelectEvent }: Props) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const isToday = dayjs(selectedDate).isSame(dayjs(), 'day');
    const dow = selectedDate.getDay();

    const dayEvents = events.filter(e => {
        const d = new Date(e.eventDatetime);
        return d.getFullYear() === selectedDate.getFullYear()
            && d.getMonth() === selectedDate.getMonth()
            && d.getDate() === selectedDate.getDate();
    }).sort((a, b) => new Date(a.eventDatetime).getTime() - new Date(b.eventDatetime).getTime());

    const dateStr = dayjs(selectedDate).format('YYYY-MM-DD');
    const dayOutfits = outfits.filter(o => o.outfitDate === dateStr);

    const dateLabel = `${selectedDate.getFullYear()}년 ${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일 ${DAY_KO[dow]}요일`;

    // Scroll to current time (or 8am) on mount / date change
    useEffect(() => {
        if (!scrollRef.current) return;
        const top = isToday ? Math.max(0, getCurrentTimeTop() - 80) : 0;
        scrollRef.current.scrollTop = top;
    }, [selectedDate, isToday]);

    // Layout overlapping events side-by-side
    const eventsWithLayout = computeLayout(dayEvents);

    return (
        <div style={{ background: 'white', borderRadius: 20, border: '1px solid #eaedf2', overflow: 'hidden' }}>

            {/* Navigation header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #eaedf2' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {[{ fn: onPrevDay, ch: '‹' }, { fn: onNextDay, ch: '›' }].map(({ fn, ch }) => (
                        <button key={ch} onClick={fn} style={{ ...btnBase, width: 30, height: 30, background: '#f5f7fa', borderRadius: 8, fontSize: 17, color: '#666' }}>{ch}</button>
                    ))}
                    <span style={{ fontWeight: 700, fontSize: 16, color: '#1a1a2e' }}>{dateLabel}</span>
                    <button onClick={onGoToToday} style={{ background: 'rgba(113,179,229,0.12)', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 11, color: '#71b3e5', fontWeight: 600 }}>
                        오늘
                    </button>
                </div>
                <button
                    onClick={() => onOpenAddForm(selectedDate)}
                    style={{ background: 'linear-gradient(135deg, #71b3e5, #5a9fd4)', border: 'none', borderRadius: 10, padding: '9px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 13, color: 'white', display: 'flex', alignItems: 'center', gap: 5 }}
                >
                    + 일정 추가
                </button>
            </div>

            {/* Outfit section */}
            {dayOutfits.length > 0 && (
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #f5e9a0', background: '#FFFDE7' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#7a5800', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <WardrobeIcon color="#c89000" size={12} />
                        {isToday ? '오늘의 추천 코디' : '이 날의 추천 코디'}
                    </p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {dayOutfits[0].matchedItems?.filter(item => item.imageUrl).slice(0, 6).map((item, i) => (
                            <img
                                key={i}
                                src={item.imageUrl}
                                alt=""
                                style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', border: '1.5px solid #FFE082' }}
                            />
                        ))}
                        {dayOutfits[0].description && (
                            <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', background: '#FFE082', borderRadius: 10, flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: 12, color: '#7a5800', margin: 0, lineHeight: 1.6 }}>{dayOutfits[0].description}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Time grid */}
            <div ref={scrollRef} style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 290px)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr' }}>

                    {/* Time labels */}
                    <div style={{ borderRight: '1px solid #eaedf2' }}>
                        {hours.map(h => (
                            <div key={h} style={{ height: HOUR_H, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: 10, paddingTop: 5, borderBottom: '1px solid #f8f9fc' }}>
                                <span style={{ fontSize: 10, color: '#ccc', whiteSpace: 'nowrap' }}>{String(h).padStart(2, '0')}:00</span>
                            </div>
                        ))}
                    </div>

                    {/* Events column */}
                    <div style={{ position: 'relative', background: isToday ? 'rgba(113,179,229,0.02)' : 'transparent' }}>
                        {/* Hour grid lines */}
                        {hours.map(h => (
                            <div key={h} style={{ height: HOUR_H, borderBottom: '1px solid #f8f9fc' }} />
                        ))}

                        {/* Current time indicator */}
                        {isToday && (
                            <div style={{ position: 'absolute', left: 0, right: 0, top: getCurrentTimeTop(), zIndex: 10, pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#71b3e5', flexShrink: 0, marginLeft: -4 }} />
                                <div style={{ flex: 1, height: 1.5, background: '#71b3e5', opacity: 0.6 }} />
                            </div>
                        )}

                        {/* Events */}
                        {eventsWithLayout.map(({ event: evt, col, total }, ei) => {
                            const color = TPO_COLORS[evt.tpoKeyword] || '#71b3e5';
                            const top = getEventTop(evt.eventDatetime);
                            const d = new Date(evt.eventDatetime);
                            const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                            const widthPct = 100 / total;
                            const leftPct = col * widthPct;

                            return (
                                <div
                                    key={ei}
                                    onClick={() => onSelectEvent(evt)}
                                    style={{
                                        position: 'absolute',
                                        top,
                                        left: `calc(${leftPct}% + 8px)`,
                                        width: `calc(${widthPct}% - 14px)`,
                                        minHeight: 56,
                                        background: `${color}18`,
                                        borderLeft: `3px solid ${color}`,
                                        borderRadius: '0 10px 10px 0',
                                        padding: '8px 12px',
                                        overflow: 'hidden',
                                        cursor: 'pointer',
                                        zIndex: ei + 1,
                                        transition: 'opacity 0.15s',
                                        boxShadow: `0 2px 8px ${color}20`,
                                    }}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.85'}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                                >
                                    <p style={{ fontWeight: 700, fontSize: 13, color, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{evt.eventName}</p>
                                    <p style={{ fontSize: 11, color: '#999', margin: '4px 0 0' }}>{timeStr}</p>
                                    <span style={{ fontSize: 10, color: `${color}bb`, background: `${color}15`, borderRadius: 4, padding: '1px 6px', display: 'inline-block', marginTop: 4 }}>{evt.tpoKeyword}</span>
                                </div>
                            );
                        })}

                        {/* Empty state */}
                        {dayEvents.length === 0 && (
                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                                <p style={{ fontSize: 13, color: '#ddd', fontWeight: 500, margin: 0 }}>일정이 없습니다</p>
                                <p style={{ fontSize: 11, color: '#e8eaed', margin: '4px 0 0' }}>위 버튼으로 일정을 추가해보세요</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Compute side-by-side columns for overlapping events
function computeLayout(events: CalendarEvent[]): { event: CalendarEvent; col: number; total: number }[] {
    const result: { event: CalendarEvent; col: number; total: number }[] = [];
    const groups: CalendarEvent[][] = [];

    for (const evt of events) {
        const evtStart = new Date(evt.eventDatetime).getTime();
        const evtEnd = evtStart + 60 * 60 * 1000; // assume 1h duration

        let placed = false;
        for (const group of groups) {
            const overlaps = group.some(g => {
                const s = new Date(g.eventDatetime).getTime();
                const e = s + 60 * 60 * 1000;
                return evtStart < e && evtEnd > s;
            });
            if (overlaps) {
                group.push(evt);
                placed = true;
                break;
            }
        }
        if (!placed) groups.push([evt]);
    }

    for (const group of groups) {
        group.forEach((evt, col) => {
            result.push({ event: evt, col, total: group.length });
        });
    }

    return result;
}

export default DayView;
