package com.creativeai.gateway.office;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.Arrays;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/office")
@RequiredArgsConstructor
public class OfficeController {

    private final ReactiveStringRedisTemplate redis;
    private final ObjectMapper objectMapper = new ObjectMapper();

    // OnlyOffice interne (réseau Docker)
    private static final String OO_BASE = "http://onlyoffice:80";
    // URL publique externe (navigateur → nginx proxy)
    private static final String OO_PROXY = "http://localhost:4400/office";
    // URL accessible par OnlyOffice pour télécharger nos fichiers HTML
    private static final String GW_BASE  = "http://api-gateway:8080";

    /**
     * Seuls hôtes acceptés pour l'URL de sortie du callback OnlyOffice, et
     * uniquement en http/https.
     *
     * <p>Ni {@code localhost} ni {@code 127.0.0.1} : le gateway les résout sur
     * lui-même, donc les y autoriser rouvrait la porte à
     * {@code gopher://127.0.0.1:11211/} (Redis) ou aux autres services du
     * conteneur. Le schéma est restreint pour la même raison : un hôte de la
     * listeatteint en {@code file://} n'est pas anodin.
     *
     * <p>Surchargeable par {@code OFFICE_CALLBACK_ALLOWED_HOSTS} (séparés par des
     * virgules) pour un OnlyOffice installé hors du réseau Docker.
     */
    private final Set<String> onlyOfficeHosts;

    public OfficeController(ReactiveStringRedisTemplate redis,
                            @Value("${office.callback.allowed-hosts:onlyoffice}") String allowedHosts) {
        this.redis = redis;
        this.onlyOfficeHosts = Arrays.stream(allowedHosts.split(","))
                .map(String::trim)
                .filter(h -> !h.isEmpty())
                .map(h -> h.toLowerCase(Locale.ROOT))
                .collect(Collectors.toUnmodifiableSet());
        log.info("[OFFICE] Hôtes de callback autorisés : {}", onlyOfficeHosts);
    }

    private final WebClient ooClient  = WebClient.create(OO_BASE);
    /**
     * Client de téléchargement des DOCX, sans suivi de redirection.
     *
     * <p>{@code WebClient.create()} suit les redirections par défaut. Un 302
     * servi par un hôte de la liste blanche contournerait donc le contrôle
     * d'origine et renverrait le gateway chercher n'importe quelle URL.
     */
    private final WebClient webClient = WebClient.builder()
            .clientConnector(new ReactorClientHttpConnector(
                    reactor.netty.http.client.HttpClient.create()
                            .followRedirect(false)))
            .build();

    // ── 1. Upload HTML → Redis ───────────────────────────────────────────────

    @PostMapping(value = "/upload", consumes = MediaType.TEXT_HTML_VALUE)
    public Mono<Map<String, String>> uploadHtml(@RequestBody String html) {
        String key = UUID.randomUUID().toString().replace("-", "");
        return redis.opsForValue()
                .set("office:html:" + key, html, Duration.ofHours(2))
                .doOnSuccess(ok -> log.info("Stored HTML key={}", key))
                .thenReturn(Map.of("key", key));
    }

    // ── 2. Upload HTML + convertir en DOCX via ConvertService ───────────────

    @PostMapping(value = "/upload-convert", consumes = MediaType.TEXT_HTML_VALUE)
    public Mono<Map<String, String>> uploadAndConvert(@RequestBody String html) {
        String key = UUID.randomUUID().toString().replace("-", "");

        return redis.opsForValue()
                .set("office:html:" + key, html, Duration.ofHours(2))
                .flatMap(ok -> {
                    log.info("Stored HTML key={}, calling ConvertService", key);
                    String htmlUrl     = GW_BASE + "/api/office/html/" + key;
                    String convertKey  = "cv-" + key;

                    Map<String, Object> convertReq = Map.of(
                            "async",      false,
                            "filetype",   "html",
                            "outputtype", "docx",
                            "title",      "cv.docx",
                            "url",        htmlUrl,
                            "key",        convertKey
                    );

                    return ooClient.post()
                            .uri("/ConvertService.ashx")
                            .contentType(MediaType.APPLICATION_JSON)
                            .bodyValue(convertReq)
                            .retrieve()
                            .bodyToMono(String.class)  // lecture brute, évite les problèmes de Content-Type
                            .flatMap(rawBody -> {
                                log.info("ConvertService response key={}: {}", key, rawBody);
                                try {
                                    // ConvertService retourne du XML : <FileResult><FileUrl>...</FileUrl></FileResult>
                                    String fileUrl = extractXmlTag(rawBody, "FileUrl");
                                    if (fileUrl != null && !fileUrl.isBlank()) {
                                        // proxyUrl = URL navigateur (pour télécharger depuis le browser)
                                        String proxyUrl = fileUrl
                                                .replace("http://onlyoffice:80", OO_PROXY)
                                                .replace("http://onlyoffice",    OO_PROXY);
                                        // fileUrl (interne Docker) = URL que OnlyOffice server va télécharger
                                        // Le serveur OnlyOffice peut y accéder directement (même réseau Docker)
                                        log.info("ConvertService DOCX ready key={} internal={} proxy={}", key, fileUrl, proxyUrl);
                                        return redis.opsForValue()
                                                .set("office:docurl:" + key, proxyUrl, Duration.ofHours(6))
                                                .thenReturn(Map.of(
                                                        "key",       key,
                                                        "docUrl",    fileUrl,    // URL interne → pour DocEditor (server-side)
                                                        "proxyUrl",  proxyUrl,   // URL proxy  → pour téléchargement browser
                                                        "fileType",  "docx"
                                                ));
                                    }
                                    log.warn("ConvertService no FileUrl key={}", key);
                                } catch (Exception parseErr) {
                                    log.error("ConvertService parse error key={}: {}", key, parseErr.getMessage());
                                }
                                return Mono.just(Map.of(
                                        "key",     key,
                                        "docUrl",  GW_BASE + "/api/office/html/" + key,
                                        "fileType","html"
                                ));
                            })
                            .onErrorResume(e -> {
                                log.error("ConvertService HTTP error key={}: {}", key, e.getMessage());
                                return Mono.just(Map.of(
                                        "key",     key,
                                        "docUrl",  GW_BASE + "/api/office/html/" + key,
                                        "fileType","html"
                                ));
                            });
                });
    }

    // ── 3. Serve HTML to OnlyOffice ──────────────────────────────────────────

    @GetMapping(value = "/html/{key}", produces = MediaType.TEXT_HTML_VALUE)
    public Mono<ResponseEntity<String>> getHtml(@PathVariable String key) {
        return redis.opsForValue()
                .get("office:html:" + key)
                .map(html -> ResponseEntity.ok()
                        .contentType(MediaType.TEXT_HTML)
                        .body(html))
                .defaultIfEmpty(ResponseEntity.notFound().build());
    }

    // ── 4. OnlyOffice callback (sauvegarde) ──────────────────────────────────

    /**
     * Callback de sauvegarde envoyé par OnlyOffice.
     *
     * <p>Aucune authentification n'était appliquée ici, et le gateway n'a pas de
     * Spring Security : n'importe qui pouvait POSTer une URL arbitraire sous une
     * clé de son choix, puis la faire relayer par {@link #downloadDocx}. C'est un
     * SSRF pilotable — metadata cloud ({@code 169.254.169.254}), services
     * internes, ports d'administration.
     *
     * <p>OnlyOffice n'a pas de JWT applicatif à envoyer, donc l'ancrage se fait
     * sur l'origine de la donnée, à deux niveaux :
     * <ol>
     *   <li>la clé doit avoir été émise par ce gateway (un {@code office:html:},
     *       {@code office:docurl:} ou {@code office:docx:} existe) — impossible de
     *       planter une clé inventée ;</li>
     *   <li>l'URL doit pointer vers l'hôte OnlyOffice — impossible de faire
     *       relayer une URL interne, même avec une clé légitime.</li>
     * </ol>
     */
    @PostMapping(value = "/callback")
    public Mono<Map<String, Integer>> callback(
            @RequestParam(required = false) String key,
            @RequestBody Map<String, Object> body) {

        int status = body.get("status") instanceof Number n ? n.intValue() : 0;
        log.info("OnlyOffice callback key={} status={}", key, status);

        if ((status == 2 || status == 6) && key != null) {
            Object urlObj = body.get("url");
            if (urlObj instanceof String docUrl) {
                if (!isOnlyOfficeUrl(docUrl)) {
                    log.warn("[OFFICE] Callback rejeté : URL hors hôte OnlyOffice : {}", docUrl);
                    return Mono.just(Map.of("error", 1));
                }
                return isKeyIssuedByGateway(key)
                        .flatMap(known -> {
                            if (!known) {
                                log.warn("[OFFICE] Callback rejeté : clé {} inconnue du gateway — "
                                        + "tentative de plantage d'URL par un tiers", key);
                                return Mono.just(Map.of("error", 1));
                            }
                            return redis.opsForValue()
                                    .set("office:docx:" + key, docUrl, Duration.ofHours(24))
                                    .thenReturn(Map.of("error", 0));
                        });
            }
        }
        return Mono.just(Map.of("error", 0));
    }

    /** La clé a-t-elle été émise par ce gateway pour un document en cours ? */
    private Mono<Boolean> isKeyIssuedByGateway(String key) {
        return redis.hasKey("office:html:" + key).defaultIfEmpty(false)
                .flatMap(htmlKnown -> {
                    if (htmlKnown) {
                        return Mono.just(true);
                    }
                    return redis.hasKey("office:docurl:" + key).defaultIfEmpty(false)
                            .flatMap(docUrlKnown -> {
                                if (docUrlKnown) {
                                    return Mono.just(true);
                                }
                                return redis.hasKey("office:docx:" + key).defaultIfEmpty(false);
                            });
                });
    }

    /**
     * L'URL de sortie de OnlyOffice doit viser son propre hôte Docker. On compare
     * l'autorité (host:port) pour que {@code http://onlyoffice@169.254.169.254/}
     * — où {@code onlyoffice} se lit comme userinfo — soit refusé.
     */
    private boolean isOnlyOfficeUrl(String url) {
        try {
            java.net.URI uri = java.net.URI.create(url.trim());
            String scheme = uri.getScheme();
            String host = uri.getHost();
            if (scheme == null || host == null || uri.getUserInfo() != null) {
                return false;
            }
            if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) {
                return false;
            }
            return onlyOfficeHosts.contains(host.toLowerCase(Locale.ROOT));
        } catch (Exception e) {
            return false;
        }
    }

    // ── 5. Poll résultat sauvegarde ──────────────────────────────────────────

    @GetMapping("/result/{key}")
    public Mono<ResponseEntity<Map<String, String>>> getResult(@PathVariable String key) {
        return redis.opsForValue()
                .get("office:docx:" + key)
                .map(url -> ResponseEntity.ok(Map.of("url", url, "key", key)))
                .defaultIfEmpty(ResponseEntity.noContent().build());
    }

    // ── 6. Proxy download DOCX (depuis OnlyOffice ou ConvertService) ─────────

    @GetMapping("/download/{key}")
    public Mono<Void> downloadDocx(@PathVariable String key, ServerHttpResponse response) {
        // Cherche d'abord l'URL de la version sauvegardée, sinon celle de la conversion initiale
        return redis.opsForValue().get("office:docx:" + key)
                .switchIfEmpty(redis.opsForValue().get("office:docurl:" + key))
                .flatMap(docUrl -> streamDocx(docUrl, response))
                .switchIfEmpty(Mono.defer(() -> {
                    response.setStatusCode(HttpStatus.NOT_FOUND);
                    return response.setComplete();
                }));
    }

    // Extraction rapide d'un tag XML sans dépendance JAXB
    private String extractXmlTag(String xml, String tag) {
        String open  = "<" + tag + ">";
        String close = "</" + tag + ">";
        int s = xml.indexOf(open);
        int e = xml.indexOf(close);
        if (s < 0 || e < 0) return null;
        return xml.substring(s + open.length(), e)
                  .replace("&amp;", "&")
                  .replace("&lt;", "<")
                  .replace("&gt;", ">")
                  .trim();
    }

    private Mono<Void> streamDocx(String docUrl, ServerHttpResponse response) {
        log.info("Streaming DOCX from {}", docUrl);
        response.setStatusCode(HttpStatus.OK);
        response.getHeaders().setContentType(MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"));
        response.getHeaders().set(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"cv.docx\"");
        Flux<DataBuffer> body = webClient.get().uri(docUrl).retrieve().bodyToFlux(DataBuffer.class);
        return response.writeWith(body);
    }
}
