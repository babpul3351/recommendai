package com.capstone.recommendai.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "user_style")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
@IdClass(UserStyleId.class)
public class UserStyle {

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "style_code")
    private Style style;
}