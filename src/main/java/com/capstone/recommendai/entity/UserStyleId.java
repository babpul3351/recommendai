package com.capstone.recommendai.entity;

import lombok.*;
import java.io.Serializable;

@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@EqualsAndHashCode
public class UserStyleId implements Serializable {
    private String user;
    private String style;
}