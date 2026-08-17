export const TPO_LIST = [
    { key: '데이트', color: '#FF6B9D' },
    { key: '직장',   color: '#4A90D9' },
    { key: '캐주얼', color: '#7EC8A4' },
    { key: '운동',   color: '#F5A623' },
    { key: '파티',   color: '#9B59B6' },
    { key: '여행',   color: '#1ABC9C' },
    { key: '일상',   color: '#95A5A6' },
    { key: '격식',   color: '#34495E' },
];

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export const CAT_COLOR: Record<string, string> = {
    '상의': '#4CAF8A', '하의': '#4A90D9', '아우터': '#E8832A', '원피스': '#E91E8C',
};

export const TPO_COLORS: Record<string, string> = {
    '데이트': '#FF6B9D', '직장': '#4A90D9', '캐주얼': '#7EC8A4',
    '운동': '#F5A623', '파티': '#BD10E0', '여행': '#50E3C2', '일상': '#9B9B9B', '격식': '#4A4A4A',
};

export const AI_STEPS: { label: string; desc: string }[] = [
    { label: '날씨 분석',   desc: '날씨를 확인하고 있어요.' },
    { label: '일정 분석',   desc: '오늘의 일정을 살펴보고 있어요.' },
    { label: '내 옷장 확인', desc: '어울리는 아이템을 찾고 있어요.' },
    { label: '코디 조합',   desc: '코디를 조합하고 있어요.' },
    { label: '추천 완료',   desc: '추천이 완료됐어요!' },
];
