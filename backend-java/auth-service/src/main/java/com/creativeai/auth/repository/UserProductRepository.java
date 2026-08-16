package com.creativeai.auth.repository;

import com.creativeai.auth.model.UserProduct;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface UserProductRepository extends JpaRepository<UserProduct, String> {
    List<UserProduct> findByUserIdAndDeletedFalse(String userId);
    List<UserProduct> findByUserIdAndDeletedTrue(String userId);
    Optional<UserProduct> findByCodeAndUserIdAndDeletedFalse(String code, String userId);
}
