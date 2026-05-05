package com.capstone.recommendai.repository;

import com.capstone.recommendai.entity.FashionDbItem;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface FashionDbItemRepository extends JpaRepository<FashionDbItem, Integer> {
    List<FashionDbItem> findByCategory(String category);
}