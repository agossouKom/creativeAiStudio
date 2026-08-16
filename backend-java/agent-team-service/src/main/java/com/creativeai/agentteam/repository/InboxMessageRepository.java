package com.creativeai.agentteam.repository;

import com.creativeai.agentteam.model.InboxMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InboxMessageRepository extends JpaRepository<InboxMessage, String> {

    @Query(
        value = """
            SELECT * FROM inbox_messages
            WHERE user_id = :userId
              AND deleted = false
              AND (CAST(:agentId    AS text) IS NULL OR agent_id   = CAST(:agentId AS text))
              AND (CAST(:teamId     AS text) IS NULL OR team_id    = CAST(:teamId  AS text))
              AND (CAST(:channel    AS text) IS NULL OR channel    = CAST(:channel AS text))
              AND (CAST(:status     AS text) IS NULL OR status     = CAST(:status  AS text))
              AND (CAST(:direction  AS text) IS NULL OR direction  = CAST(:direction AS text))
              AND (CAST(:convId     AS text) IS NULL OR conversation_id = CAST(:convId AS text))
              AND (CAST(:search     AS text) IS NULL
                   OR body    ILIKE '%' || CAST(:search AS text) || '%'
                   OR subject ILIKE '%' || CAST(:search AS text) || '%'
                   OR from_address ILIKE '%' || CAST(:search AS text) || '%')
            ORDER BY received_at DESC
            """,
        countQuery = """
            SELECT COUNT(*) FROM inbox_messages
            WHERE user_id = :userId
              AND deleted = false
              AND (CAST(:agentId    AS text) IS NULL OR agent_id   = CAST(:agentId AS text))
              AND (CAST(:teamId     AS text) IS NULL OR team_id    = CAST(:teamId  AS text))
              AND (CAST(:channel    AS text) IS NULL OR channel    = CAST(:channel AS text))
              AND (CAST(:status     AS text) IS NULL OR status     = CAST(:status  AS text))
              AND (CAST(:direction  AS text) IS NULL OR direction  = CAST(:direction AS text))
              AND (CAST(:convId     AS text) IS NULL OR conversation_id = CAST(:convId AS text))
              AND (CAST(:search     AS text) IS NULL
                   OR body    ILIKE '%' || CAST(:search AS text) || '%'
                   OR subject ILIKE '%' || CAST(:search AS text) || '%'
                   OR from_address ILIKE '%' || CAST(:search AS text) || '%')
            """,
        nativeQuery = true
    )
    Page<InboxMessage> search(
        @Param("userId")    String userId,
        @Param("agentId")   String agentId,
        @Param("teamId")    String teamId,
        @Param("channel")   String channel,
        @Param("status")    String status,
        @Param("direction") String direction,
        @Param("convId")    String convId,
        @Param("search")    String search,
        Pageable pageable
    );

    /** Messages supprimés de l'utilisateur. */
    @Query(value = "SELECT * FROM inbox_messages WHERE user_id = :userId AND deleted = true ORDER BY updated_at DESC",
           nativeQuery = true)
    Page<InboxMessage> findDeletedByUserId(@Param("userId") String userId, Pageable pageable);

    long countByUserIdAndStatusAndDeletedFalse(String userId, com.creativeai.agentteam.model.enums.InboxStatus status);
}
