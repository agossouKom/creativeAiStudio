package com.creativeai.auth.repository;

import com.creativeai.auth.model.UserClient;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface UserClientRepository extends JpaRepository<UserClient, String> {
    List<UserClient> findByUserIdAndDeletedFalse(String userId);
    List<UserClient> findByUserIdAndDeletedTrue(String userId);
}
