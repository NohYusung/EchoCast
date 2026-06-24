'use client';

import { FormEvent, useMemo, useState } from 'react';
import styles from './page.module.css';

type AuthMode = 'login' | 'signup';
type FieldName = 'name' | 'email' | 'password' | 'confirm';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginHtmlPage() {
    const [mode, setMode] = useState<AuthMode>('login');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [remember, setRemember] = useState(true);
    const [agree, setAgree] = useState(false);
    const [visible, setVisible] = useState<Record<'password' | 'confirm', boolean>>({
        password: false,
        confirm: false,
    });
    const [errors, setErrors] = useState<Partial<Record<FieldName | 'agree', boolean>>>({});
    const [toast, setToast] = useState('');

    const strength = useMemo(() => {
        if (!password) {
            return 0;
        }
        let score = 0;
        if (password.length >= 8) {
            score += 1;
        }
        if (/[A-Z]/.test(password) || /[^a-zA-Z0-9]/.test(password)) {
            score += 1;
        }
        if (/[0-9]/.test(password) && password.length >= 10) {
            score += 1;
        }
        return Math.max(1, score);
    }, [password]);

    const showToast = (message: string) => {
        setToast(message);
        window.setTimeout(() => setToast((current) => (current === message ? '' : current)), 2200);
    };

    const switchMode = (nextMode: AuthMode) => {
        setMode(nextMode);
        setErrors({});
    };

    const clearFieldError = (field: FieldName | 'agree') => {
        setErrors((current) => {
            if (!current[field]) {
                return current;
            }
            const next = { ...current };
            delete next[field];
            return next;
        });
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const nextErrors: Partial<Record<FieldName | 'agree', boolean>> = {};
        if (!emailPattern.test(email.trim())) {
            nextErrors.email = true;
        }
        if (password.length < 8) {
            nextErrors.password = true;
        }
        if (mode === 'signup') {
            if (!name.trim()) {
                nextErrors.name = true;
            }
            if (!password || confirm !== password) {
                nextErrors.confirm = true;
            }
            if (!agree) {
                nextErrors.agree = true;
            }
        }

        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) {
            return;
        }

        showToast(mode === 'login' ? '로그인 중...' : '계정을 만드는 중...');
    };

    return (
        <main className={styles.page}>
            <div className={styles.titlebar} aria-hidden="true">
                <span className={styles.traffic}>
                    <i className={styles.red} />
                    <i className={styles.yellow} />
                    <i className={styles.green} />
                </span>
            </div>

            <section className={`${styles.shell} ${mode === 'signup' ? styles.signupMode : ''}`} aria-label="DobeDub 로그인">
                <div className={styles.logo}>
                    <span className={styles.wordmark}>
                        dobe<span>dub</span><b>.</b>
                    </span>
                    <span className={styles.rule} />
                    <span className={styles.kor}>VOICEBANK</span>
                </div>

                <div className={styles.tabs} role="tablist" aria-label="인증 방식">
                    <button
                        className={mode === 'login' ? styles.activeTab : undefined}
                        type="button"
                        role="tab"
                        aria-selected={mode === 'login'}
                        onClick={() => switchMode('login')}
                    >
                        로그인
                    </button>
                    <button
                        className={mode === 'signup' ? styles.activeTab : undefined}
                        type="button"
                        role="tab"
                        aria-selected={mode === 'signup'}
                        onClick={() => switchMode('signup')}
                    >
                        회원가입
                    </button>
                </div>

                <form className={styles.form} noValidate onSubmit={handleSubmit}>
                    {mode === 'signup' ? (
                        <label className={`${styles.field} ${errors.name ? styles.errorField : ''}`}>
                            <span>이름</span>
                            <input
                                autoComplete="name"
                                placeholder="홍길동"
                                type="text"
                                value={name}
                                onChange={(event) => {
                                    setName(event.target.value);
                                    clearFieldError('name');
                                }}
                            />
                            <em>이름을 입력하세요.</em>
                        </label>
                    ) : null}

                    <label className={`${styles.field} ${errors.email ? styles.errorField : ''}`}>
                        <span>이메일</span>
                        <input
                            autoComplete="email"
                            placeholder="you@studio.com"
                            type="email"
                            value={email}
                            onChange={(event) => {
                                setEmail(event.target.value);
                                clearFieldError('email');
                            }}
                        />
                        <em>올바른 이메일 형식이 아닙니다.</em>
                    </label>

                    <label className={`${styles.field} ${errors.password ? styles.errorField : ''}`}>
                        <span>비밀번호</span>
                        <span className={styles.passwordInput}>
                            <input
                                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                                placeholder="••••••••"
                                type={visible.password ? 'text' : 'password'}
                                value={password}
                                onChange={(event) => {
                                    setPassword(event.target.value);
                                    clearFieldError('password');
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => setVisible((current) => ({ ...current, password: !current.password }))}
                            >
                                {visible.password ? '숨김' : '표시'}
                            </button>
                        </span>
                        {mode === 'signup' ? (
                            <span
                                className={`${styles.strength} ${strength >= 1 ? styles.strengthOne : ''} ${
                                    strength >= 2 ? styles.strengthTwo : ''
                                } ${strength >= 3 ? styles.strengthThree : ''}`}
                                aria-hidden="true"
                            >
                                <i />
                                <i />
                                <i />
                            </span>
                        ) : null}
                        <em>비밀번호는 8자 이상이어야 합니다.</em>
                    </label>

                    {mode === 'signup' ? (
                        <label className={`${styles.field} ${errors.confirm ? styles.errorField : ''}`}>
                            <span>비밀번호 확인</span>
                            <span className={styles.passwordInput}>
                                <input
                                    autoComplete="new-password"
                                    placeholder="••••••••"
                                    type={visible.confirm ? 'text' : 'password'}
                                    value={confirm}
                                    onChange={(event) => {
                                        setConfirm(event.target.value);
                                        clearFieldError('confirm');
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setVisible((current) => ({ ...current, confirm: !current.confirm }))}
                                >
                                    {visible.confirm ? '숨김' : '표시'}
                                </button>
                            </span>
                            <em>비밀번호가 일치하지 않습니다.</em>
                        </label>
                    ) : null}

                    {mode === 'login' ? (
                        <div className={styles.rowBetween}>
                            <label className={styles.check}>
                                <input
                                    checked={remember}
                                    type="checkbox"
                                    onChange={(event) => setRemember(event.target.checked)}
                                />
                                <span className={styles.checkboxIcon}>
                                    <CheckIcon />
                                </span>
                                로그인 유지
                            </label>
                            <button className={styles.linkButton} type="button" onClick={() => showToast('비밀번호 재설정 준비 중입니다.')}>
                                비밀번호 찾기
                            </button>
                        </div>
                    ) : (
                        <div className={styles.signupTerms}>
                            <label className={styles.check}>
                                <input
                                    checked={agree}
                                    type="checkbox"
                                    onChange={(event) => {
                                        setAgree(event.target.checked);
                                        clearFieldError('agree');
                                    }}
                                />
                                <span className={styles.checkboxIcon}>
                                    <CheckIcon />
                                </span>
                                <span>
                                    <button type="button">이용약관</button> 및 <button type="button">개인정보 처리방침</button>에
                                    동의합니다.
                                </span>
                            </label>
                            {errors.agree ? <p>약관에 동의해야 가입할 수 있습니다.</p> : null}
                        </div>
                    )}

                    <button className={styles.submit} type="submit">
                        {mode === 'login' ? '로그인' : '계정 만들기'}
                    </button>
                </form>

                <div className={styles.divider}>OR</div>

                {mode === 'login' ? (
                    <div className={styles.socials}>
                        <SocialButton label="카카오" onClick={() => showToast('카카오(으)로 계속합니다...')}>
                            <KakaoIcon />
                        </SocialButton>
                        <SocialButton label="Google" onClick={() => showToast('Google(으)로 계속합니다...')}>
                            <GoogleIcon />
                        </SocialButton>
                        <SocialButton label="Apple" onClick={() => showToast('Apple(으)로 계속합니다...')}>
                            <AppleIcon />
                        </SocialButton>
                    </div>
                ) : (
                    <div className={styles.socials}>
                        <SocialButton wide label="카카오로 가입" onClick={() => showToast('카카오(으)로 계속합니다...')}>
                            <KakaoIcon />
                        </SocialButton>
                    </div>
                )}
            </section>

            <div className={`${styles.toast} ${toast ? styles.showToast : ''}`} role="status" aria-live="polite">
                <CheckIcon />
                <span>{toast}</span>
            </div>
        </main>
    );
}

function SocialButton({
    children,
    label,
    onClick,
    wide = false,
}: {
    children: React.ReactNode;
    label: string;
    onClick: () => void;
    wide?: boolean;
}) {
    return (
        <button className={`${styles.socialButton} ${wide ? styles.wideSocial : ''}`} type="button" onClick={onClick}>
            {children}
            {label}
        </button>
    );
}

function CheckIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
            <path d="m5 12 5 5L20 7" />
        </svg>
    );
}

function KakaoIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="#FEE500" aria-hidden="true">
            <path d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.9 5.3 4.7 6.7-.2.7-.7 2.6-.8 3-.1.5.2.5.4.4.2-.1 2.6-1.8 3.7-2.5.6.1 1.3.1 2 .1 5.5 0 10-3.6 10-8S17.5 3 12 3Z" />
        </svg>
    );
}

function GoogleIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.6a4.8 4.8 0 0 1-2.1 3.1v2.6h3.4c2-1.8 3.1-4.5 3.1-7.6Z" />
            <path fill="#34A853" d="M12 22c2.8 0 5.1-.9 6.9-2.5l-3.4-2.6c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.6v2.7A10 10 0 0 0 12 22Z" />
            <path fill="#FBBC05" d="M6.2 13.6a6 6 0 0 1 0-3.8V7.1H2.6a10 10 0 0 0 0 9l3.6-2.5Z" />
            <path fill="#EA4335" d="M12 5.9c1.5 0 2.9.5 3.9 1.5l3-3A10 10 0 0 0 2.6 7.1l3.6 2.7C7 7.4 9.3 5.9 12 5.9Z" />
        </svg>
    );
}

function AppleIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M16 13c0-2.3 1.9-3.4 2-3.4-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.8-3.5.8-.7 0-1.8-.8-3-.8-1.5 0-2.9.9-3.7 2.3-1.6 2.7-.4 6.8 1.1 9 .8 1.1 1.7 2.3 2.9 2.2 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.2 0 2-1.1 2.8-2.1.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.5-1-2.5-3.8ZM13.8 6.2c.6-.8 1-1.8.9-2.9-.9 0-2 .6-2.6 1.4-.6.7-1.1 1.7-.9 2.7 1 .1 2-.5 2.6-1.2Z" />
        </svg>
    );
}
