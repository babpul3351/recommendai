// src/daltonization.ts
//
// 변경 사항 (기존 대비)
// ------------------
// getDaltonizedImageUrl()에 캐싱을 추가.
// 같은 이미지(imageUrl) + 같은 색각 유형(colorType) 조합은
// 이미 한 번 보정한 적이 있으면 서버에 다시 요청하지 않고
// 캐시된 결과를 즉시 반환.
//
// 캐시는 메모리(Map)에 저장되므로 브라우저 탭을 새로고침하면 초기화.
// 같은 세션 안에서 옷장 화면을 여러 번 드나들 때 속도를 크게 개선.
//
// 그 외 함수/타입(ColorType, colorAssistantAPI 호출 방식 등)은
// 기존 파일 그대로 유지.

import { colorAssistantAPI } from './api/api';
import { BASE_URL } from './api/env';

export type ColorType = 'protanopia' | 'deuteranopia' | 'tritanopia';

// ─────────────────────────────────────────────
// [신규] 보정 결과 캐시
// key: `${imageUrl}::${colorType}` → value: Blob URL
// ─────────────────────────────────────────────
const daltonizeCache = new Map<string, string>();

/**
 * 캐시를 비웁니다. (필요 시 다른 컴포넌트에서 호출 가능하도록 export)
 * 예: 로그아웃 시, 또는 색각 유형이 바뀌었을 때 등.
 */
export function clearDaltonizationCache(): void {
    // 메모리 누수 방지를 위해 기존에 만들어둔 Blob URL도 함께 해제
    // [수정] Map.values()를 바로 for...of로 돌면 TS 설정에 따라
    // "downlevelIteration" 에러가 날 수 있어, Array.from()으로 감쌌습니다.
    for (const url of Array.from(daltonizeCache.values())) {
        URL.revokeObjectURL(url);
    }
    daltonizeCache.clear();
}

/**
 * 이미지 URL → 백엔드 Daltonization API → 보정된 Blob URL
 *
 * 같은 (imageUrl, colorType) 조합으로 이미 요청한 적이 있으면
 * 서버 재요청 없이 캐시된 결과를 즉시 반환합니다.
 */
export async function getDaltonizedImageUrl(
    imageUrl: string,
    colorType: ColorType
): Promise<string> {
    const cacheKey = `${imageUrl}::${colorType}`;

    // 캐시 히트 — 서버 요청 없이 바로 반환
    const cached = daltonizeCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    // 1단계: Spring Boot 프록시로 이미지 가져오기 (S3 CORS 우회)
    // S3에 브라우저가 직접 접근하면 CORS 정책에 막히므로,
    // 반드시 백엔드의 /wardrobe/image-proxy를 거쳐야 합니다.
    const token = localStorage.getItem('token');
    const proxyUrl = `${BASE_URL}/wardrobe/image-proxy?url=${encodeURIComponent(imageUrl)}`;

    const imageResponse = await fetch(proxyUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!imageResponse.ok) throw new Error('이미지 불러오기 실패');

    const blob = await imageResponse.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });

    // 2단계: colorAssistantAPI로 보정 요청 (기존 api.ts 구조 그대로 사용)
    const res = await colorAssistantAPI.daltonize(base64, colorType);
    const correctedBase64: string = res.data.corrected;

    // 3단계: corrected base64 → Blob URL
    const base64Data = correctedBase64.includes(',')
        ? correctedBase64.split(',')[1]
        : correctedBase64;

    const byteString = atob(base64Data);
    const byteArray = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
        byteArray[i] = byteString.charCodeAt(i);
    }
    const correctedBlob = new Blob([byteArray], { type: 'image/jpeg' });
    const objectUrl = URL.createObjectURL(correctedBlob);

    // 캐시에 저장 — 다음 요청부터는 서버를 다시 타지 않음
    daltonizeCache.set(cacheKey, objectUrl);

    return objectUrl;
}