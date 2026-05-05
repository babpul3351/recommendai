package com.capstone.recommendai.repository;

import com.capstone.recommendai.entity.Style;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StyleRepository extends JpaRepository<Style, String> {
}