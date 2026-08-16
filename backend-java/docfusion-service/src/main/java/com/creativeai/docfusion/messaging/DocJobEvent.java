package com.creativeai.docfusion.messaging;

import lombok.*;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocJobEvent {
    private String       jobId;
    private String       userEmail;
    private String       operationType;
    private List<String> fileUrls;
    private String       fileName;
    private Map<String, String> params;
}
