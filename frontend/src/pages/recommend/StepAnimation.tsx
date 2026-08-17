import React from 'react';
import { ChevronRight } from 'lucide-react';
import { WeatherIcon, CalendarIcon, WardrobeIcon, SparkleIcon, CheckIcon } from '../../components/Icons';
import { StarBurstIcon } from '../../components/Icons';
import { AI_STEPS } from './constants';
import { Weather } from './types';

interface Props {
    aiStep: number;
    loading: boolean;
    weather: Weather | null;
}

const STEP_ICONS = [
    (size: number, color: string) => <WeatherIcon desc="구름" color={color} size={size} />,
    (size: number, color: string) => <CalendarIcon color={color} size={size} />,
    (size: number, color: string) => <WardrobeIcon color={color} size={size} />,
    (size: number, color: string) => <SparkleIcon color={color} size={size} />,
    (size: number, color: string) => <StarBurstIcon color={color} size={size} />,
];

function StepAnimation({ aiStep, loading, weather }: Props) {
    const steps = AI_STEPS.map((s, i) => ({
        ...s,
        desc: i === 0 && weather
            ? `오늘 ${Math.round(weather.temp)}℃ ${weather.desc}\n날씨를 확인했어요.`
            : s.desc,
    }));

    return (
        <div style={{ background: 'white', borderRadius: 20, border: '1px solid #eaedf2', padding: '28px 28px 24px', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
                <h3 style={{ fontWeight: 700, fontSize: 16, color: '#1a1a2e', margin: 0 }}>추천 과정 애니메이션</h3>
                <SparkleIcon color="#71b3e5" size={16} />
            </div>

            <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
                {steps.map((step, i) => {
                    const done = aiStep >= i;
                    const active = aiStep === i && loading;
                    const pending = aiStep < i;
                    return (
                        <React.Fragment key={i}>
                            <div style={{
                                flex: 1,
                                background: done ? (active ? 'rgba(113,179,229,0.06)' : '#f8fbfe') : '#fafafa',
                                borderRadius: 14,
                                border: `1.5px solid ${done ? (active ? '#71b3e5' : 'rgba(113,179,229,0.25)') : '#eaedf2'}`,
                                padding: '16px 14px',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
                                opacity: pending ? 0.4 : 1,
                                transition: 'opacity 0.4s ease, background 0.3s, border-color 0.3s',
                                position: 'relative',
                            }}>
                                {/* Step number badge */}
                                <div style={{ position: 'absolute', top: 10, left: 10 }}>
                                    <div style={{
                                        width: 22, height: 22, borderRadius: '50%',
                                        background: done ? 'linear-gradient(135deg, #71b3e5, #5a9fd4)' : '#e8ecf0',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        transition: 'background 0.3s ease',
                                    }}>
                                        {done && !active
                                            ? <CheckIcon color="white" size={11} />
                                            : <span style={{ fontWeight: 800, fontSize: 10, color: done ? 'white' : '#aaa' }}>{i + 1}</span>}
                                    </div>
                                </div>

                                {/* Icon */}
                                <div style={{ marginTop: 10 }}>
                                    {STEP_ICONS[i](36, done ? '#71b3e5' : '#ccc')}
                                </div>

                                {/* Label */}
                                <p style={{
                                    fontWeight: 700, fontSize: 12, color: done ? '#1a1a2e' : '#bbb',
                                    margin: 0, textAlign: 'center',
                                    transition: 'color 0.3s ease',
                                }}>
                                    {step.label}
                                    {active && <span style={{ color: '#71b3e5' }}>…</span>}
                                </p>

                                {/* Description */}
                                <p style={{
                                    fontSize: 11, color: done ? '#888' : '#ccc',
                                    margin: 0, textAlign: 'center', lineHeight: 1.55,
                                    whiteSpace: 'pre-line',
                                    transition: 'color 0.3s ease',
                                }}>
                                    {step.desc}
                                </p>
                            </div>

                            {i < steps.length - 1 && (
                                <div style={{ display: 'flex', alignItems: 'center', padding: '0 4px', flexShrink: 0 }}>
                                    <ChevronRight size={16} color={aiStep > i ? '#71b3e5' : '#ccc'} strokeWidth={2} style={{ transition: 'color 0.3s' }} />
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
}

export default StepAnimation;
