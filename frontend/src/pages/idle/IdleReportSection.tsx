import React, { useCallback, useEffect, useState } from 'react';
import { idleAPI, wardrobeAPI } from '../../api/api';

/**
 * 마이페이지 > 의류 순환 리포트 > 유휴 의류 분석 박스.
 * - 항상 표시되는 독립 박스. (분석 대상이 없어도 안내 문구 뜸)
 * - 계절을 알 수 없는 옷은 처분을 권유하지 않고 계절 선택만 요청.
 * - 처분 의사(계속 활용/중고거래/기부/정리)는 DB에 기록만 하며 외부 연동은 없는 상태.
 * - "전체 이력 보기"에서 지금까지 기록한 활용 방식과 지정한 계절을 다시 변경 가능.
 */

interface BaseItem {
    id: string;
    category?: string;
    type?: string;
    color?: string;
    imageUrl?: string;
    season?: string | null;
}

interface IdleItem extends BaseItem {
    in_season_days: number;
    decision?: string | null;
    reSuggest?: boolean;
    keepCount?: number;
    listingTitle?: string | null;
    listingBody?: string | null;
}

interface IdleResponse {
    idleItems: IdleItem[];
    needsSeasonItems: IdleItem[];
    thresholdDays: number;
    snoozeDays: number;
}

interface HistoryDecision extends BaseItem {
    decision: string;
    keepCount: number;
    decidedAt: string;
    listingTitle?: string | null;
    listingBody?: string | null;
}

interface HistoryResponse {
    decisions: HistoryDecision[];
    seasons: BaseItem[];
    snoozeDays: number;
}

const DECISIONS: { value: string; label: string }[] = [
    { value: 'KEEP', label: '계속 활용' },
    { value: 'RESELL', label: '중고거래' },
    { value: 'DONATE', label: '기부' },
    { value: 'DISCARD', label: '정리' },
];

const SEASONS: { value: string; label: string }[] = [
    { value: 'summer', label: '여름' },
    { value: 'mid', label: '간절기' },
    { value: 'winter', label: '겨울' },
    { value: 'all', label: '사계절' },
];

const decisionLabel = (v: string) => DECISIONS.find(d => d.value === v)?.label || v;
const seasonLabel = (v?: string | null) => SEASONS.find(s => s.value === v)?.label || '자동 분류';

const card: React.CSSProperties = { background: 'white', borderRadius: 16, padding: 20, border: '1px solid #eaedf2', marginBottom: 16 };
const h3: React.CSSProperties = { fontWeight: 700, fontSize: 15, color: '#1a1a2e', margin: 0 };
const sub: React.CSSProperties = { fontWeight: 600, fontSize: 13, color: '#555', margin: '0 0 10px' };
const note: React.CSSProperties = { fontSize: 12, color: '#888', margin: 0, lineHeight: 1.5 };
const chip = (active: boolean): React.CSSProperties => ({
    background: active ? 'linear-gradient(135deg, #71b3e5, #5a9fd4)' : 'white',
    border: active ? 'none' : '1px solid #eaedf2',
    borderRadius: 8, padding: '6px 12px', fontSize: 12,
    fontWeight: active ? 600 : 400, color: active ? 'white' : '#555', cursor: 'pointer',
});

function Thumb({ url }: { url?: string }) {
    return (
        <div style={{ width: 56, height: 56, borderRadius: 10, background: '#f0f2f5', overflow: 'hidden', flexShrink: 0 }}>
            {url && <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        </div>
    );
}

/** 중고거래 판매글 초안 입력/표시. 아는 정보만 입력하게 하고 가격은 추천하지 않습니다. */
function ResalePanel(props: {
    itemId: string;
    listingTitle?: string | null;
    listingBody?: string | null;
    onChanged: () => void;
    onError: (msg: string) => void;
}) {
    const { itemId, listingTitle, listingBody, onChanged, onError } = props;
    const [extra, setExtra] = useState({ brand: '', size: '', condition: '', price: '' });
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(false);
    const [draft, setDraft] = useState<{ title: string; body: string } | null>(
        listingTitle && listingBody ? { title: listingTitle, body: listingBody } : null);

    const make = async () => {
        setBusy(true);
        try {
            const res = await idleAPI.resaleDraft(itemId, extra);
            setDraft({ title: res.data.title, body: res.data.body });
            onChanged();
        } catch {
            onError('판매글 초안을 만들지 못했어요.');
        } finally {
            setBusy(false);
        }
    };

    const copy = async () => {
        if (!draft) return;
        try {
            await navigator.clipboard.writeText(`${draft.title}\n\n${draft.body}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            onError('복사하지 못했어요. 글을 직접 선택해서 복사해주세요.');
        }
    };

    return (
        <div style={{ background: '#f8f9fc', borderRadius: 12, padding: 14, marginTop: 10 }}>
            <p style={{ ...note, marginBottom: 10 }}>
                아는 정보만 입력하세요. 비워 둔 항목은 [브랜드]처럼 빈칸으로 남아요. 가격은 추천하지 않아요.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {([['brand', '브랜드'], ['size', '사이즈'], ['condition', '사용감'], ['price', '희망가격']] as const).map(([k, label]) => (
                    <input
                        key={k}
                        value={extra[k]}
                        onChange={e => setExtra({ ...extra, [k]: e.target.value })}
                        placeholder={label}
                        style={{ border: '1px solid #eaedf2', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none' }}
                    />
                ))}
            </div>
            <button disabled={busy} onClick={make} style={{ ...chip(true), marginTop: 10, opacity: busy ? 0.6 : 1 }}>
                {draft ? '초안 다시 만들기' : '판매글 초안 만들기'}
            </button>
            {draft && (
                <div style={{ marginTop: 12 }}>
                    <p style={{ fontWeight: 700, fontSize: 13, color: '#1a1a2e', margin: '0 0 6px' }}>{draft.title}</p>
                    <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 12, color: '#555', margin: 0, lineHeight: 1.6 }}>{draft.body}</pre>
                    <button onClick={copy} style={{ ...chip(false), marginTop: 10 }}>{copied ? '복사했어요' : '제목과 본문 복사'}</button>
                </div>
            )}
        </div>
    );
}

/** 활용 방식 선택 버튼 + (중고거래 선택 시) 판매글 패널 */
function DecisionControls(props: {
    itemId: string;
    current?: string | null;
    listingTitle?: string | null;
    listingBody?: string | null;
    busy: boolean;
    onDecide: (itemId: string, decision: string) => void;
    onChanged: () => void;
    onError: (msg: string) => void;
}) {
    const { itemId, current, listingTitle, listingBody, busy, onDecide, onChanged, onError } = props;
    const [resaleOpen, setResaleOpen] = useState(current === 'RESELL');
    return (
        <>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                {DECISIONS.map(d => (
                    <button
                        key={d.value}
                        disabled={busy}
                        onClick={() => (d.value === 'RESELL' ? setResaleOpen(true) : onDecide(itemId, d.value))}
                        style={chip(current === d.value || (d.value === 'RESELL' && resaleOpen && !current))}
                    >
                        {d.label}
                    </button>
                ))}
            </div>
            {resaleOpen && (
                <ResalePanel itemId={itemId} listingTitle={listingTitle} listingBody={listingBody} onChanged={onChanged} onError={onError} />
            )}
        </>
    );
}

function SeasonButtons(props: { itemId: string; current?: string | null; busy: boolean; withAuto?: boolean; onSet: (id: string, season: string) => void }) {
    const { itemId, current, busy, withAuto, onSet } = props;
    return (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SEASONS.map(s => (
                <button key={s.value} disabled={busy} onClick={() => onSet(itemId, s.value)} style={chip(current === s.value)}>{s.label}</button>
            ))}
            {withAuto && (
                <button disabled={busy} onClick={() => onSet(itemId, '')} style={chip(false)}>자동 분류로 되돌리기</button>
            )}
        </div>
    );
}

export default function IdleReportSection() {
    const [data, setData] = useState<IdleResponse | null>(null);
    const [history, setHistory] = useState<HistoryResponse | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busyId, setBusyId] = useState<string | null>(null);

    const loadItems = useCallback(async () => {
        try {
            const res = await idleAPI.getItems();
            setData(res.data);
            setError('');
        } catch {
            setError('유휴 의류 분석을 불러오지 못했어요.');
        } finally {
            setLoading(false);
        }
    }, []);

    const loadHistory = useCallback(async () => {
        try {
            const res = await idleAPI.getHistory();
            setHistory(res.data);
        } catch {
            setError('이력을 불러오지 못했어요.');
        }
    }, []);

    useEffect(() => { loadItems(); }, [loadItems]);
    useEffect(() => { if (showHistory) loadHistory(); }, [showHistory, loadHistory]);

    const refreshAll = useCallback(async () => {
        await loadItems();
        if (showHistory) await loadHistory();
    }, [loadItems, loadHistory, showHistory]);

    const decide = async (itemId: string, decision: string) => {
        setBusyId(itemId);
        try {
            await idleAPI.decide(itemId, decision);
            await refreshAll();
        } catch {
            setError('저장하지 못했어요. 잠시 후 다시 시도해주세요.');
        } finally {
            setBusyId(null);
        }
    };

    const setSeason = async (itemId: string, season: string) => {
        setBusyId(itemId);
        try {
            await wardrobeAPI.updateItem(itemId, { season });
            await refreshAll();
        } catch {
            setError('계절을 저장하지 못했어요.');
        } finally {
            setBusyId(null);
        }
    };

    const needsSeason = data?.needsSeasonItems ?? [];
    const idleItems = data?.idleItems ?? [];
    const thresholdDays = data?.thresholdDays ?? 60;
    const snoozeDays = data?.snoozeDays ?? 90;

    return (
        <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                <div>
                    <h3 style={h3}>유휴 의류 분석</h3>
                    <p style={{ ...note, marginTop: 6 }}>
                        입을 수 있는 계절 안에서 {thresholdDays}일 이상 코디로 선택한 기록이 없는 옷을 찾아요.
                        앱에 기록되지 않은 착용은 반영되지 않을 수 있어요.
                    </p>
                </div>
                <button onClick={() => setShowHistory(v => !v)} style={{ ...chip(showHistory), flexShrink: 0 }}>
                    {showHistory ? '이력 닫기' : '전체 이력 보기'}
                </button>
            </div>

            {error && <p style={{ fontSize: 13, color: '#e74c3c', margin: '0 0 12px' }}>{error}</p>}

            {loading ? (
                <p style={{ ...note, padding: '12px 0' }}>불러오는 중...</p>
            ) : (
                <>
                    {needsSeason.length > 0 && (
                        <div style={{ marginBottom: 18 }}>
                            <p style={sub}>계절 확인이 필요한 옷 ({needsSeason.length})</p>
                            <p style={{ ...note, marginBottom: 12 }}>
                                이름만으로 계절을 알 수 없어요. 계절을 알려주시면 정확히 분석할 수 있어요.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {needsSeason.map(item => (
                                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: busyId === item.id ? 0.6 : 1 }}>
                                        <Thumb url={item.imageUrl} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ fontWeight: 600, fontSize: 13, color: '#1a1a2e', margin: '0 0 8px' }}>{item.type || item.category}</p>
                                            <SeasonButtons itemId={item.id} busy={busyId === item.id} onSet={setSeason} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {idleItems.length > 0 && (
                        <div style={{ marginBottom: 6 }}>
                            <p style={sub}>오래 입지 않은 옷 ({idleItems.length})</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {idleItems.map(item => (
                                    <div key={item.id} style={{ borderTop: '1px solid #f0f2f5', paddingTop: 14, opacity: busyId === item.id ? 0.6 : 1 }}>
                                        <div style={{ display: 'flex', gap: 12 }}>
                                            <Thumb url={item.imageUrl} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ fontWeight: 600, fontSize: 14, color: '#1a1a2e', margin: '0 0 4px' }}>
                                                    {item.type || item.category}
                                                    <span style={{ fontWeight: 400, fontSize: 12, color: '#aaa', marginLeft: 8 }}>{item.color} · {item.season}</span>
                                                </p>
                                                <p style={note}>{item.in_season_days}일째 코디로 선택한 기록이 없어요</p>
                                                {item.reSuggest && (
                                                    <p style={{ ...note, color: '#E8832A', marginTop: 6 }}>
                                                        계속 활용하기로 했지만 다시 유휴 의류로 분석됐어요. 이제 정리해보는 건 어떨까요?
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <DecisionControls
                                            itemId={item.id}
                                            current={item.decision}
                                            listingTitle={item.listingTitle}
                                            listingBody={item.listingBody}
                                            busy={busyId === item.id}
                                            onDecide={decide}
                                            onChanged={refreshAll}
                                            onError={setError}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {needsSeason.length === 0 && idleItems.length === 0 && (
                        <p style={{ ...note, padding: '8px 0 4px' }}>
                            지금 정리를 고민해 볼 만한 옷이 없어요. 계절 안에서 {thresholdDays}일 이상 코디로 선택한 기록이 없는 옷이 생기면 여기에 알려드려요.
                            활용하기로 한 옷은 {snoozeDays}일 동안 숨겨져요. 이전에 선택한 내용은 &lsquo;전체 이력 보기&rsquo;에서 바꿀 수 있어요.
                        </p>
                    )}
                </>
            )}

            {showHistory && (
                <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid #eaedf2' }}>
                    {!history ? (
                        <p style={note}>이력을 불러오는 중...</p>
                    ) : (
                        <>
                            <p style={sub}>내가 선택한 활용 방식 ({history.decisions.length})</p>
                            {history.decisions.length === 0 ? (
                                <p style={{ ...note, marginBottom: 18 }}>아직 선택한 기록이 없어요.</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
                                    {history.decisions.map(d => {
                                        const decided = new Date(d.decidedAt);
                                        const until = new Date(decided.getTime() + history.snoozeDays * 86400000);
                                        return (
                                            <div key={d.id} style={{ opacity: busyId === d.id ? 0.6 : 1 }}>
                                                <div style={{ display: 'flex', gap: 12 }}>
                                                    <Thumb url={d.imageUrl} />
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <p style={{ fontWeight: 600, fontSize: 13, color: '#1a1a2e', margin: '0 0 4px' }}>{d.type || d.category}</p>
                                                        <p style={note}>
                                                            {decisionLabel(d.decision)} · {decided.toLocaleDateString('ko-KR')}에 선택
                                                            {d.decision === 'KEEP' && ` · ${until.toLocaleDateString('ko-KR')}까지 목록에서 숨김`}
                                                            {d.keepCount > 0 && ` · 계속 활용 ${d.keepCount}회`}
                                                        </p>
                                                    </div>
                                                </div>
                                                <DecisionControls
                                                    itemId={d.id}
                                                    current={d.decision}
                                                    listingTitle={d.listingTitle}
                                                    listingBody={d.listingBody}
                                                    busy={busyId === d.id}
                                                    onDecide={decide}
                                                    onChanged={refreshAll}
                                                    onError={setError}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <p style={sub}>내가 지정한 계절 ({history.seasons.length})</p>
                            <p style={{ ...note, marginBottom: 10 }}>변경한 시각은 저장되지 않고 현재 지정된 값만 보여요.</p>
                            {history.seasons.length === 0 ? (
                                <p style={note}>직접 계절을 지정한 옷이 없어요.</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    {history.seasons.map(s => (
                                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: busyId === s.id ? 0.6 : 1 }}>
                                            <Thumb url={s.imageUrl} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ fontWeight: 600, fontSize: 13, color: '#1a1a2e', margin: '0 0 8px' }}>
                                                    {s.type || s.category}
                                                    <span style={{ fontWeight: 400, fontSize: 12, color: '#aaa', marginLeft: 8 }}>현재: {seasonLabel(s.season)}</span>
                                                </p>
                                                <SeasonButtons itemId={s.id} current={s.season} busy={busyId === s.id} withAuto onSet={setSeason} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}