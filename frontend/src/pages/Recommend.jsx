import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import { wardrobeAPI } from '../api/api';

const TPO_LIST = [
    { key: '데이트', emoji: '💑' },
    { key: '직장', emoji: '💼' },
    { key: '캐주얼', emoji: '👟' },
    { key: '운동', emoji: '🏃' },
    { key: '파티', emoji: '🎉' },
    { key: '여행', emoji: '✈️' },
    { key: '일상', emoji: '☀️' },
    { key: '격식', emoji: '👔' },
];

function Recommend() {
    const [selectedTpo, setSelectedTpo] = useState(null);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleRecommend = async () => {
        if (!selectedTpo) {
            setError('TPO를 선택해주세요.');
            return;
        }
        setLoading(true);
        setError('');
        setResult(null);
        try {
            const res = await wardrobeAPI.recommend({
                tpo: selectedTpo,
                mode: 'rag',
                linkedEvents: []
            });
            setResult(res.data);
        } catch (err) {
            setError('추천에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.page}>
            <Navbar />
            <div style={styles.container}>
                <h1 style={styles.title}>코디 추천</h1>
                <p style={styles.subtitle}>오늘의 TPO를 선택하면 AI가 코디를 추천해드려요</p>

                {/* TPO 선택 */}
                <div style={styles.section}>
                    <h2 style={styles.sectionTitle}>TPO 선택</h2>
                    <div style={styles.tpoGrid}>
                        {TPO_LIST.map(tpo => (
                            <div
                                key={tpo.key}
                                style={{
                                    ...styles.tpoCard,
                                    backgroundColor: selectedTpo === tpo.key ? '#333' : 'white',
                                    color: selectedTpo === tpo.key ? 'white' : '#333',
                                    boxShadow: selectedTpo === tpo.key
                                        ? '0 4px 12px rgba(0,0,0,0.2)'
                                        : '0 2px 8px rgba(0,0,0,0.08)'
                                }}
                                onClick={() => setSelectedTpo(tpo.key)}
                            >
                                <p style={styles.tpoEmoji}>{tpo.emoji}</p>
                                <p style={styles.tpoLabel}>{tpo.key}</p>
                            </div>
                        ))}
                    </div>

                    {error && <p style={styles.error}>{error}</p>}

                    <button
                        style={{
                            ...styles.button,
                            opacity: loading ? 0.7 : 1
                        }}
                        onClick={handleRecommend}
                        disabled={loading}
                    >
                        {loading ? 'AI가 코디를 분석 중...' : '코디 추천받기'}
                    </button>
                </div>

                {/* 추천 결과 */}
                {result && (
                    <div style={styles.section}>
                        <h2 style={styles.sectionTitle}>추천 결과</h2>

                        {/* 스타일 태그 */}
                        <div style={styles.styleTag}>
                            <span>{result.outfit.style}</span>
                        </div>

                        {/* 코디 구성 */}
                        <div style={styles.outfitGrid}>
                            {result.outfit.top && (
                                <div style={styles.outfitItem}>
                                    <p style={styles.outfitLabel}>상의</p>
                                    <p style={styles.outfitType}>{result.outfit.top.type}</p>
                                    <p style={styles.outfitColor}>{result.outfit.top.color}</p>
                                </div>
                            )}
                            {result.outfit.bottom && (
                                <div style={styles.outfitItem}>
                                    <p style={styles.outfitLabel}>하의</p>
                                    <p style={styles.outfitType}>{result.outfit.bottom.type}</p>
                                    <p style={styles.outfitColor}>{result.outfit.bottom.color}</p>
                                </div>
                            )}
                            {result.outfit.outer && (
                                <div style={styles.outfitItem}>
                                    <p style={styles.outfitLabel}>아우터</p>
                                    <p style={styles.outfitType}>{result.outfit.outer.type}</p>
                                    <p style={styles.outfitColor}>{result.outfit.outer.color}</p>
                                </div>
                            )}
                        </div>

                        {/* 코디 설명 */}
                        <div style={styles.descBox}>
                            <p style={styles.desc}>{result.outfit.description}</p>
                        </div>

                        {/* 매칭된 옷장 아이템 */}
                        {result.matched_items && result.matched_items.length > 0 && (
                            <div style={styles.matchedSection}>
                                <p style={styles.matchedTitle}>내 옷장에서 매칭된 아이템</p>
                                <div style={styles.matchedGrid}>
                                    {result.matched_items.map((item, i) => (
                                        <div key={i} style={styles.matchedCard}>
                                            {item.imageB64 && (
                                                <img
                                                    src={item.imageB64}
                                                    alt={item.type}
                                                    style={styles.matchedImage}
                                                />
                                            )}
                                            <p style={styles.matchedType}>{item.type}</p>
                                            <p style={styles.matchedColor}>{item.color}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button
                            style={{ ...styles.button, backgroundColor: '#666', marginTop: '16px' }}
                            onClick={() => { setResult(null); setSelectedTpo(null); }}
                        >
                            다시 추천받기
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

const styles = {
    page: { backgroundColor: '#f5f5f5', minHeight: '100vh' },
    container: { maxWidth: '800px', margin: '0 auto', padding: '32px 16px' },
    title: { fontSize: '24px', fontWeight: 'bold', color: '#333', margin: '0 0 8px' },
    subtitle: { fontSize: '14px', color: '#888', marginBottom: '24px' },
    section: {
        backgroundColor: 'white', borderRadius: '16px',
        padding: '24px', marginBottom: '24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
    },
    sectionTitle: { fontSize: '18px', fontWeight: 'bold', color: '#333', marginBottom: '16px' },
    tpoGrid: {
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '12px', marginBottom: '24px'
    },
    tpoCard: {
        borderRadius: '12px', padding: '16px', textAlign: 'center',
        cursor: 'pointer', transition: 'all 0.2s', border: '1px solid #f0f0f0'
    },
    tpoEmoji: { fontSize: '28px', margin: '0 0 8px' },
    tpoLabel: { fontSize: '14px', fontWeight: '500', margin: 0 },
    error: { color: 'red', fontSize: '13px', marginBottom: '12px' },
    button: {
        width: '100%', padding: '14px', backgroundColor: '#333',
        color: 'white', border: 'none', borderRadius: '8px',
        fontSize: '16px', cursor: 'pointer', fontWeight: '500'
    },
    styleTag: {
        display: 'inline-block', backgroundColor: '#f0f0f0',
        borderRadius: '20px', padding: '4px 16px',
        fontSize: '13px', color: '#555', marginBottom: '16px'
    },
    outfitGrid: { display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' },
    outfitItem: {
        flex: 1, minWidth: '100px', backgroundColor: '#f9f9f9',
        borderRadius: '8px', padding: '12px', textAlign: 'center'
    },
    outfitLabel: { fontSize: '11px', color: '#888', margin: '0 0 4px' },
    outfitType: { fontSize: '14px', fontWeight: 'bold', color: '#333', margin: '0 0 4px' },
    outfitColor: { fontSize: '12px', color: '#666', margin: 0 },
    descBox: {
        backgroundColor: '#f9f9f9', borderRadius: '8px',
        padding: '16px', marginBottom: '16px'
    },
    desc: { fontSize: '14px', color: '#555', lineHeight: '1.6', margin: 0 },
    matchedSection: { borderTop: '1px solid #f0f0f0', paddingTop: '16px' },
    matchedTitle: { fontSize: '13px', color: '#888', marginBottom: '12px' },
    matchedGrid: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
    matchedCard: { textAlign: 'center' },
    matchedImage: {
        width: '100px', height: '100px',
        objectFit: 'cover', borderRadius: '8px'
    },
    matchedType: { fontSize: '12px', color: '#333', fontWeight: '500', marginTop: '6px' },
    matchedColor: { fontSize: '11px', color: '#888', margin: 0 }
};

export default Recommend;