import React from 'react';
import { theme } from '../../styles/theme';
import { TPO_OPTIONS, TPO_COLORS } from './constants';
import { EventForm } from './types';

const btnBase: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

interface Props {
    form: EventForm;
    onFormChange: (form: EventForm) => void;
    onClose: () => void;
    onSubmit: () => void;
}

function AddEventModal({ form, onFormChange, onClose, onSubmit }: Props) {
    return (
        <>
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} onClick={onClose} />
            <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'white', borderRadius: 20, width: 380, maxWidth: '90vw', zIndex: 201, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', padding: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h2 style={{ fontFamily: theme.fontFamily.heading, fontWeight: 700, fontSize: 18, color: '#1a1a2e', margin: 0 }}>일정 추가</h2>
                    <button onClick={onClose} style={{ ...btnBase, fontSize: 18, color: '#aaa' }}>✕</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                        <label style={{ fontFamily: theme.fontFamily.body, fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>일정 이름</label>
                        <input
                            value={form.eventName}
                            onChange={e => onFormChange({ ...form, eventName: e.target.value })}
                            placeholder="예: 친구 생일파티"
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #eaedf2', fontSize: 14, fontFamily: theme.fontFamily.body, boxSizing: 'border-box', outline: 'none' }}
                        />
                    </div>
                    <div>
                        <label style={{ fontFamily: theme.fontFamily.body, fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>날짜 & 시간</label>
                        <input
                            type="datetime-local"
                            value={form.eventDatetime}
                            onChange={e => onFormChange({ ...form, eventDatetime: e.target.value })}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #eaedf2', fontSize: 14, fontFamily: theme.fontFamily.body, boxSizing: 'border-box', outline: 'none' }}
                        />
                    </div>
                    <div>
                        <label style={{ fontFamily: theme.fontFamily.body, fontSize: 12, color: '#888', display: 'block', marginBottom: 8 }}>TPO</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {TPO_OPTIONS.map(t => (
                                <button key={t} onClick={() => onFormChange({ ...form, tpoKeyword: t })} style={{
                                    padding: '6px 14px', borderRadius: 999, cursor: 'pointer', transition: 'all 0.15s', fontFamily: theme.fontFamily.ui, fontSize: 12,
                                    border: form.tpoKeyword === t ? `2px solid ${TPO_COLORS[t] || '#71b3e5'}` : '1.5px solid #eaedf2',
                                    background: form.tpoKeyword === t ? `${TPO_COLORS[t] || '#71b3e5'}18` : '#f8f9fc',
                                    color: form.tpoKeyword === t ? (TPO_COLORS[t] || '#71b3e5') : '#555',
                                    fontWeight: form.tpoKeyword === t ? 700 : 400,
                                }}>{t}</button>
                            ))}
                        </div>
                    </div>
                    <button onClick={onSubmit} style={{ width: '100%', padding: 13, background: 'linear-gradient(135deg, #71b3e5, #5a9fd4)', border: 'none', borderRadius: 12, color: 'white', fontFamily: theme.fontFamily.ui, fontWeight: 700, fontSize: 15, cursor: 'pointer', marginTop: 4 }}>
                        추가하기
                    </button>
                </div>
            </div>
        </>
    );
}

export default AddEventModal;
