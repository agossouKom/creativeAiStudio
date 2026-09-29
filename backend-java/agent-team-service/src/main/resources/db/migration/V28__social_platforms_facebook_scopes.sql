-- Nettoyage des scopes Facebook.
--
-- V26 a semé 'pages_manage_video_posts', qui n'existe pas dans le référentiel
-- des permissions Meta (Graph v26). Le dialog OAuth le signale alors en
-- "Invalid Scopes" et la connexion entière est refusée. Publier sur
-- /{page-id}/feed et /{page-id}/videos ne demande que pages_manage_posts +
-- pages_read_engagement + pages_show_list.
--
-- Seules les lignes réellement concernées sont réécrites : les scopes saisis
-- à la main par l'administrateur sont préservés tels quels.
UPDATE social_platforms
   SET scopes = '["pages_show_list","pages_read_engagement","pages_manage_posts"]'
 WHERE id = 'facebook'
   AND scopes LIKE '%pages_manage_video_posts%';
