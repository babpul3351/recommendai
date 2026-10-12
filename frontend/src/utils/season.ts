/**
 * 옷장 계절 분류 — ai_server/services/idle_analysis_service.py 의 classify_season 과 동일한 규칙.
 * 두 파일의 키워드 목록은 반드시 함께 수정해야 함. (한쪽만 고치면 화면과 유휴 분석에 오차 발생)
 */
export type Season = 'summer' | 'winter' | 'mid' | 'all';

export const SEASON_LABELS: Record<Season, string> = {
    summer: '여름',
    winter: '겨울',
    mid: '간절기',
    all: '사계절',
};

// 위에서부터 먼저 일치한 그룹이 적용. (설명은 Python 파일의 주석 참고)
const SEASON_KEYWORDS: Array<[Season, string[]]> = [
    ['mid', ['트렌치', 'trench']],
    ['winter', [
        '패딩', 'padding', 'padded', 'puffer', '코트', 'coat', '기모', 'fleece',
        '플리스', '터틀넥', 'turtleneck', '무스탕', 'shearling', 'wool', '울 ',
        '니트', '니타', 'knit', '스웻', '스웨트', '스웨터', 'sweat',
    ]],
    ['mid', [
        '긴팔', 'long sleeve', 'long-sleeve', 'long_sleeve', 'longsleeve',
        '가디건', 'cardigan', '후드', 'hood', '맨투맨',
        '바람막이', 'windbreaker', '자켓', '재킷', 'jacket',
    ]],
    ['summer', [
        '민소매', '나시', 'sleeveless', 'tank', '반팔', 'short sleeve', 'short-sleeve',
        'short_sleeve', '반바지', 'shorts', '린넨', 'linen', '시폰', 'chiffon',
        'off shoulder', '오프숄더',
    ]],
];

export function classifySeason(type?: string | null, category?: string | null): Season {
    const text = `${type ?? ''} ${category ?? ''}`.toLowerCase() + ' ';
    for (const [season, keywords] of SEASON_KEYWORDS) {
        if (keywords.some((k) => text.includes(k))) return season;
    }
    // 키워드가 없는 아우터는 간절기로 가정. (Python 쪽과 동일한 가정)
    if (category === '아우터') return 'mid';
    return 'all';
}

/**
 * 계절 버튼으로 필터링할 때의 포함 규칙.
 * - '사계절' 아이템은 어느 계절 버튼에서도 보임.
 * - 간절기 아이템은 '간절기' 버튼에서만 보임. (여름/겨울 버튼에는 보이지 않음)
 */
export function matchesSeasonFilter(itemSeason: Season, selected: Season | 'ALL'): boolean {
    if (selected === 'ALL') return true;
    return itemSeason === selected || itemSeason === 'all';
}

const VALID_SEASONS: Season[] = ['summer', 'winter', 'mid', 'all'];

/**
 * 사용자가 지정한 계절(DB의 season)이 있으면 그것을, 없으면 이름 키워드로 분류한 값을 사용.
 * 서버(idle_analysis_service.py의 resolve_season)와 같은 규칙.
 */
export function resolveSeason(userSeason?: string | null, type?: string | null, category?: string | null): Season {
    if (userSeason && (VALID_SEASONS as string[]).includes(userSeason)) return userSeason as Season;
    return classifySeason(type, category);
}

/** 사용자가 지정하지 않았고 키워드로도 분류되지 않아 계절을 알 수 없는 경우 */
export function isSeasonUnknown(userSeason?: string | null, type?: string | null, category?: string | null): boolean {
    if (userSeason && (VALID_SEASONS as string[]).includes(userSeason)) return false;
    return classifySeason(type, category) === 'all';
}