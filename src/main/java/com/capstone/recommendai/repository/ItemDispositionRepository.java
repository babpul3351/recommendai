package com.capstone.recommendai.repository;

import com.capstone.recommendai.entity.ItemDisposition;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ItemDispositionRepository extends JpaRepository<ItemDisposition, String> {
    List<ItemDisposition> findByUserId(String userId);
}