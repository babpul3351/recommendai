import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { weatherAPI, wardrobeAPI } from '../api/api';

function Home() {
    const navigate = useNavigate();
    const [weather, setWeather] = useState(null);
    const [recommendation, setRecommendation] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchWeather();
    }, []);

    const fetchWeather = async () => {
        try {
            const res = await weatherAPI.getWeather();
            setWeather(res.data);
        } catch (err) {
            console.error('날씨 조회 실패', err);
        }
    };

    const fetchRecommendation = async () => {
        setLoading(true);
        try {
            const res = await wardrobeAPI.recommend({
                tpo: '일상',
                mode: 'rag',
                linkedEvents: []
            });
            setRecommendation(res.data);
        } catch (err) {
            console.error('추천 실패', err);
        } finally {
            setLoading(false);
        }
    };

    const getWeatherEmoji = (desc) => {
        if (!desc) return '🌤️';
        if (desc.includes('맑')) return '☀️';
        if (desc.includes('구름')) return '⛅';
        if (desc.includes('비')) return '🌧️';
        if (desc.includes('눈')) return '❄️';
        if (desc.includes('흐림')) return '☁️';
        return '🌤️';
    };

    return (
        <div style={styles.page}>
            <Navbar />
            <div style={styles.container}>

                {/* 날씨 카드 */}
                <div style={styles.weatherCard}>
                    {weather ? (
                        <>
                            <div style={styles.weatherEmoji}>
                                {getWeatherEmoji(weather.desc)}
                            </div>
                            <div style={styles.weatherInfo}>
                                <p style={styles.weatherCity}>{weather.city}</p>
                                <p style={styles.weatherTemp}>{weather.temp}°C</p>
                                <p style={styles.weatherDesc}>{weather.desc}</p>
                                <p style={styles.weatherDetail}>
                                    체감 {weather.feelsLike}°C · 습도 {weather.humidity}%
                                </p>
                            </div>
                        </>
                    ) : (
                        <p style={{ color: '#888' }}>날씨 정보를 불러오는 중...</p>
                    )}
                </div>

                {/* 오늘의 코디 추천 */}
                <div style={styles.section}>
                    <h2 style={styles.sectionTitle}>오늘의 추천 코디</h2>
                    {!recommendation ? (
                        <div style={styles.emptyBox}>
                            <p style={styles.emptyText}>
                                AI가 오늘 날씨와 내 옷장을 분석해서 코디를 추천해드려요
                            </p>
                            <button
                                style={styles.button}
                                onClick={fetchRecommendation}
                                disabled={loading}
                            >
                                {loading ? '추천 중...' : '오늘의 코디 추천받기'}
                            </button>
                        </div>
                    ) : (
                        <div style={styles.recommendCard}>
                            <div style={styles.outfitGrid}>
                                {recommendation.outfit.top && (
                                    <div style={styles.outfitItem}>
                                        <p style={styles.outfitLabel}>상의</p>
                                        <p style={styles.outfitType}>{recommendation.outfit.top.type}</p>
                                        <p style={styles.outfitColor}>{recommendation.outfit.top.color}</p>
                                    </div>
                                )}
                                {recommendation.outfit.bottom && (
                                    <div style={styles.outfitItem}>
                                        <p style={styles.outfitLabel}>하의</p>
                                        <p style={styles.outfitType}>{recommendation.outfit.bottom.type}</p>
                                        <p style={styles.outfitColor}>{recommendation.outfit.bottom.color}</p>
                                    </div>
                                )}
                                {recommendation.outfit.outer && (
                                    <div style={styles.outfitItem}>
                                        <p style={styles.outfitLabel}>아우터</p>
                                        <p style={styles.outfitType}>{recommendation.outfit.outer.type}</p>
                                        <p style={styles.outfitColor}>{recommendation.outfit.outer.color}</p>
                                    </div>
                                )}
                            </div>
                            <p style={styles.outfitDesc}>{recommendation.outfit.description}</p>
                            {recommendation.matched_items.length > 0 && (
                                <div style={styles.matchedSection}>
                                    <p style={styles.matchedTitle}>내 옷장에서 매칭된 아이템</p>
                                    <div style={styles.matchedGrid}>
                                        {recommendation.matched_items.map((item, i) => (
                                            <div key={i} style={styles.matchedItem}>
                                                {item.imageB64 && (
                                                    <img
                                                        src={item.imageB64}
                                                        alt={item.type}
                                                        style={styles.matchedImage}
                                                    />
                                                )}
                                                <p style={styles.matchedType}>{item.type}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <button
                                style={{ ...styles.button, marginTop: '16px', backgroundColor: '#666' }}
                                onClick={() => setRecommendation(null)}
                            >
                                다시 추천받기
                            </button>
                        </div>
                    )}
                </div>

                {/* 바로가기 */}
                <div style={styles.section}>
                    <h2 style={styles.sectionTitle}>바로가기</h2>
                    <div style={styles.shortcutGrid}>
                        <div style={styles.shortcut} onClick={() => navigate('/wardrobe')}>
                            <p style={styles.shortcutIcon}>👗</p>
                            <p style={styles.shortcutLabel}>내 옷장</p>
                        </div>
                        <div style={styles.shortcut} onClick={() => navigate('/recommend')}>
                            <p style={styles.shortcutIcon}>✨</p>
                            <p style={styles.shortcutLabel}>코디 추천</p>
                        </div>
                        <div style={styles.shortcut} onClick={() => navigate('/calendar')}>
                            <p style={styles.shortcutIcon}>📅</p>
                            <p style={styles.shortcutLabel}>캘린더</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

const styles = {
    page: { backgroundColor: '#f5f5f5', minHeight: '100vh' },
    container: { maxWidth: '800px', margin: '0 auto', padding: '32px 16px' },
    weatherCard: {
        display: 'flex', alignItems: 'center', gap: '24px',
        backgroundColor: 'white', borderRadius: '16px',
        padding: '24px', marginBottom: '24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
    },
    weatherEmoji: { fontSize: '64px' },
    weatherInfo: {},
    weatherCity: { fontSize: '14px', color: '#888', margin: '0 0 4px' },
    weatherTemp: { fontSize: '48px', fontWeight: 'bold', color: '#333', margin: '0 0 4px' },
    weatherDesc: { fontSize: '16px', color: '#555', margin: '0 0 4px' },
    weatherDetail: { fontSize: '13px', color: '#888', margin: 0 },
    section: {
        backgroundColor: 'white', borderRadius: '16px',
        padding: '24px', marginBottom: '24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
    },
    sectionTitle: { fontSize: '18px', fontWeight: 'bold', color: '#333', marginBottom: '16px' },
    emptyBox: { textAlign: 'center', padding: '32px 0' },
    emptyText: { color: '#888', fontSize: '14px', marginBottom: '16px' },
    button: {
        padding: '12px 24px', backgroundColor: '#333', color: 'white',
        border: 'none', borderRadius: '8px', fontSize: '15px',
        cursor: 'pointer', fontWeight: '500'
    },
    recommendCard: {},
    outfitGrid: { display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' },
    outfitItem: {
        flex: 1, minWidth: '100px', backgroundColor: '#f9f9f9',
        borderRadius: '8px', padding: '12px', textAlign: 'center'
    },
    outfitLabel: { fontSize: '11px', color: '#888', margin: '0 0 4px' },
    outfitType: { fontSize: '14px', fontWeight: 'bold', color: '#333', margin: '0 0 4px' },
    outfitColor: { fontSize: '12px', color: '#666', margin: 0 },
    outfitDesc: { fontSize: '14px', color: '#555', lineHeight: '1.6', marginBottom: '16px' },
    matchedSection: { borderTop: '1px solid #f0f0f0', paddingTop: '16px' },
    matchedTitle: { fontSize: '13px', color: '#888', marginBottom: '12px' },
    matchedGrid: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
    matchedItem: { textAlign: 'center' },
    matchedImage: { width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px' },
    matchedType: { fontSize: '12px', color: '#666', marginTop: '4px' },
    shortcutGrid: { display: 'flex', gap: '16px' },
    shortcut: {
        flex: 1, backgroundColor: '#f9f9f9', borderRadius: '12px',
        padding: '20px', textAlign: 'center', cursor: 'pointer'
    },
    shortcutIcon: { fontSize: '32px', margin: '0 0 8px' },
    shortcutLabel: { fontSize: '14px', color: '#333', fontWeight: '500', margin: 0 }
};

export default Home;