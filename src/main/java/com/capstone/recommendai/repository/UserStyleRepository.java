package com.capstone.recommendai.repository;

import com.capstone.recommendai.entity.User;
import com.capstone.recommendai.entity.UserStyle;
import com.capstone.recommendai.entity.UserStyleId;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface UserStyleRepository extends JpaRepository<UserStyle, UserStyleId> {
    List<UserStyle> findByUser(User user);
    void deleteByUser(User user);
}