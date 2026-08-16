package com.creativeai.auth.repository;

import com.creativeai.auth.model.ScheduledEmailTask;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ScheduledEmailTaskRepository extends JpaRepository<ScheduledEmailTask, String> {

    List<ScheduledEmailTask> findByUserIdAndDeletedFalse(String userId);
    List<ScheduledEmailTask> findByActiveTrueAndDeletedFalseAndNextRunAtBefore(LocalDateTime now);
    Optional<ScheduledEmailTask> findByIdAndUserIdAndDeletedFalse(String id, String userId);
}
