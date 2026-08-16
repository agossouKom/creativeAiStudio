package com.creativeai.auth.model;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

@Entity
@Table(name = "user_clients",
       indexes = @Index(name = "idx_uc_user", columnList = "user_id"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
public class UserClient extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(length = 50,  nullable = false) private String code;
    @Column(length = 150, nullable = false) private String nom;
    @Column(length = 150) private String prenoms;
    @Column(length = 100) private String contact;
    @Column(length = 150) private String email;
    @Column(length = 200) private String entrepriseName;
}
