package com.capstone.recommendai.repository;

import com.capstone.recommendai.entity.Recommendation;
import com.capstone.recommendai.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface RecommendationRepository extends JpaRepository<Recommendation, String> {

    // JOIN FETCH — 이력 조회 (N+1 해결)
    @Query("SELECT DISTINCT r FROM Recommendation r " +
            "LEFT JOIN FETCH r.items ri " +
            "LEFT JOIN FETCH ri.matchedWardrobeItem " +
            "WHERE r.user = :user " +
            "ORDER BY r.createdAt DESC")
    List<Recommendation> findByUserWithItemsOrderByCreatedAtDesc(@Param("user") User user);

    // JOIN FETCH — 주간/월간 조회 (N+1 해결)
    @Query("SELECT DISTINCT r FROM Recommendation r " +
            "LEFT JOIN FETCH r.items ri " +
            "LEFT JOIN FETCH ri.matchedWardrobeItem " +
            "WHERE r.user = :user " +
            "AND r.outfitDate BETWEEN :start AND :end")
    List<Recommendation> findByUserAndOutfitDateBetweenWithItems(
            @Param("user") User user,
            @Param("start") java.time.LocalDate start,
            @Param("end") java.time.LocalDate end);

    List<Recommendation> findByUserOrderByCreatedAtDesc(User user);
    List<Recommendation> findByUserAndOutfitDateBetween(
            User user, java.time.LocalDate start, java.time.LocalDate end);
    List<Recommendation> findByUserAndOutfitDate(
            User user, java.time.LocalDate date);
}