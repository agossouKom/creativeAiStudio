import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="privacy-page">
      <!-- HERO -->
      <header class="privacy-hero">
        <div class="privacy-hero-inner">
          <div class="p-badge">Confidentialité &amp; Protection des données</div>
          <h1 class="p-title">Vos données, notre responsabilité</h1>
          <p class="p-sub">
            Creative AI Studio combine reconnaissance multimédia, intelligence
            artificielle et agents autonomes. Cette politique vous explique,
            en toute transparence, ce que nous collectons, pourquoi, et comment
            vous gardez le contrôle.
          </p>
          <div class="p-meta">
            <span class="p-chip">Dernière mise à jour : 29 septembre 2026</span>
            <span class="p-chip">RGPD · GDPR — Conformité UE</span>
            <span class="p-chip">Durée d'application : à partir de sa publication</span>
          </div>
        </div>
        <div class="hero-blob hero-blob-1"></div>
        <div class="hero-blob hero-blob-2"></div>
      </header>

      <div class="privacy-body">
        <!-- SOMMAIRE -->
        <aside class="p-toc">
          <div class="p-toc-title">Sommaire</div>
          <nav>
            <a href="#p1">1 · Responsable du traitement</a>
            <a href="#p2">2 · Données que nous collectons</a>
            <a href="#p3">3 · Finalités &amp; bases légales</a>
            <a href="#p4">4 · Intelligence artificielle &amp; agents</a>
            <a href="#p5">5 · Réseaux sociaux &amp; OAuth</a>
            <a href="#p6">6 · Partage avec des tiers</a>
            <a href="#p7">7 · Conservation des données</a>
            <a href="#p8">8 · Sécurité</a>
            <a href="#p9">9 · Cookies &amp; traceurs</a>
            <a href="#p10">10 · Vos droits</a>
            <a href="#p11">11 · Contact &amp; Délégué</a>
          </nav>
          <div class="p-toc-foot">Questions&nbsp;? Écrivez-nous :<br /><strong>{{ legal.email }}</strong></div>
        </aside>

        <!-- CONTENU -->
        <main class="p-content">
          <section class="p-card" id="p1">
            <div class="p-num">01</div>
            <div class="p-card-body">
              <h2>Responsable du traitement</h2>
              <p>
                Les données sont traitées sous la responsabilité de
                <strong>{{ legal.name }}</strong> ({{ legal.address }}), en qualité de
                responsable de traitement au sens du Règlement (UE) 2016/679 (RGPD)
                et de la loi Informatique et Libertés.
              </p>
              <p>
                Toute question relative à cette politique peut être adressée à
                <a href="mailto:{{ legal.email }}" class="p-link">{{ legal.email }}</a>.
              </p>
            </div>
          </section>

          <section class="p-card" id="p2">
            <div class="p-num">02</div>
            <div class="p-card-body">
              <h2>Données que nous collectons</h2>
              <p>Nous traitons uniquement les données strictement nécessaires au fonctionnement du service&nbsp;:</p>
              <div class="p-grid">
                <div class="p-cell">
                  <h3>Compte</h3>
                  <p>Nom, adresse e-mail, identifiants sécurisés (hash), préférences, historique de facturation.</p>
                </div>
                <div class="p-cell">
                  <h3>Contenus analysés</h3>
                  <p>Médias (audio, vidéo, images, documents) que vous soumettez à la reconnaissance et aux outils de fusion/OCR.</p>
                </div>
                <div class="p-cell">
                  <h3>IA &amp; agents</h3>
                  <p>Prompts, conversations (RAG), CV, documents, projets de génération de contenu et configurations d'agents.</p>
                </div>
                <div class="p-cell">
                  <h3>Sociaux</h3>
                  <p>Jetons d'accès OAuth (chiffrés), pages/personnalités connectées et métadonnées associées.</p>
                </div>
              </div>
              <p class="p-note">
                Nous ne collectons jamais sciemment de données de personnes mineures
                ni de catégories particulières (« données sensibles ») sans base légale dédiée.
              </p>
            </div>
          </section>

          <section class="p-card" id="p3">
            <div class="p-num">03</div>
            <div class="p-card-body">
              <h2>Finalités &amp; bases légales</h2>
              <table class="p-table">
                <thead><tr><th>Finalité</th><th>Base légale</th></tr></thead>
                <tbody>
                  <tr><td>Exécution du service (recherche, génération, agents)</td><td>Contrat (art. 6.1.b)</td></tr>
                  <tr><td>Gestion du compte, support, facturation</td><td>Contrat (art. 6.1.b)</td></tr>
                  <tr><td>Sécurité, lutte contre la fraude, journalisation</td><td>Intérêt légitime (art. 6.1.f)</td></tr>
                  <tr><td>Newsletters et communications (si vous y consentez)</td><td>Consentement (art. 6.1.a)</td></tr>
                  <tr><td>Respect d'obligations légales (comptabilité, justice)</td><td>Obligation légale (art. 6.1.c)</td></tr>
                </tbody>
              </table>
              <p>
                Le consentement peut être retiré à tout moment via les réglages du
                compte ou en nous le demandant. La finalité est toujours proportionnée
                à l'usage du service attendu.
              </p>
            </div>
          </section>

          <section class="p-card" id="p4">
            <div class="p-num">04</div>
            <div class="p-card-body">
              <h2>Intelligence artificielle &amp; agents autonomes</h2>
              <p>
                Notre plateforme orchestre des modèles de langage, des modèles de
                reconnaissance et des agents qui exécutent des tâches en votre nom
                (publication sociale, rédaction, recherche, analyse).
              </p>
              <ul class="p-list">
                <li><strong>Nous n'entraînons pas nos modèles sur vos données.</strong> Vos contenus servent uniquement à produire la réponse demandée, puis sont traités selon les durées de conservation de la section 7.</li>
                <li><strong>Traitement à la demande :</strong> vos prompts et documents sont envoyés à nos fournisseurs d'IA uniquement au moment de l'exécution d'une tâche que vous lancez.</li>
                <li><strong>Révision humaine :</strong> à l'exception du support, aucun être humain n'examine vos données par défaut.</li>
                <li><strong>Agents :</strong> toute action déclenchée par un agent (envoi, publication, délégation) est journalisée et reste consultable dans votre historique.</li>
                <li><strong>Sortie de contenu :</strong> les contenus générés vous appartiennent. Vous restez responsable de leur conformité juridique avant toute diffusion.</li>
              </ul>
              <p class="p-note">
                Conformément à l'article 22 du RGPD, aucune décision automatisée
                produisant des effets juridiques sur vous n'est prise sans intervention humaine.
              </p>
            </div>
          </section>

          <section class="p-card" id="p5">
            <div class="p-num">05</div>
            <div class="p-card-body">
              <h2>Réseaux sociaux &amp; OAuth</h2>
              <p>
                Vous pouvez connecter des comptes externes (Facebook, Instagram,
                TikTok, YouTube, LinkedIn…) afin que vos agents publient ou
                récupèrent du contenu en votre nom.
              </p>
              <ul class="p-list">
                <li><strong>Connexion par consentement :</strong> la liaison n'est possible qu'après votre action explicite dans le parcours de connexion, et uniquement dans la limite des permissions que vous acceptez.</li>
                <li><strong>Jetons chiffrés :</strong> les accès OAuth sont stockés chiffrés (AES-256) ; vos mots de passe de réseaux sociaux ne transitent jamais par notre plateforme.</li>
                <li><strong>Usages :</strong> publication planifiée, commentaires, statistiques de page — jamais de lecture de vos conversations privées hors de l'étendue consentie.</li>
                <li><strong>Déconnexion :</strong> vous pouvez révoquer une plateforme à tout moment depuis vos paramètres ; Meta peut aussi nous notifier une révocation (webhook de désautorisation) que nous honorons immédiatement.</li>
              </ul>
              <p>
                La politique et les paramètres de confidentialité des plateformes
                concernées restent régis par leurs propres conditions.
              </p>
            </div>
          </section>

          <section class="p-card" id="p6">
            <div class="p-num">06</div>
            <div class="p-card-body">
              <h2>Partage avec des tiers</h2>
              <table class="p-table">
                <thead><tr><th>Catégorie</th><th>Exemples</th><th>Destinataire</th></tr></thead>
                <tbody>
                  <tr><td>Hébergement &amp; infrastructure</td><td>Serveurs, bases de données, stockage objet</td><td>Prestataires d'hébergement (UE / hors UE avec garanties)</td></tr>
                  <tr><td>Fournisseurs d'IA</td><td>LLM, vision, transcription</td><td>API partenaires, données chiffrées en transit</td></tr>
                  <tr><td>Réseaux sociaux</td><td>Pages Facebook, vidéos TikTok/YouTube…</td><td>Plateformes concernées par la liaison OAuth</td></tr>
                  <tr><td>Services techniques</td><td>Messagerie, paiement, journalisation</td><td>Sous-traitants liés par contrat et confidentialité</td></tr>
                </tbody>
              </table>
              <p>
                Nous ne vendons jamais vos données personnelles. Tout transfert hors
                de l'Union européenne est encadré par les clauses contractuelles
                types (CCT) de la Commission européenne.
              </p>
            </div>
          </section>

          <section class="p-card" id="p7">
            <div class="p-num">07</div>
            <div class="p-card-body">
              <h2>Conservation des données</h2>
              <div class="p-grid">
                <div class="p-cell"><h3>Compte &amp; facturation</h3><p>Durée de la relation contractuelle puis 5 ans (obligations comptables).</p></div>
                <div class="p-cell"><h3>Résultats de recherche</h3><p>Conservés le temps du traitement puis purgés automatiquement.</p></div>
                <div class="p-cell"><h3>Journalisations techniques</h3><p>7 à 30 jours, sauf obligation légale de longer service.</p></div>
                <div class="p-cell"><h3>Jetons OAuth</h3><p>Pendant la durée de la liaison, renouvelés automatiquement, purgés à la révocation.</p></div>
              </div>
              <p>
                À l'expiration de ces durées, les données sont supprimées ou
                anonymisées de façon irréversible.
              </p>
            </div>
          </section>

          <section class="p-card" id="p8">
            <div class="p-num">08</div>
            <div class="p-card-body">
              <h2>Sécurité</h2>
              <ul class="p-list">
                <li>Chiffrement des données en transit (TLS 1.2+) et au repos (AES-256).</li>
                <li>Stockage des secrets et jetons dans un coffre chiffré, jamais en clair.</li>
                <li>Authentification forte, gestion de sessions et rotation des accès privilégiés.</li>
                <li>Surveillance, journalisation d'audit et procédure de notification de violation sous 72 h (art. 33 RGPD).</li>
                <li>Accès aux données strictement limité au personnel nécessaire, sous confidentialité.</li>
              </ul>
            </div>
          </section>

          <section class="p-card" id="p9">
            <div class="p-num">09</div>
            <div class="p-card-body">
              <h2>Cookies &amp; traceurs</h2>
              <p>
                Nous utilisons uniquement les cookies et stockages locaux strictement
                nécessaires au fonctionnement (session, préférences, sécurité).
                Les cookies de mesure d'audience et de publicité ne sont déposés
                qu'avec votre consentement préalable, et vous pouvez les refuser.
              </p>
            </div>
          </section>

          <section class="p-card" id="p10">
            <div class="p-num">10</div>
            <div class="p-card-body">
              <h2>Vos droits</h2>
              <p>Conformément au RGPD, vous disposez des droits suivants :</p>
              <div class="p-rights">
                <span>Accès</span><span>Rectification</span><span>Effacement</span>
                <span>Portabilité</span><span>Limitation</span><span>Opposition</span>
                <span>Retrait du consentement</span><span>Décision humain (art. 22)</span>
              </div>
              <p>
                Pour les exercer, écrivez-nous à
                <a href="mailto:{{ legal.email }}" class="p-link">{{ legal.email }}</a>
                en justifiant votre identité. Nous répondons sous 30 jours.
                Vous pouvez également introduire une réclamation auprès de la CNIL
                (ou de votre autorité de contrôle de résidence).
              </p>
            </div>
          </section>

          <section class="p-card" id="p11">
            <div class="p-num">11</div>
            <div class="p-card-body">
              <h2>Contact &amp; Délégué à la protection des données</h2>
              <p>
                Responsable du traitement : <strong>{{ legal.name }}</strong> — {{ legal.address }}.
                <br />
                Contact données&nbsp;: <a href="mailto:{{ legal.email }}" class="p-link">{{ legal.email }}</a>.
              </p>
              <p>
                Cette politique peut évoluer. La version en ligne sur
                <strong>{{ legal.domaine }}/privacy</strong> fait foi ;
                toute modification substantielle vous sera notifiée.
              </p>
              <div class="p-cta">
                <a routerLink="/contact" class="p-btn">Une question ? Contactez-nous</a>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .privacy-page {
      min-height: 100vh; background: var(--bg);
      transition: background .25s; font-family: 'Inter', sans-serif;
      color: var(--text); scroll-behavior: smooth;
    }

    /* ---------- HERO ---------- */
    .privacy-hero {
      position: relative; overflow: hidden;
      background:
        radial-gradient(1100px 500px at 85% -10%, rgba(99,102,241,.28), transparent 60%),
        radial-gradient(900px 480px at 10% 10%, rgba(168,85,247,.19), transparent 55%),
        linear-gradient(160deg, #0b1120 0%, #101a33 55%, #0b1120 100%);
      color: #fff; padding: 90px 24px 70px;
    }
    .privacy-hero-inner { max-width: 1060px; margin: 0 auto; position: relative; z-index: 2; }
    .p-badge {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 8px 16px; border-radius: 999px; font-size: 12px; font-weight: 700;
      letter-spacing: .8px; text-transform: uppercase; color: #c7d2fe;
      background: rgba(99,102,241,.16); border: 1px solid rgba(129,140,248,.35);
      backdrop-filter: blur(6px);
    }
    .p-badge::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: #8b5cf6; box-shadow: 0 0 12px #8b5cf6; }
    .p-title {
      font-size: clamp(30px, 5vw, 50px); font-weight: 800; letter-spacing: -1px;
      line-height: 1.1; margin: 22px 0 16px; max-width: 720px;
      background: linear-gradient(92deg, #fff, #c7d2fe);
      -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
    }
    .p-sub { color: rgba(226,232,240,.82); max-width: 640px; font-size: 16px; line-height: 1.7; }
    .p-meta { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 28px; }
    .p-chip {
      font-size: 12px; font-weight: 600; padding: 9px 16px; border-radius: 999px;
      background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.16); color: #e2e8f0;
    }
    .hero-blob { position: absolute; border-radius: 50%; filter: blur(90px); opacity: .5; z-index: 1; }
    .hero-blob-1 { width: 380px; height: 380px; top: -120px; right: -80px; background: #6366f1; }
    .hero-blob-2 { width: 260px; height: 260px; bottom: -120px; left: 8%; background: #a855f7; }

    /* ---------- CORPS ---------- */
    .privacy-body { max-width: 1180px; margin: 0 auto; display: grid; grid-template-columns: 260px 1fr; gap: 40px; padding: 56px 24px 90px; }

    /* TOC */
    .p-toc { position: sticky; top: 90px; align-self: start; }
    .p-toc-title { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: var(--text-3); margin-bottom: 16px; }
    .p-toc nav { display: flex; flex-direction: column; gap: 6px; border-left: 2px solid var(--border); }
    .p-toc a {
      font-size: 13px; color: var(--text-2); text-decoration: none; padding: 7px 0 7px 18px;
      border-left: 2px solid transparent; margin-left: -2px; transition: .18s;
    }
    .p-toc a:hover { color: #6366f1; border-left-color: #6366f1; }
    .p-toc-foot { margin-top: 24px; font-size: 12px; color: var(--text-3); line-height: 1.6; }
    .p-toc-foot strong { color: var(--text-2); }

    /* CARDS */
    .p-content { display: flex; flex-direction: column; gap: 26px; }
    .p-card {
      display: flex; gap: 22px;
      background: var(--card-bg); border: 1px solid var(--border);
      border-radius: 22px; padding: 32px;
      box-shadow: 0 12px 34px var(--shadow);
      scroll-margin-top: 30px; transition: border-color .25s;
    }
    .p-card:hover { border-color: rgba(99,102,241,.5); }
    .p-num {
      flex: 0 0 54px; height: 54px; border-radius: 16px; display: flex; align-items: center; justify-content: center;
      font-size: 15px; font-weight: 800; color: #fff;
      background: linear-gradient(135deg, #6366f1, #a855f7);
      box-shadow: 0 8px 20px rgba(99,102,241,.35);
    }
    .p-card-body { flex: 1; min-width: 0; }
    .p-card-body h2 { font-size: 21px; font-weight: 800; margin: 0 0 12px; color: var(--text); }
    .p-card-body p { font-size: 14.5px; line-height: 1.75; color: var(--text-2); margin: 0 0 12px; }

    .p-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin: 14px 0; }
    .p-cell {
      background: var(--bg-2); border: 1px solid var(--border); border-radius: 14px; padding: 16px 18px;
    }
    .p-cell h3 { font-size: 13px; font-weight: 700; margin: 0 0 6px; color: var(--text); }
    .p-cell p { font-size: 12.5px; line-height: 1.6; margin: 0; color: var(--text-3); }

    .p-list { list-style: none; padding: 0; margin: 8px 0 14px; display: flex; flex-direction: column; gap: 10px; }
    .p-list li { position: relative; padding-left: 26px; font-size: 14px; line-height: 1.7; color: var(--text-2); }
    .p-list li::before {
      content: '✓'; position: absolute; left: 0; top: 1px; width: 18px; height: 18px;
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 800; color: #10b981;
      background: rgba(16,185,129,.14);
    }

    .p-note {
      background: rgba(99,102,241,.07); border: 1px solid rgba(99,102,241,.22);
      border-radius: 12px; padding: 12px 16px; font-size: 13px; color: var(--text-2);
    }

    .p-table { width: 100%; border-collapse: collapse; margin: 12px 0 16px; font-size: 13px; }
    .p-table th, .p-table td { text-align: left; padding: 11px 14px; border-bottom: 1px solid var(--border); vertical-align: top; }
    .p-table th { font-size: 11px; text-transform: uppercase; letter-spacing: .6px; color: var(--text-3); background: transparent; }
    .p-table td { color: var(--text-2); line-height: 1.55; }

    .p-rights { display: flex; flex-wrap: wrap; gap: 10px; margin: 14px 0 18px; }
    .p-rights span {
      font-size: 12.5px; font-weight: 700; color: #fff; padding: 9px 16px; border-radius: 999px;
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      box-shadow: 0 6px 16px rgba(99,102,241,.28);
    }

    .p-link { color: #6366f1; text-decoration: none; font-weight: 600; }
    .p-link:hover { text-decoration: underline; }

    .p-cta { margin-top: 8px; }
    .p-btn {
      display: inline-block; padding: 13px 24px; border-radius: 14px; font-size: 14px; font-weight: 800;
      color: #fff; background: linear-gradient(135deg, #6366f1, #a855f7); text-decoration: none;
      box-shadow: 0 10px 26px rgba(99,102,241,.35); transition: transform .2s, box-shadow .2s;
    }
    .p-btn:hover { transform: translateY(-2px); box-shadow: 0 14px 32px rgba(99,102,241,.45); }

    @media (max-width: 920px) {
      .privacy-body { grid-template-columns: 1fr; }
      .p-toc { position: static; }
      .p-toc nav { flex-direction: row; flex-wrap: wrap; gap: 4px 12px; border-left: none; }
      .p-toc nav a { padding: 6px 0; margin: 0; border-left: 0; }
      .p-card { flex-direction: column; }
      .p-grid { grid-template-columns: 1fr; }
      .privacy-hero { padding: 64px 24px 56px; }
    }
  `]
})
export class PrivacyComponent {
  readonly legal = {
    name: 'Creative AI Studio',
    email: 'contact@creativeai.dev',
    dpo: 'dpo@creativeai.dev',
    address: '[Adresse du siège social]',
    domaine: 'api.ai.labibpro.com'
  };
}