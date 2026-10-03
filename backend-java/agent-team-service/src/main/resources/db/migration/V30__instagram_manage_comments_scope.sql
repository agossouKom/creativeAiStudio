-- Permission Instagram manquante pour les webhooks de commentaires.
--
-- V26 a semé la ligne « instagram » avec :
--   instagram_basic, instagram_business_content_publish, instagram_content_publish,
--   pages_show_list, pages_read_engagement
-- mais SANS instagram_manage_comments. Or cette permission est celle qui
-- autorise le champ « comments » du webhook Instagram (documentation Meta :
-- comments ← instagram_manage_comments / pages_manage_metadata /
-- pages_read_engagement / pages_show_list). Sans elle, l'abonnement au champ
-- « comments » est refusé, ou les notifications ne sont jamais livrées — sans
-- la moindre erreur visible de notre côté.
--
-- Elle est de toute façon déjà nécessaire au fonctionnement : l'agent lit les
-- commentaires (InstagramService.fetchComments) et y répond
-- (InstagramService.replyToComment, outil reply_instagram_comment). La
-- connexionFonctionnait donc en lecture seulement sur les comptes qui
-- l'avaient accordée via App Review.
--
-- Écriture par expression régulière plutôt que par cast jsonb : `scopes` est un
-- TEXT libre que l'administrateur saisit dans le dashboard, et un cast
-- échouerait sur une saisie malformée en bloquant le démarrage du service.
-- Seules les lignes dépourvues du scope sont réécrites : une liste saisie à la
-- main est préservée telle quelle. La seconde regexp retire la virgule orpheline
-- que laisserait un tableau vide.
UPDATE social_platforms
   SET scopes = regexp_replace(
         regexp_replace(scopes, '^\[\s*', '["instagram_manage_comments", '),
         ',\s*\]', ']')
 WHERE id = 'instagram'
   AND scopes NOT LIKE '%instagram_manage_comments%';