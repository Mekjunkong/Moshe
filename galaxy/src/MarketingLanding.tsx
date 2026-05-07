import './MarketingLanding.css'

interface MarketingLandingProps {
  onLogin: () => void
}

const services = [
  {
    eyebrow: 'Signature build',
    title: 'Premium Business Website',
    copy: 'A sharp, trustworthy site that explains your offer, proves credibility, and turns visitors into enquiries.',
    timeline: '10–21 days',
    bestFor: 'service brands, consultants, tour operators',
    includes: ['Conversion copy structure', 'Responsive design', 'Launch + analytics'],
  },
  {
    eyebrow: 'Fast campaign',
    title: 'High-Converting Landing Page',
    copy: 'A focused sales page for one offer, campaign, or validation sprint with WhatsApp/contact flow built in.',
    timeline: '5–10 days',
    bestFor: 'new offers, ads, promotions',
    includes: ['Hero + proof flow', 'CTA tracking', 'Lead capture handoff'],
  },
  {
    eyebrow: 'Revenue flow',
    title: 'Booking & Inquiry System',
    copy: 'A practical enquiry path that qualifies leads, captures details, and routes them into the tools you already use.',
    timeline: '7–14 days',
    bestFor: 'tours, local services, appointments',
    includes: ['Forms + WhatsApp', 'Quote-ready questions', 'Admin handoff'],
  },
]

const proofPoints = [
  'Mobile-first builds',
  'WhatsApp-ready CTAs',
  'Tour + service business focus',
  'Fast launch without agency bloat',
]

const workCards = [
  {
    title: 'Wiro4x4 adventure tours',
    type: 'Tour business website',
    result: 'Clearer tour positioning, booking paths, and trust signals for Hebrew/English travellers.',
    accent: '4x4',
  },
  {
    title: 'Amporn Tour Chiang Mai',
    type: 'Credibility hardening',
    result: 'Improved booking trust, proof points, gallery/contact flow, and production SEO consistency.',
    accent: 'CNX',
  },
  {
    title: 'Oracle dashboard',
    type: 'AI command center',
    result: 'Premium dark cockpit for business health, deployment checks, and safe Mike-only controls.',
    accent: 'AI',
  },
]

const process = [
  ['01', 'Clarify', 'Offer, audience, proof, CTA, and what the website must make happen.'],
  ['02', 'Design', 'Premium branded page structure with mobile-first UX and strong conversion hierarchy.'],
  ['03', 'Build', 'React/Vite or practical stack, clean implementation, forms, WhatsApp, analytics.'],
  ['04', 'Launch', 'Deploy, verify, polish, and improve from real visitor/customer feedback.'],
]

export default function MarketingLanding({ onLogin }: MarketingLandingProps) {
  return (
    <main className="marketing-page">
      <header className="marketing-nav" aria-label="Main navigation">
        <a className="marketing-brand" href="/" aria-label="Mike Web Studio home">
          <span>M</span>
          Mike Web Studio
        </a>
        <nav>
          <a href="#services">Services</a>
          <a href="#work">Work</a>
          <a href="#process">Process</a>
          <a href="#contact">Contact</a>
          <a className="marketing-nav-cta" href="#contact">Start Project</a>
          <button type="button" onClick={onLogin}>Client Login</button>
        </nav>
      </header>

      <section className="marketing-hero">
        <div className="marketing-hero-copy">
          <p className="marketing-kicker">Premium web design · Chiang Mai + worldwide</p>
          <h1>Websites that make small businesses look trusted, premium, and ready to sell.</h1>
          <p>
            Mike Web Studio builds polished websites, landing pages, and booking flows for tour operators,
            service businesses, and founders who need credibility fast — not a boring template.
          </p>
          <div className="marketing-actions">
            <a href="https://wa.me/66929894495?text=Hi%20Mike%20Web%20Studio%2C%20I%20want%20a%20premium%20website" rel="noreferrer noopener">Message on WhatsApp</a>
            <a href="#work">See the style</a>
          </div>
          <div className="marketing-proof-strip" aria-label="Trust points">
            {proofPoints.map((point) => <span key={point}>{point}</span>)}
          </div>
        </div>

        <div className="marketing-showcase" aria-label="Website design preview">
          <div className="marketing-browser-frame">
            <div className="marketing-browser-top"><span /><span /><span /><small>live-site.preview</small></div>
            <div className="marketing-browser-hero">
              <div>
                <small>BOOKING FLOW READY</small>
                <strong>Private tours that feel premium before guests even message.</strong>
              </div>
              <span>+38%</span>
            </div>
            <div className="marketing-mini-grid">
              <div><b>Trust</b><small>Reviews · proof · FAQs</small></div>
              <div><b>Convert</b><small>WhatsApp · forms · quotes</small></div>
              <div><b>Launch</b><small>SEO · speed · tracking</small></div>
            </div>
          </div>
          <div className="marketing-phone-card">
            <span>Mobile CTA</span>
            <strong>Check dates on WhatsApp</strong>
            <small>Fast enquiry path for real customers.</small>
          </div>
          <div className="marketing-floating-badge">No plain white templates</div>
        </div>
      </section>

      <section className="marketing-band" id="services">
        <div className="marketing-section-head">
          <p>Services</p>
          <h2>Clear packages with premium design, fast execution, and real business outcomes.</h2>
        </div>
        <div className="marketing-services">
          {services.map((service) => (
            <article key={service.title}>
              <small>{service.eyebrow}</small>
              <h3>{service.title}</h3>
              <p>{service.copy}</p>
              <div className="marketing-card-meta">
                <span>{service.timeline}</span>
                <span>{service.bestFor}</span>
              </div>
              <ul>
                {service.includes.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <a href="#contact">Talk about this →</a>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-work" id="work">
        <div className="marketing-work-copy">
          <p>Selected builds</p>
          <h2>Designed for trust, enquiries, and bookings — not decoration.</h2>
          <small>
            The strongest websites show the offer clearly, make the business feel legitimate,
            and remove friction before the customer messages.
          </small>
        </div>
        <div className="marketing-work-grid">
          {workCards.map((project) => (
            <article key={project.title}>
              <div className="marketing-work-visual"><span>{project.accent}</span></div>
              <small>{project.type}</small>
              <h3>{project.title}</h3>
              <p>{project.result}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-process" id="process">
        <div className="marketing-section-head">
          <p>Process</p>
          <h2>A focused path from rough idea to polished live website.</h2>
        </div>
        <div className="marketing-process-grid">
          {process.map(([step, title, copy]) => (
            <article key={step}>
              <span>{step}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-contact" id="contact">
        <div>
          <p>Start with one message</p>
          <h2>Tell me what the website needs to sell, book, or explain.</h2>
          <small>I’ll suggest the simplest premium path: website, landing page, or booking flow.</small>
        </div>
        <a href="https://wa.me/66929894495?text=Hi%20Mike%20Web%20Studio%2C%20I%20want%20to%20build%20a%20premium%20website" rel="noreferrer noopener">
          Open WhatsApp
        </a>
      </section>
    </main>
  )
}
