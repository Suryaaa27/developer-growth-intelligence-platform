import Navbar from '../components/Navbar';

const LAST_UPDATED = '12 October 2026';

const TermsAndConditions = () => (
  <div className="app-shell">
    <Navbar />
    <main className="main-content" style={{ maxWidth: '760px', margin: '0 auto' }}>
      <div className="page-header">
        <h1 className="page-header__title">Terms and Conditions</h1>
        <p className="page-header__subtitle">Last updated: {LAST_UPDATED}</p>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

        <section>
          <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-3)' }}>1. Acceptance of Terms</h2>
          <p style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
            By creating an account or using DevGrowth, you agree to be bound by these Terms and Conditions. If you do not agree, you must not use the service.
          </p>
        </section>

        <div className="divider" style={{ margin: 0 }} />

        <section>
          <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-3)' }}>2. Description of Service</h2>
          <p style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
            DevGrowth is a developer analytics platform that reads your public GitHub repository data to identify technical skills, compare them against job role benchmarks, and produce personalised learning recommendations. The analysis is automated and informational in nature. Results should not be treated as a formal professional assessment.
          </p>
        </section>

        <div className="divider" style={{ margin: 0 }} />

        <section>
          <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-3)' }}>3. Eligibility</h2>
          <p style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
            You must be at least 13 years of age to use this service. By using DevGrowth you represent that you meet this requirement.
          </p>
        </section>

        <div className="divider" style={{ margin: 0 }} />

        <section>
          <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-3)' }}>4. Account Responsibilities</h2>
          <ul style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)', paddingLeft: 'var(--space-5)', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
            <li>You must not share your account with others or attempt to access another user's account.</li>
            <li>You must provide accurate registration information and keep it up to date.</li>
          </ul>
        </section>

        <div className="divider" style={{ margin: 0 }} />

        <section>
          <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-3)' }}>5. Acceptable Use</h2>
          <p style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)', marginBottom: 'var(--space-3)' }}>
            You agree not to:
          </p>
          <ul style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)', paddingLeft: 'var(--space-5)', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <li>Use the service to scrape, store or redistribute other developers' data without consent.</li>
            <li>Attempt to reverse-engineer, disrupt or gain unauthorised access to the platform's backend systems.</li>
            <li>Submit false or misleading information to manipulate analysis results.</li>
            <li>Use the service for any unlawful purpose.</li>
          </ul>
        </section>

        <div className="divider" style={{ margin: 0 }} />

        <section>
          <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-3)' }}>6. Intellectual Property</h2>
          <p style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
            The DevGrowth platform, its source code, visual design and role benchmark data are the property of its developers. Your GitHub repository code remains yours and is governed by the licence you choose for each repository. We claim no ownership over your code.
          </p>
        </section>

        <div className="divider" style={{ margin: 0 }} />

        <section>
          <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-3)' }}>7. Disclaimer of Warranties</h2>
          <p style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
            The service is provided "as is" without any warranties, express or implied. Skill detection and gap analysis results are automated estimates and may not reflect actual employer requirements. We do not guarantee employment outcomes.
          </p>
        </section>

        <div className="divider" style={{ margin: 0 }} />

        <section>
          <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-3)' }}>8. Limitation of Liability</h2>
          <p style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
            To the fullest extent permitted by law, DevGrowth and its creators shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service.
          </p>
        </section>

        <div className="divider" style={{ margin: 0 }} />

        <section>
          <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-3)' }}>9. Termination</h2>
          <p style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
            We reserve the right to suspend or terminate accounts that violate these terms. You may delete your account at any time from your account settings.
          </p>
        </section>

        <div className="divider" style={{ margin: 0 }} />

        <section>
          <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-3)' }}>10. Changes to Terms</h2>
          <p style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
            We may update these terms as the product evolves. Continued use of the service after changes are published constitutes acceptance of the revised terms. We will notify registered users by email of material changes.
          </p>
        </section>

        <div className="divider" style={{ margin: 0 }} />

        <section>
          <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-3)' }}>11. Contact</h2>
          <p style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
            For questions about these terms, contact us at: <a href="mailto:legal@devgrowth.app">legal@devgrowth.app</a>
          </p>
        </section>

      </div>
    </main>
  </div>
);

export default TermsAndConditions;
