import React from 'react';
import { theme } from '../../styles/theme';
import { TPO_COLORS } from './constants';
import { CalendarEvent } from './types';
import dayjs from 'dayjs';

const btnBase: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

interface Props {
    event: CalendarEvent;
    onClose: () => void;
    onDelete: (eventId: number) => void;
}

function EventDetailModal({ event, onClose, onDelete }: Props) {
    return (
        <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={onClose} />
            <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'white', borderRadius: 20, width: 320, zIndex: 201, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: TPO_COLORS[event.tpoKeyword] || '#71b3e5' }} />
                        <span style={{  fontWeight: 700, fontSize: 11, color: TPO_COLORS[event.tpoKeyword] || '#71b3e5' }}>{event.tpoKeyword}</span>
                    </div>
                    <button onClick={onClose} style={{ ...btnBase, fontSize: 18, color: '#aaa' }}>✕</button>
                </div>
                <h3 style={{  fontWeight: 700, fontSize: 18, color: '#1a1a2e', margin: '0 0 8px' }}>{event.eventName}</h3>
                <p style={{  fontSize: 13, color: '#888', margin: '0 0 20px' }}>
                    {dayjs(event.eventDatetime).format('YYYY년 M월 D일 (ddd) HH:mm')}
                </p>
                <button onClick={() => onDelete(event.eventId)} style={{ width: '100%', padding: 11, background: 'none', border: '1.5px solid #ffcdd2', borderRadius: 10, color: '#e57373', cursor: 'pointer',  fontWeight: 600, fontSize: 13 }}>
                    삭제
                </button>
            </div>
        </>
    );
}

export default EventDetailModal;
