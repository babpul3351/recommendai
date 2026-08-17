import React from 'react';
import { WardrobeIcon, CheckIcon } from '../../components/Icons';
import { PoolEntry } from './types';
import { CAT_COLOR } from './constants';

interface Props {
    outfitPool: PoolEntry[];
    acceptedPoolIdx: number | null;
    accepting: boolean;
    onAccept: (idx: number) => void;
}

function ResultsSection({ outfitPool, acceptedPoolIdx, accepting, onAccept }: Props) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Pool count badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(113,179,229,0.07)', border: '1px solid rgba(113,179,229,0.2)', borderRadius: 12, padding: '10px 16px' }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#71b3e5' }}>총 {outfitPool.length}가지 코디</span>
                {acceptedPoolIdx !== null && (
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#71b3e5', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <CheckIcon color="#71b3e5" size={14} /> 코디 {acceptedPoolIdx + 1} 선택됨
                    </span>
                )}
            </div>

            {/* Outfit cards */}
            {outfitPool.map((entry, poolIdx) => {
                const isAccepted = acceptedPoolIdx === poolIdx;
                const isOtherAccepted = acceptedPoolIdx !== null && !isAccepted;
                const outfit = entry.outfit;
                const slots = [
                    outfit?.top    && { label: '상의',   ...outfit.top },
                    outfit?.bottom && { label: '하의',   ...outfit.bottom },
                    outfit?.outer  && { label: '아우터', ...outfit.outer },
                ].filter(Boolean) as Array<{ label: string; type?: string; color?: string }>;

                return (
                    <div key={poolIdx} style={{
                        background: isAccepted ? 'linear-gradient(135deg, #d4eaf9 0%, #f0f7ff 100%)' : 'white',
                        border: `2px solid ${isAccepted ? '#71b3e5' : '#eaedf2'}`,
                        borderRadius: 20, overflow: 'hidden',
                        opacity: isOtherAccepted ? 0.55 : 1,
                    }}>
                        <div style={{ padding: '20px 22px', borderBottom: '1px solid #eaedf2' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: slots.length > 0 ? 14 : 0 }}>
                                <div style={{ width: 36, height: 36, borderRadius: '50%', background: isAccepted ? 'linear-gradient(135deg, #71b3e5, #5a9fd4)' : '#c8d4dc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: 'white', flexShrink: 0 }}>
                                    {poolIdx + 1}
                                </div>
                                {outfit?.style && (
                                    <span style={{ fontWeight: 700, fontSize: 16, color: isAccepted ? '#1a1a2e' : '#555' }}>{outfit.style}</span>
                                )}
                                {isAccepted && (
                                    <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 11, color: '#71b3e5', background: 'white', border: '1.5px solid #71b3e5', padding: '3px 8px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                        <CheckIcon color="#71b3e5" size={11} /> 선택됨
                                    </span>
                                )}
                            </div>
                            {slots.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {slots.map((s, i) => (
                                        <div key={i} style={{ background: '#f8f9fc', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: CAT_COLOR[s.label] || '#71b3e5', flexShrink: 0 }} />
                                            <div>
                                                <p style={{ fontWeight: 700, fontSize: 10, color: '#aaa', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</p>
                                                <p style={{ fontWeight: 600, fontSize: 13, color: '#1a1a2e', margin: '2px 0 0' }}>{s.type}</p>
                                                {s.color && <p style={{ fontSize: 11, color: '#aaa', margin: '1px 0 0' }}>{s.color}</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div style={{ padding: '16px 22px' }}>
                            {outfit?.description && (
                                <div style={{ background: 'rgba(113,179,229,0.07)', borderLeft: '3px solid #71b3e5', borderRadius: '0 12px 12px 0', padding: '12px 14px', marginBottom: 14 }}>
                                    <p style={{ fontWeight: 600, fontSize: 10, color: '#71b3e5', margin: '0 0 5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>AI 추천 이유</p>
                                    <p style={{ fontWeight: 400, fontSize: 12, color: '#555', lineHeight: 1.7, margin: 0 }}>"{outfit.description}"</p>
                                </div>
                            )}
                            {entry.matchedItems.length > 0 && (
                                <div style={{ marginBottom: 14 }}>
                                    <p style={{ fontWeight: 700, fontSize: 11, color: '#aaa', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>내 옷장 아이템</p>
                                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                        {entry.matchedItems.map((item, i) => (
                                            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 64 }}>
                                                {(item.imageUrl || item.imageB64) ? (
                                                    <img src={item.imageUrl || item.imageB64} alt={item.type} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 10, border: '1px solid #eaedf2' }} />
                                                ) : (
                                                    <div style={{ width: 64, height: 64, borderRadius: 10, background: 'rgba(113,179,229,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <WardrobeIcon color="#71b3e5" size={24} />
                                                    </div>
                                                )}
                                                <span style={{ fontSize: 10, color: '#555', fontWeight: 500, textAlign: 'center', maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.type}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {!isAccepted ? (
                                <button onClick={() => onAccept(poolIdx)} disabled={accepting} style={{
                                    width: '100%', padding: 12,
                                    background: 'linear-gradient(135deg, #71b3e5, #5a9fd4)',
                                    color: 'white', border: 'none', borderRadius: 12, fontSize: 13, cursor: 'pointer',
                                    fontWeight: 700,
                                }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                        {accepting ? '선택 중...' : <><CheckIcon color="white" size={14} /> 이 코디 선택</>}
                                    </span>
                                </button>
                            ) : (
                                <div style={{ padding: 12, background: 'rgba(113,179,229,0.1)', borderRadius: 12, textAlign: 'center' }}>
                                    <span style={{ fontWeight: 700, fontSize: 13, color: '#71b3e5', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                        선택한 코디입니다 <CheckIcon color="#71b3e5" size={14} />
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default ResultsSection;
