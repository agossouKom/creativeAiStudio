-- Domaine public + chemin de callback par plateforme (zero-hardcoding) :
-- l'URI de redirection OAuth est construite depuis ces colonnes, avec repli
-- sur APP_PUBLIC_URL et le chemin par défaut si elles sont vides.
ALTER TABLE social_platforms
    ADD COLUMN IF NOT EXISTS base_redirect_url VARCHAR(500),
    ADD COLUMN IF NOT EXISTS callback_path VARCHAR(300);