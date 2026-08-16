package com.creativeai.agentteam.repository;

import com.creativeai.agentteam.model.KbDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface KbDocumentRepository extends JpaRepository<KbDocument, String> {
    List<KbDocument>     findByKnowledgeBaseIdAndActiveTrue(String kbId);
    Optional<KbDocument> findByIdAndDeletedFalse(String id);
    long                 countByKnowledgeBaseIdAndActiveTrue(String kbId);
    void                 deleteByKnowledgeBaseId(String kbId);
}
