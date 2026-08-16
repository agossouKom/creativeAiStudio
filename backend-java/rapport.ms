.TL
Rapport d'Architecture Backend - MediaSearchAI
.AU
MediaSearchAI Development Team
.ND
.NH 1
Architecture Globale des Microservices
.PP
Le backend est concu sur une architecture distribuee pour garantir la scalabilite et la separation des responsabilites. Les principaux composants sont:
.IP \[bu] 2
API Gateway (Port 8080) : Gardien du systeme et routeur. Gere la securite (JWT) et la limitation de debit (Redis).
.IP \[bu] 2
Auth Service (Port 8081) : Coeur metier. Gere les utilisateurs, CRM, catalogue e-commerce et marketing. Base de donnees PostgreSQL.
.IP \[bu] 2
Search Service (Port 8082) : Moteur de recherche asynchrone utilisant Kafka, WebSockets (temps reel) et MinIO (stockage volumineux).
.NH 1
Etat d'Avancement (Roadmap)
.NH 2
Termine (Ready for Demo)
.PP
- Infrastructure Microservices (Communication Gateway/Services).
.br
- Authentification Avancee (Google Social Login, OTP Email).
.br
- Modele de Donnees complet (20+ entites).
.br
- Gestion de Contenu (CRUD Produits, Categories, Promotions).
.br
- Pipeline de Recherche (Squelette Kafka + WebSocket fonctionnel).
.NH 2
A Faire / En Cours
.PP
- Optimisation du Search Service : Finaliser l'orchestration gRPC avec les modules d'IA.
.br
- Dashboard Analytics : Implementer les calculs statistiques pour l'admin.
.br
- Monitoring & Logs : Centralisation via ELK et Prometheus.
.br
- Tests de Charge : Valider la performance sur Kafka.
.NH 1
Stack Technologique
.PP
- Langage : Java 21
.br
- Framework : Spring Boot 3.2.5 / Spring Cloud
.br
- Base de donnees : PostgreSQL 15
.br
- Messagerie : Apache Kafka
.br
- Cache : Redis
.br
- Stockage Objet : MinIO
.br
- Documentation : SpringDoc / OpenAPI
.PP
Ce document consigne l'etat actuel du systeme et sert de base pour les developpements futurs.
