import { useState } from "react";
import { ShieldIcon } from "./Icons";

interface LoginPageProps {
  readonly checking: boolean;
  readonly error: string | null;
  readonly submitting: boolean;
  readonly onSubmit: (email: string) => void;
}

export function LoginPage({
  checking,
  error,
  submitting,
  onSubmit
}: LoginPageProps): React.ReactElement {
  const [email, setEmail] = useState("");
  const busy = checking || submitting;

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-card__heading">
          <div className="login-card__icon"><ShieldIcon /></div>
          <span className="eyebrow" id="login-title">Accès réservé</span>
        </div>
        <p>Entrez votre adresse email professionnelle pour accéder à l’extracteur de QCM.</p>

        <form
          className="login-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy) onSubmit(email);
          }}
        >
          <label htmlFor="login-email">Adresse email</label>
          <input
            autoComplete="email"
            autoFocus
            disabled={busy}
            id="login-email"
            inputMode="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="prenom.nom@organisation.fr"
            required
            type="email"
            value={email}
          />
          {error !== null && <div className="login-error" role="alert">{error}</div>}
          <button className="button button--primary" disabled={busy || email.trim() === ""} type="submit">
            {checking ? "Vérification de la session…" : submitting ? "Vérification…" : "Se connecter"}
          </button>
        </form>
      </section>
    </main>
  );
}
