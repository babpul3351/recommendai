package com.capstone.recommendai.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "style")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Style {

    @Id
    @Column(name = "style_code", length = 20)
    private String styleCode;

    @Column(name = "style_label", nullable = false, length = 20)
    private String styleLabel;
}