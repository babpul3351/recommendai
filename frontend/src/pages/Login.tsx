import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../api/api';

const styles: Record<string, React.CSSProperties> = {
    container: {
        display: 'flex', justifyContent: 'center',
        alignItems: 'center', height: '100vh', backgroundColor: '#f5f5f5'
    },
    box: {
        backgroundColor: 'white', padding: '40px', borderRadius: '12px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)', width: '360px', textAlign: 'center'
    },
    title: { fontSize: '28px', fontWeight: 'bold', color: '#333', marginBottom: '8px' },
    subtitle: { fontSize: '14px', color: '#888', marginBottom: '32px' },
    input: {
        width: '100%', padding: '12px', marginBottom: '12px',
        borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box'
    },
    button: {
        width: '100%', padding: '12px', backgroundColor: '#333', color: 'white',
        border: 'none', borderRadius: '8px', fontSize: '16px', cursor: 'pointer', marginTop: '8px'
    },
    error: { color: 'red', fontSize: '13px', marginBottom: '8px' },
    link: { marginTop: '20px', fontSize: '14px', color: '#666' }
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
                    style={{ width: 200, height: 'auto', marginBottom: '16px' }}
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
                    계정이 없으신가요? <Link to="/signup">회원가입</Link>
                </p>
            </div>
        </div>
    );
}

export default Login;
