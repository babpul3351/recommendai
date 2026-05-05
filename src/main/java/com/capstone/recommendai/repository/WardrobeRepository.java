package com.capstone.recommendai.repository;

import com.capstone.recommendai.entity.User;
import com.capstone.recommendai.entity.WardrobeItem;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface WardrobeRepository extends JpaRepository<WardrobeItem, String> {
    List<WardrobeItem> findByUser(User user);
    List<WardrobeItem> findByUserAndCategory(User user, String category);
    long countByUser(User user);
}