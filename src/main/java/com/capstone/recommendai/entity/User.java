package com.capstone.recommendai.entity;

/*
 * 변경 사항: correctionEnabled 필드 추가
 * 색각 보정 토글의 on/off 상태를 서버 DB에 영구 저장하기 위한 컬럼입니다.
 * 기존에는 프론트 로컬 state로만 관리되어, 화면 재진입 시 매번 초기화되는 문제가 있었습니다.
 *
 * 적용 방법: 기존 User.java 파일 전체를 이 내용으로 교체하세요.
 */

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "users")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class User {

    @Id
    @Column(name = "user_id", length = 36)
    private String userId;

    @Column(name = "age_group", nullable = false, length = 10)
    private String ageGroup;

    @Column(nullable = false, length = 5)
    private String gender;

    @Column(nullable = false)
    private String password;

    @Column(name = "color_type", length = 30)
    private String colorType;

    // [신규] 색각 보정 토글 on/off 상태 영구 저장
    @Column(name = "correction_enabled", nullable = false)
    @Builder.Default
    private Boolean correctionEnabled = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "login_id", nullable = false, unique = true, length = 50)
    private String loginId;

    @Column(name = "nickname", nullable = false, length = 50)
    private String nickname;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<UserStyle> userStyles = new ArrayList<>();

    @PrePersist
    public void prePersist() {
        if (this.userId == null) {
            this.userId = UUID.randomUUID().toString();
        }
        if (this.correctionEnabled == null) {
            this.correctionEnabled = false;
        }
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}