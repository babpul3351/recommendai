import React from 'react';
import { CalendarIcon, WardrobeIcon, RefreshIcon, CheckIcon, ThermometerIcon, ClockIcon } from '../../components/Icons';
import { HistoryRecord, OutfitInfoH } from './types';
import { TPO_COLORS, CAT_COLOR, WEEKDAYS } from './constants';

interface Props {
    history: HistoryRecord[];
    onChangeAccept: (recId: number, outfitIndex: number, info?: OutfitInfoH) => void;
}

function formatOutfitDate(dateStr: string): string {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return `${m}월 ${d}일 (${WEEKDAYS[dt.getDay()]})`;
}

function RightPanel({ history, onChangeAccept }: Props) {
    if (history.length === 0) {
        return (
            <div style={{ background: 'white', borderRadius: 20, border: '1px solid #eaedf2', padding: '48px 32px', textAlign: 'center' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(113,179,229,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <ClockIcon color="#71b3e5" size={24} />
                </div>
                <p style={{ fontWeight: 600, fontSize: 15, color: '#1a1a2e', margin: '0 0 8px' }}>아직 추천 기록이 없어요</p>
                <p style={{ fontSize: 13, color: '#bbb', margin: 0 }}>코디를 추천받으면 여기에 기록돼요</p>
            </div>
        );
    }

    return (
        <div>
            <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontWeight: 700, fontSize: 20, color: '#1a1a2e', margin: '0 0 4px' }}>지난 추천 코디</h2>
                <p style={{ fontWeight: 400, fontSize: 13, color: '#888', margin: 0 }}>이전에 추천받은 코디를 확인하고 변경할 수 있어요 ({history.length}건)</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {history.map((rec, i) => (
                    <div key={rec.recId || i} style={{ background: 'white', borderRadius: 20, overflow: 'hidden', border: '1px solid #eaedf2' }}>
                        <div style={{ padding: '16px 20px 14px', background: `linear-gradient(135deg, ${TPO_COLORS[rec.tpo] || '#71b3e5'}DD, ${TPO_COLORS[rec.tpo] || '#71b3e5'}88)` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 12, fontWeight: 800, color: 'white', background: 'rgba(255,255,255,0.25)', padding: '4px 12px', borderRadius: 20 }}>{rec.tpo}</span>
                                {!!rec.retryCount && rec.retryCount > 0 && (
                                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.9)', background: 'rgba(255,255,255,0.18)', padding: '3px 9px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                        <RefreshIcon color="rgba(255,255,255,0.9)" size={10} /> 재추천 {rec.retryCount}회
                                    </span>
                                )}
                                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginLeft: 'auto' }}>
                                    {new Date(rec.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontSize: 17, fontWeight: 800, color: 'white', letterSpacing: '-0.3px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    {rec.outfitDate && <CalendarIcon color="white" size={16} />}
                                    {rec.outfitDate ? `${formatOutfitDate(rec.outfitDate)} 코디` : '코디 추천'}
                                </span>
                                {rec.temperature && (
                                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', background: 'rgba(255,255,255,0.18)', padding: '4px 10px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                        <ThermometerIcon color="rgba(255,255,255,0.9)" size={11} /> {rec.temperature}°C · {rec.weatherCondition}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div style={{ padding: '14px 20px 18px' }}>
                            {rec.description && (
                                <p style={{ fontSize: 12, color: '#888', lineHeight: 1.65, margin: '0 0 12px', fontStyle: 'italic', paddingLeft: 10, borderLeft: '2px solid rgba(113,179,229,0.3)' }}>"{rec.description}"</p>
                            )}
                            {rec.allOutfitGroups && Object.keys(rec.allOutfitGroups).length > 0 ? (
                                Object.entries(rec.allOutfitGroups).map(([idxStr, items]) => {
                                    const idx = parseInt(idxStr);
                                    const isAccepted = rec.acceptedOutfitIndex === idx;
                                    const info = rec.outfitInfos?.[idx];
                                    return (
                                        <div key={idx} style={{ borderRadius: 14, padding: '12px 14px', marginBottom: 10, background: isAccepted ? 'rgba(113,179,229,0.07)' : '#f8f9fc', borderLeft: isAccepted ? '3px solid #71b3e5' : '3px solid #eaedf2' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span style={{ width: 24, height: 24, borderRadius: '50%', background: isAccepted ? '#71b3e5' : '#B0BEC5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: 'white', flexShrink: 0 }}>{idx + 1}</span>
                                                    {info?.style && (
                                                        <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, color: isAccepted ? '#71b3e5' : '#607D8B', background: isAccepted ? 'white' : '#EEF2F5', border: isAccepted ? '1px solid rgba(113,179,229,0.3)' : '1px solid #DDE3E9' }}>{info.style}</span>
                                                    )}
                                                </div>
                                                {isAccepted && (
                                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#71b3e5', background: 'white', padding: '4px 12px', borderRadius: 20, border: '1.5px solid #71b3e5', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                        <CheckIcon color="#71b3e5" size={11} /> 선택됨
                                                    </span>
                                                )}
                                            </div>
                                            {items.length > 0 ? (
                                                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                                    {items.map((item, ii) => (
                                                        <div key={ii} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 70 }}>
                                                            {item.imageUrl
                                                                ? <img src={item.imageUrl} alt={item.type} style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: 12, border: '2px solid rgba(255,255,255,0.9)', boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }} />
                                                                : <div style={{ width: 70, height: 70, borderRadius: 12, background: 'rgba(113,179,229,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><WardrobeIcon color="#71b3e5" size={26} /></div>
                                                            }
                                                            <span style={{ fontSize: 9, fontWeight: 700, color: 'white', padding: '2px 6px', borderRadius: 5, background: CAT_COLOR[item.category || ''] || '#71b3e5' }}>{item.category}</span>
                                                            <p style={{ fontSize: 10, color: '#1a1a2e', fontWeight: 500, margin: 0, textAlign: 'center', maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.type}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p style={{ fontSize: 11, color: '#aaa', margin: 0, padding: '6px 0' }}>매칭 아이템 없음</p>
                                            )}
                                            {!isAccepted && (
                                                <button onClick={() => onChangeAccept(rec.recId, idx, info)} style={{ marginTop: 12, width: '100%', padding: 10, background: 'white', border: '1.5px solid #71b3e5', borderRadius: 10, fontSize: 13, fontWeight: 700, color: '#71b3e5', cursor: 'pointer' }}>
                                                    이 코디로 변경하기
                                                </button>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <p style={{ fontSize: 12, color: '#aaa', textAlign: 'center', padding: '16px 0' }}>코디 정보 없음</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default RightPanel;
