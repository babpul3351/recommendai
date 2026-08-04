import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../api/api';

const STYLES = ['casual', 'formal', 'business', 'lovely', 'feminine', 'sporty', 'comfort'];
const STYLE_LABELS: Record<string, string> = {
    casual: '캐주얼', formal: '포멀', business: '비즈니스',
    lovely: '러블리', feminine: '페미닌', sporty: '스포티', comfort: '컴포트'
};

const styles: Record<string, React.CSSProperties> = {
    container: {
        display: 'flex', justifyContent: 'center',
        alignItems: 'center', minHeight: '100vh', backgroundColor: '#f5f5f5'
    },
    box: {
        backgroundColor: 'white', padding: '40px', borderRadius: '12px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)', width: '360px'
    },
    title: { fontSize: '24px', fontWeight: 'bold', textAlign: 'center', marginBottom: '24px' },
    input: {
        width: '100%', padding: '12px', marginBottom: '12px',
        borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box'
    },
    label: { fontSize: '14px', color: '#555', marginBottom: '8px' },
    styleGrid: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' },
    styleBtn: { padding: '8px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '13px' },
    button: {
        width: '100%', padding: '12px', backgroundColor: '#333', color: 'white',
        border: 'none', borderRadius: '8px', fontSize: '16px', cursor: 'pointer'
    },
    error: { color: 'red', fontSize: '13px', marginBottom: '8px' },
    link: { marginTop: '20px', fontSize: '14px', color: '#666', textAlign: 'center' }
};

interface SignupForm {
    loginId: string;
    nickname: string;
    ageGroup: string;
    gender: string;
    password: string;
    styles: string[];
}

function Signup() {
    const navigate = useNavigate();
    const [form, setForm] = useState<SignupForm>({
        loginId: '',
        nickname: '',
        ageGroup: '20대',
        gender: '여성',
        password: '',
        styles: []
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const toggleStyle = (style: string) => {
        if (form.styles.includes(style)) {
            setForm({ ...form, styles: form.styles.filter(s => s !== style) });
        } else if (form.styles.length < 3) {
            setForm({ ...form, styles: [...form.styles, style] });
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (form.styles.length === 0) {
            setError('스타일을 최소 1개 선택해주세요.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const res = await authAPI.signup(form);
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('userId', res.data.userId);
            localStorage.setItem('nickname', res.data.nickname);
            navigate('/');
        } catch (err) {
            setError('회원가입에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.box}>
                <h1 style={styles.title}>회원가입</h1>
                <form onSubmit={handleSubmit}>
                    <select style={styles.input} name="ageGroup" value={form.ageGroup} onChange={handleChange}>
                        {['10대','20대','30대','40대','50대이상'].map(a => (
                            <option key={a} value={a}>{a}</option>
                        ))}
                    </select>
                    <select style={styles.input} name="gender" value={form.gender} onChange={handleChange}>
                        <option value="여성">여성</option>
                        <option value="남성">남성</option>
                    </select>
                    <input
                        style={styles.input}
                        type="text"
                        name="loginId"
                        placeholder="아이디 (4~20자)"
                        value={form.loginId}
                        onChange={handleChange}
                        required
                        minLength={4}
                        maxLength={20}
                    />
                    <input
                        style={styles.input}
                        type="text"
                        name="nickname"
                        placeholder="닉네임 (2~20자)"
                        value={form.nickname}
                        onChange={handleChange}
                        required
                        minLength={2}
                        maxLength={20}
                    />
                    <input
                        style={styles.input} type="password" name="password"
                        placeholder="비밀번호 (8자 이상)" value={form.password}
                        onChange={handleChange} required minLength={8}
                    />
                    <p style={styles.label}>선호 스타일 선택 (최대 3개)</p>
                    <div style={styles.styleGrid}>
                        {STYLES.map(s => (
                            <button key={s} type="button"
                                    style={{
                                        ...styles.styleBtn,
                                        backgroundColor: form.styles.includes(s) ? '#333' : '#f0f0f0',
                                        color: form.styles.includes(s) ? 'white' : '#333'
                                    }}
                                    onClick={() => toggleStyle(s)}
                            >
                                {STYLE_LABELS[s]}
                            </button>
                        ))}
                    </div>
                    {error && <p style={styles.error}>{error}</p>}
                    <button style={styles.button} type="submit" disabled={loading}>
                        {loading ? '처리 중...' : '회원가입'}
                    </button>
                </form>
                <p style={styles.link}>
                    이미 계정이 있으신가요? <Link to="/login">로그인</Link>
                </p>
            </div>
        </div>
    );
}

export default Signup;
