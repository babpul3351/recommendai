package com.capstone.recommendai.repository;

import com.capstone.recommendai.entity.Recommendation;
import com.capstone.recommendai.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface RecommendationRepository extends JpaRepository<Recommendation, String> {
    List<Recommendation> findByUserOrderByCreatedAtDesc(User user);
}