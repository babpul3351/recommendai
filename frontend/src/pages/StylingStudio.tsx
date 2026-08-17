import React, { useEffect, useState, useRef, useCallback } from 'react';
import { wardrobeAPI } from '../api/api';
import { AI_BASE_URL } from '../api/env';
import { theme } from '../styles/theme';
import { WardrobeIcon, StudioIcon, CloseIcon } from '../components/Icons';

interface WardrobeItem {
    id: number;
    imageUrl?: string;
    type?: string;
    category?: string;
    color?: string;
}

interface CanvasItem {
    id: string;
    wardrobeItemId: number;
    originalSrc: string;
    displaySrc: string;
    cachedB64: string | null;
    isLoading: boolean;
    isBgRemoved: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
    zIndex: number;
}

const CATEGORIES = ['전체', '상의', '하의', '아우터', '원피스', '기타'];
const ITEM_SIZE = 180;

function normalizeCategory(category?: string): string {
    if (!category) return '기타';
    const c = category.trim();
    if (['상의', '탑', 'top', '티셔츠', '셔츠', '니트', '블라우스', '후드', '맨투맨'].some(k => c.includes(k))) return '상의';
    if (['하의', '팬츠', '바지', '스커트', '반바지', 'bottom'].some(k => c.includes(k))) return '하의';
    if (['아우터', '자켓', '재킷', '코트', '패딩', '점퍼', '가디건', 'outer'].some(k => c.includes(k))) return '아우터';
    if (['원피스', '드레스', 'dress'].some(k => c.includes(k))) return '원피스';
    return c;
}

async function urlToBase64(url: string): Promise<string> {
    const resp = await fetch(url, { mode: 'cors' });
    const blob = await resp.blob();
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
    });
}

function btnStyle(disabled: boolean, variant: 'default' | 'danger' | 'primary' = 'default'): React.CSSProperties {
    const colors = {
        default: { bg: disabled ? '#f5f7fa' : 'white', color: disabled ? '#ccc' : '#444', border: '1px solid #eaedf2' },
        danger:  { bg: disabled ? '#f5f7fa' : 'white', color: disabled ? '#ccc' : '#FF5A5A', border: `1px solid ${disabled ? '#eaedf2' : '#FF5A5A'}` },
        primary: { bg: disabled ? '#c8dff0' : 'linear-gradient(135deg, #71b3e5, #5a9fd4)', color: 'white', border: 'none' },
    };
    const c = colors[variant];
    return {
        padding: '8px 16px',
        borderRadius: 10,
        border: c.border,
        background: c.bg,
        color: c.color,
        
        fontSize: 13,
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap' as const,
        flexShrink: 0,
    };
}

function StylingStudio() {
    const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([]);
    const [wardrobeLoading, setWardrobeLoading] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('전체');
    const [canvasItems, setCanvasItems] = useState<CanvasItem[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [draggingItem, setDraggingItem] = useState<WardrobeItem | null>(null);
    const [saving, setSaving] = useState(false);
    const canvasRef = useRef<HTMLDivElement>(null);
    const moveRef = useRef<{ id: string; startX: number; startY: number; initX: number; initY: number } | null>(null);
    const resizeRef = useRef<{ id: string; corner: string; startX: number; startY: number; initW: number; initH: number; initX: number; initY: number } | null>(null);
    const zCounter = useRef(1);

    useEffect(() => {
        setWardrobeLoading(true);
        wardrobeAPI.getWardrobe()
            .then(res => setWardrobeItems(res.data))
            .catch(console.error)
            .finally(() => setWardrobeLoading(false));
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (!selectedId) return;
            if ((e.key === 'Delete' || e.key === 'Backspace') && (e.target as HTMLElement).tagName !== 'INPUT') {
                setCanvasItems(prev => prev.filter(i => i.id !== selectedId));
                setSelectedId(null);
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [selectedId]);

    const addToCanvas = useCallback(async (wardrobeItem: WardrobeItem, dropX: number, dropY: number) => {
        const id = `${wardrobeItem.id}_${Date.now()}`;
        const src = wardrobeItem.imageUrl || '';
        zCounter.current += 1;

        const newItem: CanvasItem = {
            id,
            wardrobeItemId: wardrobeItem.id,
            originalSrc: src,
            displaySrc: src,
            cachedB64: null,
            isLoading: !!src,
            isBgRemoved: false,
            x: Math.max(0, dropX - ITEM_SIZE / 2),
            y: Math.max(0, dropY - ITEM_SIZE / 2),
            width: ITEM_SIZE,
            height: ITEM_SIZE,
            zIndex: zCounter.current,
        };

        setCanvasItems(prev => [...prev, newItem]);
        setSelectedId(id);

        if (!src) return;

        // 1단계: S3 이미지 → base64 (캔버스 저장 시 CORS 문제 방지)
        let b64: string;
        try {
            b64 = await urlToBase64(src);
            setCanvasItems(prev => prev.map(i => i.id === id ? { ...i, cachedB64: b64 } : i));
        } catch {
            setCanvasItems(prev => prev.map(i => i.id === id ? { ...i, isLoading: false } : i));
            return;
        }

        // 2단계: SAM 배경 제거
        try {
            const res = await fetch(`${AI_BASE_URL}/ai/remove-background`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageB64: b64 }),
            });
            if (res.ok) {
                const data = await res.json();
                setCanvasItems(prev => prev.map(i =>
                    i.id === id
                        ? { ...i, displaySrc: `data:image/png;base64,${data.resultB64}`, isLoading: false, isBgRemoved: true }
                        : i
                ));
            } else {
                // SAM 실패 → cachedB64(data URL)로 폴백
                setCanvasItems(prev => prev.map(i => i.id === id ? { ...i, displaySrc: b64, isLoading: false } : i));
            }
        } catch {
            setCanvasItems(prev => prev.map(i => i.id === id ? { ...i, displaySrc: b64, isLoading: false } : i));
        }
    }, []);

    // ── Canvas drag/drop ──────────────────────────────────────────────────────

    const handleCanvasDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleCanvasDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (!draggingItem || !canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        addToCanvas(draggingItem, e.clientX - rect.left, e.clientY - rect.top);
        setDraggingItem(null);
    };

    // ── Item move (pointer capture) ───────────────────────────────────────────

    const handleItemPointerDown = (e: React.PointerEvent, id: string) => {
        if (resizeRef.current) return;
        e.stopPropagation();
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        const item = canvasItems.find(i => i.id === id)!;
        moveRef.current = { id, startX: e.clientX, startY: e.clientY, initX: item.x, initY: item.y };
        setSelectedId(id);
        // bring to front
        setCanvasItems(prev => {
            const max = Math.max(...prev.map(i => i.zIndex));
            if (item.zIndex === max) return prev;
            zCounter.current = max + 1;
            return prev.map(i => i.id === id ? { ...i, zIndex: zCounter.current } : i);
        });
    };

    const handleItemPointerMove = (e: React.PointerEvent, id: string) => {
        const moving = moveRef.current;
        if (!moving || moving.id !== id || resizeRef.current) return;
        const dx = e.clientX - moving.startX;
        const dy = e.clientY - moving.startY;
        setCanvasItems(prev => prev.map(i =>
            i.id === id ? { ...i, x: moving.initX + dx, y: moving.initY + dy } : i
        ));
    };

    const handleItemPointerUp = () => {
        moveRef.current = null;
    };

    // ── Resize handles ────────────────────────────────────────────────────────

    const handleResizeDown = (e: React.PointerEvent, id: string, corner: string) => {
        e.stopPropagation();
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        const item = canvasItems.find(i => i.id === id)!;
        resizeRef.current = { id, corner, startX: e.clientX, startY: e.clientY, initW: item.width, initH: item.height, initX: item.x, initY: item.y };
    };

    const handleResizeMove = (e: React.PointerEvent) => {
        const resizing = resizeRef.current;
        if (!resizing) return;
        const { id, corner, startX, startY, initW, initH, initX, initY } = resizing;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        let w = initW, h = initH, x = initX, y = initY;
        if (corner.includes('e')) w = Math.max(60, initW + dx);
        if (corner.includes('w')) { w = Math.max(60, initW - dx); x = initX + initW - w; }
        if (corner.includes('s')) h = Math.max(60, initH + dy);
        if (corner.includes('n')) { h = Math.max(60, initH - dy); y = initY + initH - h; }
        setCanvasItems(prev => prev.map(i => i.id === id ? { ...i, width: w, height: h, x, y } : i));
    };

    const handleResizeUp = () => { resizeRef.current = null; };

    // ── Layer controls ────────────────────────────────────────────────────────

    const changeLayer = (dir: 1 | -1) => {
        if (!selectedId) return;
        setCanvasItems(prev => {
            const item = prev.find(i => i.id === selectedId);
            if (!item) return prev;
            const target = prev.find(i => i.zIndex === item.zIndex + dir);
            if (!target) return prev;
            return prev.map(i => {
                if (i.id === item.id) return { ...i, zIndex: item.zIndex + dir };
                if (i.id === target.id) return { ...i, zIndex: item.zIndex };
                return i;
            });
        });
    };

    const deleteSelected = () => {
        if (!selectedId) return;
        setCanvasItems(prev => prev.filter(i => i.id !== selectedId));
        setSelectedId(null);
    };

    // ── Canvas 합성 (data URL만 사용 → CORS 문제 없음) ────────────────────────

    const composeCanvas = useCallback(async (): Promise<string> => {
        const el = canvasRef.current!;
        const canvas = document.createElement('canvas');
        canvas.width = el.offsetWidth;
        canvas.height = el.offsetHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const sorted = [...canvasItems].sort((a, b) => a.zIndex - b.zIndex);
        for (const item of sorted) {
            // displaySrc(SAM 결과) → cachedB64(원본 data URL) → originalSrc 순으로 시도
            const src = item.displaySrc.startsWith('data:')
                ? item.displaySrc
                : (item.cachedB64 ?? item.originalSrc);
            if (!src) continue;
            await new Promise<void>((resolve) => {
                const img = new Image();
                img.onload = () => { ctx.drawImage(img, item.x, item.y, item.width, item.height); resolve(); };
                img.onerror = () => resolve();
                img.src = src;
            });
        }
        return canvas.toDataURL('image/png');
    }, [canvasItems]);

    // ── 옷장에 코디 저장 ────────────────────────────────────────────────────────

    const handleSaveToWardrobe = async () => {
        if (canvasItems.length === 0 || saving) return;
        setSaving(true);
        try {
            // 저장 전 현재 옷장 ID 목록 확보
            const before = await wardrobeAPI.getWardrobe();
            const beforeIds = new Set<number>(before.data.map((i: any) => i.id));

            // 캔버스 합성 → 업로드
            const b64 = await composeCanvas();
            await wardrobeAPI.uploadItem(b64);

            // 새로 추가된 아이템 찾기
            const after = await wardrobeAPI.getWardrobe();
            const newItem = after.data.find((i: any) => !beforeIds.has(i.id));

            if (newItem) {
                await wardrobeAPI.updateItem(newItem.id, {
                    category: '저장한 코디',
                    type: '코디 조합',
                    color: '',
                    material: '',
                });
            }
            alert('코디가 내 옷장에 저장됐습니다!');
        } catch (err) {
            console.error(err);
            alert('저장에 실패했습니다. 다시 시도해 주세요.');
        } finally {
            setSaving(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────

    const filtered = wardrobeItems.filter(item =>
        selectedCategory === '전체' || normalizeCategory(item.category) === selectedCategory
    );

    const selected = canvasItems.find(i => i.id === selectedId);

    return (
        <div style={{ padding: '70px 36px', maxWidth: 1200, width: '100%', boxSizing: 'border-box' }}>
            {/* Header */}
            <div style={{ marginBottom: 20 }}>
                <h1 style={{  fontWeight: 700, fontSize: 28, color: '#1a1a2e', margin: 0 }}>
                    코디 스튜디오
                </h1>
                <p style={{  fontSize: 14, color: '#888', margin: '6px 0 0' }}>
                    옷장에서 아이템을 드래그해서 나만의 코디를 완성해 보세요
                </p>
            </div>

            {/* Toolbar */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => changeLayer(1)} disabled={!selected} style={btnStyle(!selected)}>앞으로</button>
                <button onClick={() => changeLayer(-1)} disabled={!selected} style={btnStyle(!selected)}>뒤로</button>
                <button onClick={deleteSelected} disabled={!selected} style={btnStyle(!selected, 'danger')}>삭제</button>
                <div style={{ flex: 1 }} />
                <button
                    onClick={() => { setCanvasItems([]); setSelectedId(null); }}
                    disabled={canvasItems.length === 0}
                    style={btnStyle(canvasItems.length === 0)}
                >
                    전체 지우기
                </button>
                <button
                    onClick={handleSaveToWardrobe}
                    disabled={canvasItems.length === 0 || saving}
                    style={btnStyle(canvasItems.length === 0 || saving, 'primary')}
                >
                    {saving ? '저장 중...' : '옷장에 저장'}
                </button>
            </div>

            {/* Main layout */}
            <div style={{ display: 'flex', gap: 16, height: 660 }}>

                {/* Left: Palette */}
                <div style={{
                    width: 236,
                    flexShrink: 0,
                    background: 'white',
                    borderRadius: 20,
                    border: '1px solid #eaedf2',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                }}>
                    <div style={{ padding: '16px 16px 8px' }}>
                        <p style={{  fontWeight: 600, fontSize: 14, color: '#1a1a2e', margin: 0 }}>
                            내 옷장
                        </p>
                        <p style={{  fontSize: 11, color: '#aaa', margin: '4px 0 0' }}>
                            아이템을 드래그해서 캔버스에 올려보세요
                        </p>
                    </div>

                    {/* Category filter */}
                    <div style={{ padding: '0 12px 10px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                style={{
                                    padding: '4px 10px',
                                    borderRadius: 8,
                                    border: 'none',
                                    background: selectedCategory === cat ? 'linear-gradient(135deg, #71b3e5, #5a9fd4)' : '#f5f7fa',
                                    color: selectedCategory === cat ? 'white' : '#666',
                                    
                                    fontSize: 11,
                                    fontWeight: selectedCategory === cat ? 600 : 400,
                                    cursor: 'pointer',
                                }}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    {/* Items grid */}
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '0 12px 12px',
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 8,
                        alignContent: 'start',
                    }}>
                        {wardrobeLoading ? (
                            <div style={{ gridColumn: '1/-1', textAlign: 'center', paddingTop: 40, color: '#aaa',  fontSize: 12 }}>
                                불러오는 중...
                            </div>
                        ) : filtered.length === 0 ? (
                            <div style={{ gridColumn: '1/-1', textAlign: 'center', paddingTop: 40, color: '#aaa',  fontSize: 12 }}>
                                아이템이 없어요
                            </div>
                        ) : filtered.map(item => (
                            <div
                                key={item.id}
                                draggable
                                onDragStart={(e) => {
                                    setDraggingItem(item);
                                    const ghost = document.createElement('div');
                                    ghost.style.cssText = 'position:fixed;top:-200px;width:60px;height:60px;pointer-events:none';
                                    document.body.appendChild(ghost);
                                    e.dataTransfer.setDragImage(ghost, 30, 30);
                                    requestAnimationFrame(() => document.body.removeChild(ghost));
                                }}
                                onDragEnd={() => setDraggingItem(null)}
                                style={{
                                    background: '#f9fafb',
                                    border: '1px solid #eaedf2',
                                    borderRadius: 12,
                                    overflow: 'hidden',
                                    cursor: 'grab',
                                    userSelect: 'none',
                                    transition: 'box-shadow 0.15s, transform 0.15s',
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}
                            >
                                {item.imageUrl ? (
                                    <img
                                        src={item.imageUrl}
                                        alt={item.type || ''}
                                        draggable={false}
                                        style={{ width: '100%', height: 88, objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
                                    />
                                ) : (
                                    <div style={{ height: 88, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <WardrobeIcon size={28} color="#bbb" />
                                    </div>
                                )}
                                <p style={{
                                    margin: 0,
                                    padding: '6px 8px',
                                    
                                    fontSize: 10,
                                    color: '#555',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}>
                                    {item.type || normalizeCategory(item.category)}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Canvas */}
                <div
                    ref={canvasRef}
                    onDragOver={handleCanvasDragOver}
                    onDrop={handleCanvasDrop}
                    onClick={() => setSelectedId(null)}
                    style={{
                        flex: 1,
                        background: 'white',
                        borderRadius: 20,
                        border: `2px dashed ${draggingItem ? '#71b3e5' : '#dde4ef'}`,
                        position: 'relative',
                        overflow: 'hidden',
                        backgroundImage: 'radial-gradient(circle, #dde4ef 1px, transparent 1px)',
                        backgroundSize: '24px 24px',
                        transition: 'border-color 0.2s',
                        cursor: 'default',
                    }}
                >
                    {/* Empty hint */}
                    {canvasItems.length === 0 && (
                        <div style={{
                            position: 'absolute', inset: 0,
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center',
                            pointerEvents: 'none',
                        }}>
                            <div style={{ marginBottom: 14, opacity: 0.35 }}>
                                <StudioIcon size={48} color="#bcc5d4" />
                            </div>
                            <p style={{  fontWeight: 600, fontSize: 15, color: '#bcc5d4', margin: 0 }}>
                                여기에 아이템을 드래그해 보세요
                            </p>
                            <p style={{  fontSize: 12, color: '#c8d0dc', margin: '6px 0 0' }}>
                                배경이 자동으로 제거돼요
                            </p>
                        </div>
                    )}

                    {/* Canvas items */}
                    {canvasItems.map(item => {
                        const isSel = item.id === selectedId;

                        return (
                            <div
                                key={item.id}
                                onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                                onPointerMove={(e) => handleItemPointerMove(e, item.id)}
                                onPointerUp={handleItemPointerUp}
                                onClick={(e) => { e.stopPropagation(); setSelectedId(item.id); }}
                                style={{
                                    position: 'absolute',
                                    left: item.x,
                                    top: item.y,
                                    width: item.width,
                                    height: item.height,
                                    zIndex: item.zIndex,
                                    cursor: 'grab',
                                    outline: isSel ? '2px solid #71b3e5' : '2px solid transparent',
                                    outlineOffset: 2,
                                    borderRadius: 8,
                                    touchAction: 'none',
                                    userSelect: 'none',
                                }}
                            >
                                {item.isLoading ? (
                                    <div style={{
                                        width: '100%', height: '100%',
                                        display: 'flex', flexDirection: 'column',
                                        alignItems: 'center', justifyContent: 'center',
                                        background: 'rgba(113,179,229,0.07)',
                                        borderRadius: 8,
                                        gap: 8,
                                    }}>
                                        <div style={{
                                            width: 28, height: 28,
                                            border: '3px solid #71b3e5',
                                            borderTopColor: 'transparent',
                                            borderRadius: '50%',
                                            animation: 'spin 0.8s linear infinite',
                                        }} />
                                        <span style={{  fontSize: 10, color: '#71b3e5' }}>
                                            배경 제거 중…
                                        </span>
                                    </div>
                                ) : (
                                    <img
                                        src={item.displaySrc}
                                        alt=""
                                        draggable={false}
                                        style={{
                                            width: '100%', height: '100%',
                                            objectFit: 'contain',
                                            display: 'block',
                                            pointerEvents: 'none',
                                            borderRadius: 8,
                                        }}
                                    />
                                )}

                                {/* Delete button */}
                                {isSel && (
                                    <button
                                        onPointerDown={(e) => e.stopPropagation()}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setCanvasItems(prev => prev.filter(i => i.id !== item.id));
                                            setSelectedId(null);
                                        }}
                                        style={{
                                            position: 'absolute', top: -12, right: -12,
                                            width: 24, height: 24, borderRadius: '50%',
                                            background: '#FF5A5A', border: 'none',
                                            cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            boxShadow: '0 2px 6px rgba(255,90,90,0.45)',
                                            zIndex: 10,
                                        }}
                                    >
                                        <CloseIcon size={12} color="white" />
                                    </button>
                                )}

                                {/* SAM badge */}
                                {isSel && item.isBgRemoved && (
                                    <div style={{
                                        position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)',
                                        background: 'linear-gradient(135deg, #71b3e5, #5a9fd4)',
                                        color: 'white', fontSize: 9, 
                                        padding: '2px 8px', borderRadius: 999,
                                        whiteSpace: 'nowrap', zIndex: 10,
                                        boxShadow: '0 2px 6px rgba(113,179,229,0.4)',
                                    }}>
                                        배경 제거됨
                                    </div>
                                )}

                                {/* Resize handles */}
                                {isSel && (
                                    <>
                                        {[
                                            { corner: 'nw', style: { top: -5, left: -5, cursor: 'nw-resize' } },
                                            { corner: 'ne', style: { top: -5, right: -5, cursor: 'ne-resize' } },
                                            { corner: 'sw', style: { bottom: -5, left: -5, cursor: 'sw-resize' } },
                                            { corner: 'se', style: { bottom: -5, right: -5, cursor: 'se-resize' } },
                                        ].map(({ corner, style }) => (
                                            <div
                                                key={corner}
                                                onPointerDown={(e) => { e.stopPropagation(); handleResizeDown(e, item.id, corner); }}
                                                onPointerMove={(e) => { e.stopPropagation(); handleResizeMove(e); }}
                                                onPointerUp={(e) => { e.stopPropagation(); handleResizeUp(); }}
                                                style={{
                                                    position: 'absolute',
                                                    width: 10, height: 10,
                                                    background: 'white',
                                                    border: '2px solid #71b3e5',
                                                    borderRadius: 3,
                                                    zIndex: 11,
                                                    ...style,
                                                }}
                                            />
                                        ))}
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

export default StylingStudio;
