import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HomeIcon, WardrobeIcon, CalendarIcon, SparkleIcon, UserIcon, EyeIcon } from './Icons';

const BASE_NAV_ITEMS: { path: string; label: string; icon: React.ComponentType<{ color?: string }>; colorBlindOnly?: boolean }[] = [
    { path: '/', label: '홈', icon: HomeIcon },
    { path: '/wardrobe', label: '내 옷장', icon: WardrobeIcon },
    { path: '/calendar', label: '캘린더', icon: CalendarIcon },
    { path: '/recommend', label: 'AI 추천', icon: SparkleIcon },
    { path: '/color-correction', label: '색상 보정 뷰어', icon: EyeIcon, colorBlindOnly: true },
    { path: '/mypage', label: '마이페이지', icon: UserIcon },
];

function Navbar() {
    const location = useLocation();
    const nickname = localStorage.getItem('nickname') || '사용자';
    const [profileImage, setProfileImage] = useState<string | null>(null);
    const [colorType, setColorType] = useState<string>(localStorage.getItem('colorType') || '');
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        const load = () => setProfileImage(localStorage.getItem('profileAvatarImage'));
        load();
        window.addEventListener('profileImageUpdated', load);
        return () => window.removeEventListener('profileImageUpdated', load);
    }, []);

    useEffect(() => {
        const load = () => setColorType(localStorage.getItem('colorType') || '');
        window.addEventListener('colorTypeUpdated', load);
        return () => window.removeEventListener('colorTypeUpdated', load);
    }, []);

    const hasColorDeficiency = colorType && colorType !== 'normal';
    const navItems = BASE_NAV_ITEMS.filter(item => !item.colorBlindOnly || hasColorDeficiency);

    const isActive = (path: string): boolean => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    };

    return (
        <aside style={{
            width: collapsed ? 64 : 270,
            minHeight: '100vh',
            background: 'white',
            borderRight: '1px solid #eaedf2',
            display: 'flex',
            flexDirection: 'column',
            position: 'sticky',
            top: 0,
            height: '100vh',
            flexShrink: 0,
            overflow: 'hidden',
            transition: 'width 0.25s ease',
        }}>
            {/* Logo + toggle button */}
            <div style={{
                padding: collapsed ? '24px 0 16px' : '24px 24px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'space-between',
                minHeight: 80,
            }}>
                {!collapsed && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <img src="/logo.svg" alt="Look at life" style={{ width: 40, height: 40, flexShrink: 0 }} />
                        <span style={{ fontWeight: 700, fontSize: 22, color: '#1a1a2e', letterSpacing: '-0.3px', whiteSpace: 'nowrap' }}>
                            lookatlife
                        </span>
                    </div>
                )}
                {collapsed && (
                    <img src="/logo.svg" alt="Look at life" style={{ width: 36, height: 36 }} />
                )}
                {!collapsed && (
                    <button
                        onClick={() => setCollapsed(true)}
                        title="사이드바 닫기"
                        style={{
                            background: '#f5f7fa', border: 'none', borderRadius: 8,
                            width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: '#888', fontSize: 16, flexShrink: 0,
                            transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#eaedf2'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#f5f7fa'}
                    >
                        ‹
                    </button>
                )}
            </div>

            {/* Expand button when collapsed */}
            {collapsed && (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                    <button
                        onClick={() => setCollapsed(false)}
                        title="사이드바 열기"
                        style={{
                            background: '#f5f7fa', border: 'none', borderRadius: 8,
                            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: '#888', fontSize: 16,
                            transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#eaedf2'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#f5f7fa'}
                    >
                        ›
                    </button>
                </div>
            )}

            {/* Nav */}
            <nav style={{ flex: 1, padding: collapsed ? '0 8px' : '0 12px' }}>
                {!collapsed && (
                    <p style={{
                        fontWeight: 600, fontSize: 12, color: '#aaa',
                        textTransform: 'uppercase', letterSpacing: '0.08em',
                        padding: '0 12px 8px', margin: 0,
                    }}>
                        메뉴
                    </p>
                )}
                {navItems.map(({ path, label, icon: Icon }) => {
                    const active = isActive(path);
                    return (
                        <Link
                            key={path}
                            to={path}
                            title={collapsed ? label : undefined}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: collapsed ? 0 : 12,
                                justifyContent: collapsed ? 'center' : 'flex-start',
                                padding: collapsed ? '10px 0' : '10px 12px',
                                borderRadius: 10,
                                textDecoration: 'none',
                                background: active ? 'linear-gradient(135deg, #71b3e5, #5a9fd4)' : 'transparent',
                                marginBottom: 2,
                                transition: 'background 0.15s',
                                boxSizing: 'border-box',
                            }}
                        >
                            <span style={{ width: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Icon color={active ? 'white' : '#555'} />
                            </span>
                            {!collapsed && (
                                <span style={{
                                    fontWeight: active ? 600 : 400,
                                    fontSize: 14,
                                    color: active ? 'white' : '#444',
                                    whiteSpace: 'nowrap',
                                }}>
                                    {label}
                                </span>
                            )}
                            {!collapsed && active && (
                                <div style={{
                                    marginLeft: 'auto',
                                    width: 6, height: 6,
                                    borderRadius: '50%',
                                    background: 'rgba(255,255,255,0.7)',
                                }} />
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            {!collapsed && (
                <div style={{ padding: '16px 24px', borderTop: '1px solid #eaedf2' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {profileImage ? (
                            <img src={profileImage} alt="프로필" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                            <div style={{
                                width: 34, height: 34, borderRadius: '50%',
                                background: 'linear-gradient(135deg, #71b3e5, #bae3ff)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 15, fontWeight: 700, color: 'white', flexShrink: 0,
                            }}>
                                {nickname.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 600, fontSize: 15, color: '#1a1a2e', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {nickname}
                            </p>
                        </div>
                    </div>
                </div>
            )}
            {collapsed && (
                <div style={{ padding: '16px 0', borderTop: '1px solid #eaedf2', display: 'flex', justifyContent: 'center' }}>
                    {profileImage ? (
                        <img src={profileImage} alt="프로필" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                        <div style={{
                            width: 34, height: 34, borderRadius: '50%',
                            background: 'linear-gradient(135deg, #71b3e5, #bae3ff)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 15, fontWeight: 700, color: 'white',
                        }}>
                            {nickname.charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>
            )}
        </aside>
    );
}

export default Navbar;
