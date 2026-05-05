package com.capstone.recommendai.repository;

import com.capstone.recommendai.entity.WardrobeEmbedding;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WardrobeEmbeddingRepository extends JpaRepository<WardrobeEmbedding, String> {
}