package com.capstone.recommendai.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "fashion_db_item")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class FashionDbItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "item_id")
    private Integer itemId;

    @Column(nullable = false, length = 10)
    private String category;

    @Column(name = "article_type", nullable = false, length = 50)
    private String articleType;

    @Column(length = 30)
    private String color;

    @Column(nullable = false, length = 10)
    private String gender;

    @Column(name = "img_path", nullable = false, length = 255)
    private String imgPath;

    @Column(name = "dataset_name", nullable = false, length = 100)
    private String datasetName;
}