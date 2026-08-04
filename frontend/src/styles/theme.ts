export const theme = {
    colors: {
        primary: '#71B3E5',
        primaryLight: '#b1cce1',
        primaryDark: '#2750CA',
        background: '#e1e7eb',
        white: '#FFFFFF',
        text: '#1A1A1A',
        textSub: '#888888',
        textLight: '#AAAAAA',
        border: '#c4d3df',
        cardShadow: '0 2px 12px rgba(126,200,164,0.12)',
        danger: '#FF5A5A',
        blue: '#3017d2',
    },
    radius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        full: '999px',
    },
    fontFamily: {
        heading: 'Hahmlet, sans-serif',
        ui:      'Kedebideri, sans-serif',
        body:    'Inter, sans-serif',
    },
    font: {
        xs: '11px',
        sm: '13px',
        md: '15px',
        lg: '18px',
        xl: '22px',
        xxl: '28px',
    }
} as const;

export type Theme = typeof theme;