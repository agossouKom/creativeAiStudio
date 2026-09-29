package com.creativeai.agentteam.repository;

import com.creativeai.agentteam.model.Channel;
import com.creativeai.agentteam.model.enums.ChannelStatus;
import com.creativeai.agentteam.model.enums.ChannelType;
import com.creativeai.agentteam.model.enums.PlatformType;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ChannelRepository extends JpaRepository<Channel, String> {
    List<Channel>     findByAgentIdAndDeletedFalse(String agentId);
    List<Channel>     findByAgentIdAndTypeAndDeletedFalse(String agentId, ChannelType type);
    List<Channel>     findByAgentIdAndStatusAndDeletedFalse(String agentId, ChannelStatus status);
    Optional<Channel> findByIdAndDeletedFalse(String id);
    Optional<Channel> findByIdAndAgentIdAndDeletedFalse(String id, String agentId);
    Optional<Channel> findFirstByAccountIdAndPlatformTypeAndStatusAndDeletedFalse(
            String accountId, PlatformType platformType, ChannelStatus status);

    List<Channel> findByAccountIdAndPlatformTypeAndStatusAndDeletedFalse(
            String accountId, PlatformType platformType, ChannelStatus status);
}
