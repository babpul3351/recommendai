import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { HomeIcon, WardrobeIcon, CalendarIcon, SparkleIcon, UserIcon } from './Icons';

const navItems: { path: string; label: string; icon: React.ComponentType<{ color?: string }> }[] = [
    { path: '/', label: '홈', icon: HomeIcon },
    { path: '/wardrobe', label: '내 옷장', icon: WardrobeIcon },
    { path: '/calendar', label: '캘린더', icon: CalendarIcon },
    { path: '/recommend', label: 'AI 추천', icon: SparkleIcon },
    { path: '/mypage', label: '마이페이지', icon: UserIcon },
];

function Navbar() {
    const navigate = useNavigate();
    const location = useLocation();
    const nickname = localStorage.getItem('nickname') || '사용자';

    const isActive = (path: string): boolean => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    };

    return (
        <aside style={{
            width: 270,
            minHeight: '100vh',
            background: 'white',
            borderRight: '1px solid #eaedf2',
            display: 'flex',
            flexDirection: 'column',
            position: 'sticky',
            top: 0,
            height: '100vh',
            flexShrink: 0,
        }}>
            {/* Logo */}
            <div style={{ padding: '70px 24px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                        fontFamily: 'Hahmlet, sans-serif',
                        fontWeight: 700,
                        fontSize: 28,
                        color: '#1a1a2e',
                        letterSpacing: '-0.3px',
                    }}>
                        Look at Life
                    </span>
                </div>
            </div>

            {/* Nav */}
            <nav style={{ flex: 1, padding: '0 12px' }}>
                <p style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 600,
                    fontSize: 12,
                    color: '#aaa',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    padding: '0 12px 8px',
                    margin: 0,
                }}>
                    메뉴
                </p>
                {navItems.map(({ path, label, icon: Icon }) => {
                    const active = isActive(path);
                    return (
                        <button
                            key={path}
                            onClick={() => navigate(path)}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                padding: '10px 12px',
                                borderRadius: 10,
                                border: 'none',
                                background: active ? 'linear-gradient(135deg, #71b3e5, #5a9fd4)' : 'transparent',
                                cursor: 'pointer',
                                marginBottom: 2,
                                transition: 'background 0.15s',
                            }}
                        >
                            <span style={{ width: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Icon color={active ? 'white' : '#555'} />
                            </span>
                            <span style={{
                                fontFamily: 'Kedebideri, sans-serif',
                                fontWeight: active ? 600 : 400,
                                fontSize: 14,
                                color: active ? 'white' : '#444',
                            }}>
                                {label}
                            </span>
                            {active && (
                                <div style={{
                                    marginLeft: 'auto',
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    background: 'rgba(255,255,255,0.7)',
                                }} />
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* Footer */}
            <div style={{ padding: '20px 24px', borderTop: '1px solid #eaedf2' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                        width: 34, height: 34, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #71b3e5, #bae3ff)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 15, flexShrink: 0,
                    }}>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                            fontFamily: 'Hahmlet, sans-serif',
                            fontWeight: 600,
                            fontSize: 15,
                            color: '#1a1a2e',
                            margin: 0,
                        }}>
                            {nickname}
                        </p>
                    </div>
                </div>
            </div>
        </aside>
    );
}

export default Navbar;
