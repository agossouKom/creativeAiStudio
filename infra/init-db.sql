-- Créer les bases de données pour chaque service Java
CREATE DATABASE creativeai_auth;
CREATE DATABASE creativeai_search;
CREATE DATABASE creativeai_docfusion;

-- Base de données RxResume (CV Builder pro)
CREATE DATABASE rxresume;

-- Base de données Penpot (éditeur design identité visuelle)
CREATE DATABASE penpot;

-- RAG Service database
CREATE DATABASE creativeai_rag;
\c creativeai_rag;
CREATE EXTENSION IF NOT EXISTS vector;

-- Agent Team Service database
CREATE DATABASE creativeai_agents;

-- Generation Service database (générations vidéo/image + publications sociales)
CREATE DATABASE creativeai_generation;
