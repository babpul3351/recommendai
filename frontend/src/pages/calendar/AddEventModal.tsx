import React, { useEffect, useState } from 'react';
import { theme } from '../../styles/theme';
import { TPO_OPTIONS, TPO_COLORS } from './constants';
import { EventForm } from './types';
import { wardrobeAPI } from '../../api/api';

const btnBase: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

interface OutfitItem {
    id: string;
    imageUrl?: string;
    material?: string;
    category?: string;
}

interface Props {
    form: EventForm;
    onFormChange: (form: EventForm) => void;
    onClose: () => void;
    onSubmit: () => void;
}

function AddEventModal({ form, onFormChange, onClose, onSubmit }: Props) {
    const [savedOutfits, setSavedOutfits] = useState<OutfitItem[]>([]);

    useEffect(() => {
        wardrobeAPI.getWardrobe()
            .then(res => setSavedOutfits(res.data.filter((item: any) => item.category === '저장한 코디')))
            .catch(() => {});
    }, []);

    const selectOutfit = (outfit: OutfitItem | null) => {
        if (!outfit) {
            onFormChange({ ...form, selectedOutfit: null });
            return;
        }
        onFormChange({
            ...form,
            selectedOutfit: { imageUrl: outfit.imageUrl || '', tpo: outfit.material },
            // 코디에 TPO가 있으면 자동으로 채워줌
            tpoKeyword: outfit.material || form.tpoKeyword,
        });
    };

    return (
        <>
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} onClick={onClose} />
            <div style={{
                position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                background: 'white', borderRadius: 20, width: 380, maxWidth: '90vw',
                zIndex: 201, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', padding: 28,
                maxHeight: '90vh', overflowY: 'auto',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h2 style={{ fontWeight: 700, fontSize: 18, color: '#1a1a2e', margin: 0 }}>일정 추가</h2>
                    <button onClick={onClose} style={{ ...btnBase, fontSize: 18, color: '#aaa' }}>✕</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* 일정 이름 */}
                    <div>
                        <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>일정 이름</label>
                        <input
                            value={form.eventName}
                            onChange={e => onFormChange({ ...form, eventName: e.target.value })}
                            placeholder="예: 친구 생일파티"
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #eaedf2', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
                        />
                    </div>

                    {/* 날짜 & 시간 */}
                    <div>
                        <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>날짜 & 시간</label>
                        <input
                            type="datetime-local"
                            value={form.eventDatetime}
                            onChange={e => onFormChange({ ...form, eventDatetime: e.target.value })}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #eaedf2', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
                        />
                    </div>

                    {/* TPO */}
                    <div>
                        <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 8 }}>TPO</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {TPO_OPTIONS.map(t => (
                                <button key={t} onClick={() => onFormChange({ ...form, tpoKeyword: t })} style={{
                                    padding: '6px 14px', borderRadius: 999, cursor: 'pointer', transition: 'all 0.15s', fontSize: 12,
                                    border: form.tpoKeyword === t ? `2px solid ${TPO_COLORS[t] || '#71b3e5'}` : '1.5px solid #eaedf2',
                                    background: form.tpoKeyword === t ? `${TPO_COLORS[t] || '#71b3e5'}18` : '#f8f9fc',
                                    color: form.tpoKeyword === t ? (TPO_COLORS[t] || '#71b3e5') : '#555',
                                    fontWeight: form.tpoKeyword === t ? 700 : 400,
                                }}>{t}</button>
                            ))}
                        </div>
                    </div>

                    {/* 코디 선택 */}
                    <div>
                        <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 8 }}>
                            코디 선택
                            <span style={{ color: '#bbb', fontWeight: 400 }}> (선택사항)</span>
                        </label>
                        {savedOutfits.length === 0 ? (
                            <div style={{
                                padding: '14px 16px', borderRadius: 12, border: '1.5px dashed #eaedf2',
                                background: '#fafbfc', textAlign: 'center',
                            }}>
                                <p style={{ fontSize: 12, color: '#bbb', margin: 0 }}>저장한 코디 세트가 없어요</p>
                                <p style={{ fontSize: 11, color: '#ccc', margin: '4px 0 0' }}>내 코디 탭에서 코디를 만들고 저장해보세요</p>
                            </div>
                        ) : (
                            <>
                                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                                    {/* 없음 */}
                                    <div
                                        onClick={() => selectOutfit(null)}
                                        style={{
                                            flexShrink: 0, width: 96, height: 96, borderRadius: 12,
                                            border: !form.selectedOutfit ? '2px solid #71b3e5' : '1.5px solid #eaedf2',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: 'pointer',
                                            background: !form.selectedOutfit ? '#f0f7fd' : '#f9fafb',
                                            fontSize: 11,
                                            color: !form.selectedOutfit ? '#71b3e5' : '#bbb',
                                            fontWeight: !form.selectedOutfit ? 700 : 400,
                                        }}
                                    >
                                        없음
                                    </div>

                                    {savedOutfits.map((outfit, idx) => {
                                        const isSelected = form.selectedOutfit?.imageUrl === outfit.imageUrl && !!outfit.imageUrl;
                                        return (
                                            <div
                                                key={outfit.id}
                                                onClick={() => selectOutfit(outfit)}
                                                style={{
                                                    flexShrink: 0, width: 96, height: 96, borderRadius: 12,
                                                    border: isSelected ? '2px solid #71b3e5' : '1.5px solid #eaedf2',
                                                    overflow: 'hidden', cursor: 'pointer', position: 'relative',
                                                    boxShadow: isSelected ? '0 0 0 3px rgba(113,179,229,0.25)' : 'none',
                                                    transition: 'box-shadow 0.15s, border-color 0.15s',
                                                }}
                                            >
                                                {outfit.imageUrl ? (
                                                    <img src={outfit.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                                ) : (
                                                    <div style={{ width: '100%', height: '100%', background: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#bbb' }}>
                                                        {idx + 1}
                                                    </div>
                                                )}
                                                {isSelected && (
                                                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(113,179,229,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#71b3e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <span style={{ color: 'white', fontSize: 11, fontWeight: 700 }}>✓</span>
                                                        </div>
                                                    </div>
                                                )}
                                                {outfit.material && (
                                                    <div style={{
                                                        position: 'absolute', bottom: 0, left: 0, right: 0,
                                                        background: 'rgba(0,0,0,0.52)', color: 'white',
                                                        fontSize: 8, padding: '2px 0', textAlign: 'center',
                                                    }}>
                                                        {outfit.material}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                {form.selectedOutfit && (
                                    <p style={{ fontSize: 11, color: '#71b3e5', margin: '6px 0 0' }}>
                                        코디가 선택됐어요{form.selectedOutfit.tpo ? ` · TPO가 '${form.selectedOutfit.tpo}'로 설정됐어요` : ''}
                                    </p>
                                )}
                            </>
                        )}
                    </div>

                    <button onClick={onSubmit} style={{ width: '100%', padding: 13, background: 'linear-gradient(135deg, #71b3e5, #5a9fd4)', border: 'none', borderRadius: 12, color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer', marginTop: 4 }}>
                        추가하기
                    </button>
                </div>
            </div>
        </>
    );
}

export default AddEventModal;
