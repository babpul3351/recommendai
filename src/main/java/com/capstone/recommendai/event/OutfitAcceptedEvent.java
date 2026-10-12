package com.capstone.recommendai.event;

/**
 * 사용자가 추천 코디 중 하나를 선택(accept)했을 때 발행.
 * 트랜잭션 커밋 이후에 합성 이미지 생성 작업이 시작.
 *
 * @param previousCompositeUrl 이전에 만들어 둔 합성 이미지 URL (없으면 null). 새 결과가 나오면 S3에서 삭제.
 */
public record OutfitAcceptedEvent(String recId, int outfitIndex, String previousCompositeUrl) {
}
