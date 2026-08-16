package com.creativeai.auth.repository;

import com.creativeai.auth.model.AgentTask;
import com.creativeai.auth.model.enums.TaskPriority;
import com.creativeai.auth.model.enums.TaskStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AgentTaskRepository extends JpaRepository<AgentTask, String> {

    List<AgentTask>   findByUserIdAndDeletedFalseOrderByCreatedAtDesc(String userId);
    List<AgentTask>   findByUserIdAndStatusAndDeletedFalse(String userId, TaskStatus status);
    List<AgentTask>   findByUserIdAndPriorityAndDeletedFalse(String userId, TaskPriority priority);
    Optional<AgentTask> findByIdAndUserIdAndDeletedFalse(String id, String userId);
}
