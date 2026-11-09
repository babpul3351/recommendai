// src/components/ColorMoodboardSection.tsx  (v3, 2026-11-09)
//
// 색상 보정 뷰어 결과 화면. 색각 이상 사용자가 "색을 읽을 수 있게" 하는 것을 우선으로 구성.
//   ResultNav  : 결과 바로가기(보정 비교 / 이 옷의 색 / 옷장에서 찾기 / 무드보드) + 실제 색·보정 색 전환 (페이지 상단에 고정)
//   1. 이 옷의 색   : 색 이름, 계산한 색 설명(계열·밝기·채도·온도감), Gemini 느낌 문장, 사진 속 헷갈림 경고
//   2. 옷장에서 찾기 : 기준 색 선택 -> 같은 색·비슷한 색 / 비슷해 보이지만 다른 색(색각 이상 시) / 같은 색 계열
//   3. 무드보드     : Gemini 장면 4개 + 코디 팁 (보조 정보라 맨 아래)
//
// 접근성 원칙
//   - 색만으로 정보를 전달하지 않음: 모든 색에 이름과 hex, 모든 배지에 아이콘 + 글자
//   - 배지 색은 파랑/주황/회색만 사용 (빨강-초록 구분에 의존하지 않음)
//   - 글자 대비 4.5:1 이상 (WCAG AA 기준으로 계산한 색만 사용), 키보드 포커스 표시, 움직임 줄이기 설정 존중

import React, { useEffect, useMemo, useState } from 'react';
import { Palette, Shirt, Lightbulb, Info, AlertTriangle, CheckCircle2, CircleDot, Layers, Sparkles } from 'lucide-react';
import {
    colorAssistantAPI,
    MoodboardResponse, MoodboardPaletteColor, ColorMatchResult, ColorMatchItem, ColorConfusionItem, ColorFamilyItem,
} from '../api/api';
import DaltonizedImage from './DaltonizedImage';
import type { ColorType } from '../daltonization';

export type ColorView = 'real' | 'corrected';

// 앱 공통 색(theme.ts의 하늘색 #71B3E5, 기존 페이지의 #5a9fd4 그라데이션, #eaedf2 테두리)을 그대로 쓰고,
// 글자 대비만 보완. 대비는 계산으로 확인 (흰 배경 기준: text 16:1, sub 7.6:1, muted 4.8:1, brandText 5.7:1)
export const CC = {
    text: '#1a1a2e',
    sub: '#475569',
    muted: '#64748b',
    border: '#eaedf2',
    soft: '#f5f7fa',
    brand: '#71b3e5',                                         // 앱 주 색. 채우기/선/막대에 사용
    brandFill: 'linear-gradient(135deg, #71b3e5, #5a9fd4)',   // 기존 페이지 주 버튼과 같은 그라데이션
    onBrand: '#0f2a44',     // 하늘색 채우기 위 글자 (흰 글자는 대비 2.3~2.9:1이라 진한 남색 글자 사용, 6.5:1)
    brandText: '#2b6a9e',   // 흰 배경 위 하늘색 계열 글자/아이콘 (같은 색상에서 밝기만 낮춤, 5.7:1)
    blueBg: '#eaf4fc', blueText: '#2b6a9e',
    warnBg: '#fff3e6', warnText: '#9a3412', warnBorder: '#fdc89a',
    grayBg: '#eef2f6', grayText: '#334155',
};

const card: React.CSSProperties = {
    background: 'white', borderRadius: 20, padding: '26px 28px', border: `1px solid ${CC.border}`, marginBottom: 20,
    scrollMarginTop: 90,
};

const PAGE_CSS = `
.cc-scope button:focus-visible, .cc-scope a:focus-visible, .cc-scope [tabindex]:focus-visible { outline: 3px solid #2b6a9e; outline-offset: 2px; }
@keyframes ccShimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
.cc-skel { background: linear-gradient(90deg, #eef1f5 0px, #f7f9fb 160px, #eef1f5 320px); background-size: 800px 100%; animation: ccShimmer 1.3s linear infinite; }
@media (prefers-reduced-motion: reduce) { .cc-skel { animation: none; } .cc-scope * { scroll-behavior: auto !important; transition: none !important; } }
`;
export const CcStyle = () => <style>{PAGE_CSS}</style>;

// ── 색 유틸 ──────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function mix(hex: string, target: [number, number, number], t: number): string {
    const [r, g, b] = hexToRgb(hex);
    const m = (a: number, z: number) => Math.round(a + (z - a) * t).toString(16).padStart(2, '0');
    return `#${m(r, target[0])}${m(g, target[1])}${m(b, target[2])}`;
}
function isLight(hex: string): boolean {
    const [r, g, b] = hexToRgb(hex);
    return 0.299 * r + 0.587 * g + 0.114 * b > 200;
}
function tileBackground(colors: string[]): string {
    if (colors.length === 0) return '#e5e7eb';
    if (colors.length === 1) {
        const c = colors[0];
        return `radial-gradient(130% 100% at 25% 15%, ${mix(c, [255, 255, 255], 0.22)} 0%, ${c} 55%, ${mix(c, [0, 0, 0], 0.28)} 100%)`;
    }
    return `linear-gradient(140deg, ${colors.map((c, i) => `${c} ${Math.round((i / (colors.length - 1)) * 100)}%`).join(', ')})`;
}
const pick = (view: ColorView, hex: string, corrected?: string | null) => (view === 'corrected' && corrected ? corrected : hex);

// ── 공통 UI ──────────────────────────────────
function Swatch({ hex, size = 44, label }: { hex: string; size?: number; label: string }) {
    return (
        <div role="img" aria-label={label} title={label} style={{
            width: size, height: size, borderRadius: '50%', background: hex, flexShrink: 0,
            border: `1px solid ${isLight(hex) ? '#cbd5e1' : 'rgba(0,0,0,0.08)'}`,
            boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.35), 0 2px 6px rgba(26,26,46,0.08)',
        }} />
    );
}

function CardTitle({ icon, title, desc }: { icon: React.ReactNode; title: string; desc?: string }) {
    return (
        <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span aria-hidden style={{ width: 34, height: 34, borderRadius: 10, background: CC.blueBg, color: CC.brandText, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
                <h2 style={{ fontWeight: 700, fontSize: 19, color: CC.text, margin: 0, letterSpacing: '-0.3px' }}>{title}</h2>
            </div>
            {desc && <p style={{ fontSize: 13.5, color: CC.sub, margin: '8px 0 0 44px', lineHeight: 1.6, wordBreak: 'keep-all' }}>{desc}</p>}
        </div>
    );
}

type BadgeKind = 'same' | 'similar' | 'family' | 'confuse';
const BADGE: Record<BadgeKind, { text: string; fg: string; bg: string; Icon: React.ComponentType<{ size?: number }> }> = {
    same: { text: '거의 같은 색', fg: CC.blueText, bg: CC.blueBg, Icon: CheckCircle2 },
    similar: { text: '비슷한 색', fg: CC.blueText, bg: '#f3f9fe', Icon: CircleDot },
    family: { text: '같은 계열', fg: CC.grayText, bg: CC.grayBg, Icon: Layers },
    confuse: { text: '헷갈림 주의', fg: CC.warnText, bg: CC.warnBg, Icon: AlertTriangle },
};
function Badge({ kind }: { kind: BadgeKind }) {
    const b = BADGE[kind];
    return (
        <span style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, padding: '3px 9px 3px 7px', borderRadius: 999, color: b.fg, background: b.bg }}>
            <b.Icon size={13} />{b.text}
        </span>
    );
}

function ViewTag({ view }: { view: ColorView }) {
    return (
        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 999, color: view === 'real' ? CC.grayText : CC.blueText, background: view === 'real' ? CC.grayBg : CC.blueBg }}>
            {view === 'real' ? '실제 색' : '보정 색'}
        </span>
    );
}

// ── 결과 바로가기 + 실제/보정 전환 (페이지에서 사용) ──
export function ResultNav({ view, setView, canCorrect, colorTypeLabel }: {
    view: ColorView; setView: (v: ColorView) => void; canCorrect: boolean; colorTypeLabel: string;
}) {
    const links = [['cc-compare', '보정 비교'], ['cc-colors', '이 옷의 색'], ['cc-wardrobe', '옷장에서 찾기'], ['cc-mood', '무드보드']];
    const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return (
        <nav aria-label="결과 바로가기" style={{
            position: 'sticky', top: 12, zIndex: 5, marginBottom: 16, background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(6px)',
            border: `1px solid ${CC.border}`, borderRadius: 16, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
            boxShadow: '0 4px 16px rgba(26,26,46,0.06)',
        }}>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: '1 1 auto' }}>
                {links.map(([id, label]) => (
                    <button key={id} onClick={() => go(id)} style={{ background: 'transparent', border: 'none', borderRadius: 10, padding: '7px 12px', fontSize: 13.5, fontWeight: 600, color: CC.sub, cursor: 'pointer' }}>{label}</button>
                ))}
            </div>
            {canCorrect && (
                <div role="group" aria-label="색 표시 방식" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12.5, color: CC.sub }}>색 표시</span>
                    <div style={{ display: 'flex', gap: 3, background: '#f0f2f5', borderRadius: 11, padding: 3 }}>
                        {(['real', 'corrected'] as ColorView[]).map(v => {
                            const active = view === v;
                            return (
                                <button key={v} aria-pressed={active} onClick={() => setView(v)} title={v === 'real' ? '옷의 실제 색 (다른 사람이 보는 색과 같음)' : `${colorTypeLabel || '내 색각'} 기준으로 구분하기 쉽게 바꾼 색 (보정 이미지와 같은 방식)`} style={{
                                    border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: 'pointer',
                                    fontWeight: active ? 700 : 500, color: active ? CC.text : CC.sub, background: active ? 'white' : 'transparent',
                                    boxShadow: active ? '0 1px 6px rgba(0,0,0,0.08)' : 'none',
                                }}>{v === 'real' ? '실제 색' : '보정 색'}</button>
                            );
                        })}
                    </div>
                </div>
            )}
        </nav>
    );
}

// ── 로딩 / 오류 ─────────────────────────────
function LoadingCard() {
    return (
        <div style={card} aria-busy="true" aria-live="polite">
            <CardTitle icon={<Palette size={18} />} title="사진의 색을 읽고 있어요" desc="옷 영역을 찾고, 색을 뽑고, 설명을 만드는 중이에요. 보통 몇 초에서 수십 초 걸려요." />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 14 }}>
                {[0, 1, 2, 3].map(i => (
                    <div key={i}>
                        <div className="cc-skel" style={{ aspectRatio: '1 / 1', borderRadius: 16 }} />
                        <div className="cc-skel" style={{ height: 14, borderRadius: 6, marginTop: 10, width: '70%' }} />
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── 1. 이 옷의 색 ────────────────────────────
function ColorsCard({ data, view }: { data: MoodboardResponse; view: ColorView }) {
    const garment = data.palette.filter(p => p.isGarment);
    const excluded = data.palette.filter(p => !p.isGarment);
    const total = garment.reduce((s, p) => s + p.ratio, 0) || 1;
    const byIndex = useMemo(() => new Map(data.palette.map(p => [p.index, p])), [data.palette]);

    return (
        <section id="cc-colors" style={card} aria-labelledby="cc-colors-title">
            <CardTitle icon={<Palette size={18} />} title="이 옷의 색" desc={[data.garment, data.summary].filter(Boolean).join(' · ') || undefined} />

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {garment.map(p => <ColorRow key={p.index} p={p} share={p.ratio / total} view={view} />)}
            </ul>

            {data.photoConfusions.length > 0 && (
                <div role="note" style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'flex-start', background: CC.warnBg, border: `1px solid ${CC.warnBorder}`, borderRadius: 14, padding: '14px 16px' }}>
                    <AlertTriangle size={18} color={CC.warnText} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden />
                    <div style={{ fontSize: 14, color: CC.text, lineHeight: 1.6 }}>
                        <p style={{ margin: '0 0 2px', fontWeight: 700, color: CC.warnText }}>이 사진 안에서 헷갈릴 수 있는 색</p>
                        {data.photoConfusions.map((c, i) => {
                            const a = byIndex.get(c.a), b = byIndex.get(c.b);
                            if (!a || !b) return null;
                            return (
                                <p key={i} style={{ margin: 0, wordBreak: 'keep-all' }}>
                                    <strong>{a.name}</strong>와(과) <strong>{b.name}</strong>은(는) 실제로는 다른 색(차이 {c.deltaE})이지만, {data.colorTypeLabel || '내 색각'} 기준으로는 비슷하게(차이 {c.seenDeltaE}) 보일 수 있어요.
                                </p>
                            );
                        })}
                    </div>
                </div>
            )}

            {excluded.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                    <span style={{ fontSize: 12.5, color: CC.muted }}>배경·피부로 보고 제외한 색</span>
                    {excluded.map(p => (
                        <span key={p.index} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: CC.sub, background: CC.soft, padding: '3px 10px 3px 4px', borderRadius: 999 }}>
                            <Swatch hex={pick(view, p.hex, p.correctedHex)} size={16} label={`${p.name} ${p.hex}`} />{p.name}
                        </span>
                    ))}
                </div>
            )}
            <p style={{ fontSize: 12.5, color: CC.muted, margin: '14px 0 0' }}>
                색 설명(계열 · 밝기 · 채도 · 온도감)과 비율은 사진 픽셀에서 계산한 실제 색 기준이에요.{data.moodSource === 'fallback' && ' AI 설명을 만들지 못해 색 이름은 가장 가까운 기본 이름으로 표시했어요.'}
            </p>
        </section>
    );
}

function ColorRow({ p, share, view }: { p: MoodboardPaletteColor; share: number; view: ColorView }) {
    const hex = pick(view, p.hex, p.correctedHex);
    const pct = Math.round(share * 100);
    return (
        <li style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', padding: '14px 16px', borderRadius: 16, background: CC.soft }}>
            <Swatch hex={hex} size={56} label={`${p.name}, ${view === 'real' ? '실제 색' : '보정 색'} ${hex}`} />
            <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 16, color: CC.text }}>{p.name}</span>
                    <ViewTag view={view} />
                    <span style={{ fontSize: 12.5, color: CC.muted, fontFamily: 'monospace' }}>{hex}</span>
                </div>
                <p style={{ fontSize: 14, color: CC.text, margin: '4px 0 0', lineHeight: 1.5, wordBreak: 'keep-all' }}>{p.description.text}</p>
                {p.feeling && <p style={{ fontSize: 13.5, color: CC.sub, margin: '2px 0 0', lineHeight: 1.5, wordBreak: 'keep-all' }}>{p.feeling}</p>}
            </div>
            <div style={{ width: 72, flexShrink: 0, textAlign: 'right', marginLeft: 'auto' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: CC.text }}>{pct}%</span>
                <div aria-hidden style={{ height: 6, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden', marginTop: 4 }}>
                    <div style={{ width: `${Math.max(4, pct)}%`, height: '100%', background: CC.brand }} />
                </div>
                <span style={{ fontSize: 11.5, color: CC.muted }}>옷 색 중</span>
            </div>
        </li>
    );
}

// ── 2. 옷장에서 찾기 ─────────────────────────
function WardrobeCard({ data, view, colorType }: { data: MoodboardResponse; view: ColorView; colorType: string }) {
    const garment = data.palette.filter(p => p.isGarment);
    const total = garment.reduce((s, p) => s + p.ratio, 0) || 1;
    const [baseIndex, setBaseIndex] = useState<number>(data.baseIndex);
    const [match, setMatch] = useState<ColorMatchResult | null>(data.match ?? null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const base = data.palette.find(p => p.index === baseIndex) ?? garment[0];

    const fetchMatch = async (hex: string) => {
        setLoading(true);
        setError(null);
        try {
            setMatch((await colorAssistantAPI.matchColor(hex)).data);
        } catch {
            setError('옷장에서 색을 찾지 못했어요. 잠시 후 다시 시도해 주세요.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!match && base) fetchMatch(base.hex);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 옷장 색 계산이 진행 중이면 5초마다 상태 확인 -> 새로 계산된 옷이 생기면 결과 갱신
    const running = !!match?.status.running;
    const baseHex = base?.hex;
    useEffect(() => {
        if (!running || !baseHex) return;
        let alive = true;
        let last = match?.status.analyzed ?? 0;
        const timer = setInterval(async () => {
            try {
                const s = (await colorAssistantAPI.wardrobeColorStatus()).data;
                if (!alive) return;
                if (s.analyzed !== last || !s.running) {
                    last = s.analyzed;
                    const r = await colorAssistantAPI.matchColor(baseHex);
                    if (alive) setMatch(r.data);
                }
            } catch {
                // 다음 주기에 다시 시도
            }
        }, 5000);
        return () => { alive = false; clearInterval(timer); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [running, baseHex]);

    const choose = (idx: number) => {
        const p = data.palette.find(x => x.index === idx);
        if (!p || idx === baseIndex) return;
        setBaseIndex(idx);
        fetchMatch(p.hex);
    };

    const status = match?.status;
    const deficient = !!match?.colorDeficient;
    const noWardrobe = !!status && status.total === 0;

    return (
        <section id="cc-wardrobe" style={card}>
            <CardTitle icon={<Shirt size={18} />} title="내 옷장에서 찾기" desc="사진 속 옷 색과 내 옷의 실제 색을 비교해요. 내 옷은 사진에서 그 옷만 잘라 색을 계산해요." />

            <p id="cc-base-label" style={{ fontSize: 14, fontWeight: 700, color: CC.text, margin: '0 0 10px' }}>어떤 색으로 찾을까요?</p>
            <div role="radiogroup" aria-labelledby="cc-base-label" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {garment.map(p => {
                    const active = p.index === baseIndex;
                    return (
                        <button key={p.index} role="radio" aria-checked={active} onClick={() => choose(p.index)} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '7px 14px 7px 7px', borderRadius: 999, fontSize: 14,
                            border: `2px solid ${active ? CC.brand : CC.border}`, background: active ? CC.blueBg : 'white',
                            color: active ? CC.text : CC.sub, fontWeight: active ? 700 : 500,
                        }}>
                            <Swatch hex={pick(view, p.hex, p.correctedHex)} size={24} label={`${p.name} ${p.hex}`} />
                            {p.name}<span style={{ fontWeight: 500, color: active ? CC.sub : CC.muted }}>{Math.round((p.ratio / total) * 100)}%</span>
                            {active && <CheckCircle2 size={15} color={CC.brandText} aria-hidden />}
                        </button>
                    );
                })}
            </div>
            {base && <p style={{ fontSize: 13.5, color: CC.sub, margin: '10px 0 18px', wordBreak: 'keep-all' }}>기준 색 <strong style={{ color: CC.text }}>{base.name}</strong> · {base.description.text}</p>}

            {status && status.total > 0 && status.analyzed < status.total && (
                <div role="status" style={{ background: CC.soft, borderRadius: 12, padding: '12px 14px', marginBottom: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: CC.sub, marginBottom: 6, gap: 8, flexWrap: 'wrap' }}>
                        <span>{status.running ? '옷장 색을 분석하고 있어요. 끝나는 대로 결과가 갱신돼요.' : '아직 분석하지 못한 옷이 있어요. 페이지를 다시 열면 이어서 분석해요.'}</span>
                        <span style={{ fontWeight: 700, color: CC.text }}>{status.analyzed} / {status.total}</span>
                    </div>
                    <div aria-hidden style={{ height: 6, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.round((status.analyzed / status.total) * 100)}%`, height: '100%', background: CC.brand }} />
                    </div>
                </div>
            )}

            {loading && <p role="status" style={{ fontSize: 14, color: CC.sub, margin: '8px 0 16px' }}>옷장에서 찾는 중...</p>}
            {error && <p role="alert" style={{ fontSize: 14, color: CC.warnText, margin: '8px 0 16px' }}>{error}</p>}

            {!loading && match && (noWardrobe ? (
                <Empty text="옷장에 등록된 옷이 없어요." />
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
                    <Group kind="same" title="같은 색 · 비슷한 색" count={match.matches.length}
                           desc={`같은 색 계열이면서 색 차이가 ${match.thresholds.similar} 이하인 옷이에요.`}
                           empty={`이 색과 같거나 비슷한 옷이 없어요.${match.sameFamily.length ? ' 아래 같은 계열의 옷을 참고해 보세요.' : ''}`}>
                        {match.matches.map(m => <ItemCard key={m.itemId} item={m} base={base} view={view} colorType={colorType}
                                                          kind={m.label === '거의 같은 색' ? 'same' : 'similar'} footer={`색 차이 ${m.deltaE}`} />)}
                    </Group>

                    {deficient && (
                        <Group kind="confuse" title="비슷해 보이지만 실제로는 다른 색" count={match.confusions.length}
                               desc={`${match.colorTypeLabel || '내 색각'} 기준으로는 기준 색과 비슷하게 보일 수 있지만 실제로는 다른 색이에요. 같은 색을 찾을 때 헷갈릴 수 있고, 함께 입으면 다른 사람에게는 색이 확연히 다르게 보여요.`}
                               empty="헷갈릴 만한 옷은 없어요.">
                            {match.confusions.map(m => <ItemCard key={m.itemId} item={m} base={base} view={view} colorType={colorType}
                                                                 kind="confuse" footer={`실제 차이 ${m.deltaE} · 내 눈 기준 ${(m as ColorConfusionItem).seenDeltaE}`} />)}
                        </Group>
                    )}

                    <Group kind="family" title={`같은 계열의 옷${match.baseFamily ? ` (${match.baseFamily})` : ''}`} count={match.sameFamily.length}
                           desc="색 차이는 크지만 같은 색 계열이에요. 정확히 같은 색은 아니어도 비슷한 분위기로 맞출 때 참고할 수 있어요."
                           empty="같은 계열의 다른 옷은 없어요.">
                        {match.sameFamily.map((m: ColorFamilyItem) => <ItemCard key={m.itemId} item={m} base={base} view={view} colorType={colorType}
                                                                                kind="family" footer={`색 차이 ${m.deltaE}`} />)}
                    </Group>
                </div>
            ))}

            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 20, paddingTop: 16, borderTop: `1px solid ${CC.border}` }}>
                <Info size={15} color={CC.muted} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
                <p style={{ fontSize: 12.5, color: CC.muted, margin: 0, lineHeight: 1.6, wordBreak: 'keep-all' }}>
                    색 차이는 CIEDE2000 값이에요. {match?.thresholds.same ?? 6} 이하는 "거의 같은 색", {match?.thresholds.similar ?? 12} 이하는 "비슷한 색"으로 표시해요.
                    상의·하의·아우터·원피스만 비교하며, 조명과 촬영 환경에 따라 실제 색과 다를 수 있어요.
                </p>
            </div>
        </section>
    );
}

function Group({ kind, title, count, desc, empty, children }: {
    kind: BadgeKind; title: string; count: number; desc: string; empty: string; children: React.ReactNode;
}) {
    const b = BADGE[kind];
    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span aria-hidden style={{ color: b.fg, display: 'inline-flex' }}><b.Icon size={17} /></span>
                <h3 style={{ fontWeight: 700, fontSize: 16, color: CC.text, margin: 0 }}>{title}</h3>
                <span style={{ fontSize: 13, fontWeight: 700, color: b.fg, background: b.bg, borderRadius: 999, padding: '1px 9px' }}>{count}</span>
            </div>
            <p style={{ fontSize: 13, color: CC.sub, margin: '0 0 12px', lineHeight: 1.6, wordBreak: 'keep-all' }}>{desc}</p>
            {count === 0 ? <Empty text={empty} /> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>{children}</div>
            )}
        </div>
    );
}

const Empty = ({ text }: { text: string }) => (
    <div style={{ background: CC.soft, borderRadius: 14, padding: '16px 18px', fontSize: 14, color: CC.sub, lineHeight: 1.6 }}>{text}</div>
);

function ItemCard({ item, base, view, colorType, kind, footer }: {
    item: ColorMatchItem | ColorConfusionItem | ColorFamilyItem;
    base?: MoodboardPaletteColor; view: ColorView; colorType: string; kind: BadgeKind; footer: string;
}) {
    const itemHex = pick(view, item.itemHex, item.itemCorrectedHex);
    return (
        <article style={{ border: `1px solid ${CC.border}`, borderRadius: 16, overflow: 'hidden', background: 'white', display: 'flex', flexDirection: 'column' }}>
            {item.imageUrl ? (
                <DaltonizedImage src={item.imageUrl} alt={item.type || '옷'} colorType={(colorType || 'normal') as ColorType | 'normal'}
                                 correctionEnabled={view === 'corrected'}
                                 style={{ width: '100%', aspectRatio: '1 / 1', background: CC.soft }}
                                 imgStyle={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
            ) : <div style={{ width: '100%', aspectRatio: '1 / 1', background: CC.soft }} />}
            <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Badge kind={kind} />
                <p style={{ fontWeight: 700, fontSize: 15, color: CC.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.type || '이름 없음'}</p>
                <p style={{ fontSize: 12.5, color: CC.muted, margin: 0 }}>{[item.category, item.color].filter(Boolean).join(' · ')}</p>
                <p style={{ fontSize: 13, color: CC.sub, margin: 0, lineHeight: 1.45, wordBreak: 'keep-all' }}>{item.itemDescription}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap', fontSize: 12, color: CC.muted }}>
                    {base && <Swatch hex={pick(view, base.hex, base.correctedHex)} size={20} label={`사진 속 색 ${base.name}`} />}
                    <span>사진</span><span aria-hidden>↔</span>
                    <Swatch hex={itemHex} size={20} label={`내 옷 색 ${itemHex}`} />
                    <span>내 옷</span>
                </div>
                <p style={{ fontSize: 12, color: CC.sub, margin: 0 }}>{footer}</p>
            </div>
        </article>
    );
}

// ── 3. 무드보드 ─────────────────────────────
function MoodCard({ data, view }: { data: MoodboardResponse; view: ColorView }) {
    const correctedOf = useMemo(() => new Map(data.palette.map(p => [p.hex, p.correctedHex])), [data.palette]);
    const hasMoods = data.moodSource === 'gemini' && data.moods.length > 0;
    return (
        <section id="cc-mood" style={card}>
            <CardTitle icon={<Sparkles size={18} />} title="무드보드" desc="이 옷의 색에서 다른 사람들이 떠올릴 만한 장면이에요. 색을 장면과 느낌으로 이해하는 데 참고하세요." />
            {hasMoods ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 16 }}>
                    {data.moods.map((m, i) => (
                        <figure key={i} style={{ margin: 0 }}>
                            <div role="img" aria-label={`${m.title} 장면 색 견본`} style={{ aspectRatio: '1 / 1', borderRadius: 16, position: 'relative', overflow: 'hidden', background: tileBackground(m.colors.map(h => pick(view, h, correctedOf.get(h)))), boxShadow: '0 4px 14px rgba(26,26,46,0.10)' }}>
                                <div style={{ position: 'absolute', left: 10, top: 10, right: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {m.keywords.map((k, ki) => (
                                        <span key={ki} style={{ fontSize: 12, fontWeight: 700, color: CC.text, background: 'rgba(255,255,255,0.92)', padding: '3px 9px', borderRadius: 999 }}>{k}</span>
                                    ))}
                                </div>
                            </div>
                            <figcaption>
                                <p style={{ fontWeight: 700, fontSize: 15, color: CC.text, margin: '10px 0 2px', wordBreak: 'keep-all' }}>{m.title}</p>
                                <p style={{ fontSize: 13, color: CC.sub, margin: 0, lineHeight: 1.5, wordBreak: 'keep-all' }}>{m.scene}</p>
                            </figcaption>
                        </figure>
                    ))}
                </div>
            ) : (
                <Empty text='AI 무드보드를 만들지 못했어요. 위 "이 옷의 색"의 색 설명은 사진에서 계산한 값이라 그대로 확인할 수 있어요.' />
            )}
            {data.tip && (
                <div style={{ marginTop: 18, display: 'flex', gap: 10, alignItems: 'flex-start', background: CC.blueBg, borderRadius: 14, padding: '14px 16px' }}>
                    <Lightbulb size={18} color={CC.blueText} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden />
                    <p style={{ fontSize: 14, color: CC.text, margin: 0, lineHeight: 1.6 }}><strong>코디 팁 </strong>{data.tip}</p>
                </div>
            )}
        </section>
    );
}

// ── 메인 ────────────────────────────────────
interface Props {
    loading: boolean;
    error: string | null;
    data: MoodboardResponse | null;
    colorType: string;
    view: ColorView;
    onRetry?: () => void;
}

export default function ColorMoodboardSection({ loading, error, data, colorType, view, onRetry }: Props) {
    if (loading) return <LoadingCard />;
    if (error) {
        return (
            <div role="alert" style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <AlertTriangle size={18} color={CC.warnText} aria-hidden />
                <p style={{ fontSize: 14, color: CC.text, margin: 0, flex: 1 }}>{error}</p>
                {onRetry && (
                    <button onClick={onRetry} style={{ padding: '8px 18px', background: CC.brandFill, color: CC.onBrand, border: 'none', borderRadius: 999, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>다시 시도</button>
                )}
            </div>
        );
    }
    if (!data) return null;
    const key = data.palette.map(p => p.hex).join('-') + ':' + data.baseIndex;   // 새 사진이면 기준 색/매칭 상태 초기화
    return (
        <div key={key}>
            {data.notes.length > 0 && (
                <div role="note" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 14, padding: '12px 14px', background: CC.soft, borderRadius: 12 }}>
                    <Info size={15} color={CC.sub} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
                    <p style={{ fontSize: 13, color: CC.sub, margin: 0, lineHeight: 1.6 }}>{data.notes.join(' ')}</p>
                </div>
            )}
            <ColorsCard data={data} view={view} />
            <WardrobeCard data={data} view={view} colorType={colorType} />
            <MoodCard data={data} view={view} />
        </div>
    );
}