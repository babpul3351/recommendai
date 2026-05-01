package com.capstone.recommendai.repository;

import com.capstone.recommendai.entity.WardrobeItem;
import com.capstone.recommendai.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface WardrobeRepository extends JpaRepository<WardrobeItem, Long> {
    // 사용자별 옷장 전체 조회
    List<WardrobeItem> findByUser(User user);

    // 사용자별 카테고리 필터 조회
    List<WardrobeItem> findByUserAndCategory(User user, String category);

    // 사용자별 아이템 수
    long countByUser(User user);
}