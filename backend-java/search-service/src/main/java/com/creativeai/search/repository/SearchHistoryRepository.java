package com.creativeai.search.repository;

import com.creativeai.search.model.SearchHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SearchHistoryRepository extends JpaRepository<SearchHistory, Long> {
    List<SearchHistory> findByUserEmailOrderByCreatedAtDesc(String userEmail);
    Optional<SearchHistory> findByJobId(String jobId);
}
