import Navbar from '../components/Navbar';

const LAST_UPDATED = '12 October 2026';

const PrivacyPolicy = () => (
  <div className="app-shell">
    <Navbar />
    <main className="main-content" style={{ maxWidth: '760px', margin: '0 auto' }}>
      <div className="page-header">
        <h1 className="page-header__title">Privacy Policy</h1>
        <p className="page-header__subtitle">Last updated: {LAST_UPDATED}</p>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

        <section>
          <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-3)' }}>1. Overview</h2>
          <p style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
            DevGrowth ("we", "our", or "us") is a developer analytics tool. This Privacy Policy explains what data we collect, how we use it, and the rights you have regarding your information. We do not sell personal data. We do not use advertising networks.
          </p>
        </section>

        <div className="divider" style={{ margin: 0 }} />

        <section>
          <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-3)' }}>2. Data We Collect</h2>
          <p style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)', marginBottom: 'var(--space-3)' }}>
            We collect only the minimum information necessary to provide the service:
          </p>
          <ul style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)', paddingLeft: 'var(--space-5)', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <li><strong style={{ color: 'var(--color-text-primary)' }}>Account information</strong> — your name, email address and a hashed password when you register.</li>
            <li><strong style={{ color: 'var(--color-text-primary)' }}>GitHub data</strong> — public repository names, programming language statistics and dependency file contents you explicitly authorise us to read via the GitHub API. We do not read private repository code.</li>
            <li><strong style={{ color: 'var(--color-text-primary)' }}>Usage data</strong> — basic server logs (IP address, timestamp, route accessed) retained for up to 30 days for debugging.</li>
          </ul>
        </section>

        <div className="divider" style={{ margin: 0 }} />

        <section>
          <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-3)' }}>3. How We Use Your Data</h2>
          <ul style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)', paddingLeft: 'var(--space-5)', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <li>To analyse your public GitHub repositories and identify technical skills.</li>
            <li>To compare detected skills against job role requirements you select.</li>
            <li>To generate personalised learning recommendations.</li>
            <li>To authenticate your session using a JSON Web Token (JWT).</li>
          </ul>
          <p style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)', marginTop: 'var(--space-3)' }}>
            We do not use your data to train machine learning models, build advertising profiles, or share it with third parties beyond what is necessary to operate the service (e.g. MongoDB Atlas hosting).
          </p>
        </section>

        <div className="divider" style={{ margin: 0 }} />

        <section>
          <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-3)' }}>4. Data Retention</h2>
          <p style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
            Your account data is retained until you delete your account. You may request deletion at any time by contacting us. Repository analysis snapshots are retained for up to 12 months to support progress tracking.
          </p>
        </section>

        <div className="divider" style={{ margin: 0 }} />

        <section>
          <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-3)' }}>5. Security</h2>
          <p style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
            Passwords are hashed using bcrypt. Communication between your browser and our server uses HTTPS. We do not store GitHub OAuth tokens beyond the duration of your session unless you explicitly enable persistent access.
          </p>
        </section>

        <div className="divider" style={{ margin: 0 }} />

        <section>
          <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-3)' }}>6. Your Rights</h2>
          <p style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
            You have the right to access the data we hold about you, correct inaccuracies, and request deletion. To exercise these rights, contact us via the email address provided in your account settings.
          </p>
        </section>

        <div className="divider" style={{ margin: 0 }} />

        <section>
          <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-3)' }}>7. Changes to This Policy</h2>
          <p style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
            We may update this policy as the product evolves. We will notify registered users of material changes via email. Continued use of the service after changes take effect constitutes acceptance of the updated policy.
          </p>
        </section>

        <div className="divider" style={{ margin: 0 }} />

        <section>
          <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-3)' }}>8. Contact</h2>
          <p style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
            For privacy-related questions, contact us at: <a href="mailto:privacy@devgrowth.app">privacy@devgrowth.app</a>
          </p>
        </section>

      </div>
    </main>
  </div>
);

export default PrivacyPolicy;
