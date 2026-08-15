import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../api/api';
import { theme } from '../styles/theme';

const styles: Record<string, React.CSSProperties> = {
    container: {
        display: 'flex', justifyContent: 'center',
        alignItems: 'center', height: '100vh', backgroundColor: theme.colors.background,
        
    },
    box: {
        backgroundColor: theme.colors.white, padding: '40px', borderRadius: theme.radius.md,
        boxShadow: '0 4px 20px rgba(113,179,229,0.15)', width: '360px', textAlign: 'center'
    },
    subtitle: {
        fontSize: theme.font.sm, color: theme.colors.textSub,
        marginBottom: '32px', 
    },
    input: {
        width: '100%', padding: '12px', marginBottom: '12px',
        borderRadius: theme.radius.sm, border: `1px solid ${theme.colors.border}`,
        fontSize: theme.font.md, boxSizing: 'border-box', 
        outline: 'none',
    },
    button: {
        width: '100%', padding: '12px',
        background: `linear-gradient(135deg, ${theme.colors.primary}, #5a9fd4)`,
        color: theme.colors.white, border: 'none', borderRadius: theme.radius.sm,
        fontSize: theme.font.md, cursor: 'pointer', marginTop: '8px',
         fontWeight: 600, letterSpacing: '0.5px',
    },
    error: { color: theme.colors.danger, fontSize: theme.font.sm, marginBottom: '8px' },
    link: { marginTop: '20px', fontSize: theme.font.sm, color: theme.colors.textSub }
};

function Login() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ loginId: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await authAPI.login(form);
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('userId', res.data.userId);
            localStorage.setItem('nickname', res.data.nickname);
            navigate('/');
        } catch (err) {
            setError('아이디 또는 비밀번호가 올바르지 않습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.box}>
                <img
                    src="/logo%203.svg"
                    alt="Look at Life"
                    style={{ width: 240, height: 'auto', marginBottom: '16px' }}
                />
                <p style={styles.subtitle}>AI 스마트 옷장 추천 서비스</p>
                <form onSubmit={handleSubmit}>
                    <input
                        style={styles.input}
                        type="text"
                        name="loginId"
                        placeholder="아이디"
                        value={form.loginId}
                        onChange={handleChange}
                        required
                    />
                    <input
                        style={styles.input}
                        type="password"
                        name="password"
                        placeholder="비밀번호"
                        value={form.password}
                        onChange={handleChange}
                        required
                    />
                    {error && <p style={styles.error}>{error}</p>}
                    <button style={styles.button} type="submit" disabled={loading}>
                        {loading ? '로그인 중...' : '로그인'}
                    </button>
                </form>
                <p style={styles.link}>
                    계정이 없으신가요?{' '}
                    <Link to="/signup" style={{ color: theme.colors.primary, fontWeight: 600 }}>
                        회원가입
                    </Link>
                </p>
            </div>
        </div>
    );
}

export default Login;
