import { useState } from 'react'
import './MarketingLanding.css'

interface MarketingLandingProps {
  onLogin: () => void
}

type Lang = 'en' | 'th'

type LocalText = Record<Lang, string>

const waMockup = 'https://wa.me/66929894495?text=Hi%20Mike%20Web%20Studio%2C%20I%20want%20a%20free%20homepage%20mockup'
const waBuild = 'https://wa.me/66929894495?text=Hi%20Mike%20Web%20Studio%2C%20I%20want%20to%20build%20a%20premium%20website'

const copy = {
  nav: {
    free: { en: 'Free Mockup', th: 'ดูตัวอย่างฟรี' },
    services: { en: 'Services', th: 'บริการ' },
    work: { en: 'Work', th: 'ผลงาน' },

    contact: { en: 'Contact', th: 'ติดต่อ' },
    login: { en: 'Client Login', th: 'ลูกค้าเข้าใช้งาน' },
  },
  hero: {
    kicker: { en: 'Chiang Mai web studio', th: 'เว็บสตูดิโอเชียงใหม่' },
    title: { en: 'Premium websites people trust faster.', th: 'เว็บพรีเมียมที่ลูกค้าเชื่อใจเร็วขึ้น' },
    body: { en: 'For tours and local services that need a clearer offer, stronger proof, and more WhatsApp enquiries.', th: 'สำหรับธุรกิจทัวร์และบริการที่อยากให้ข้อเสนอชัดขึ้น มีหลักฐานจริง และลูกค้าทักง่ายขึ้น' },
    primary: { en: 'Get Free Mockup', th: 'ขอดูตัวอย่างฟรี' },
    secondary: { en: 'See Real Work', th: 'ดูผลงานจริง' },
    micro: { en: 'Preview first. Pay only if it feels right.', th: 'ดูก่อน ถูกใจค่อยเริ่มงาน' },
    bannerLabel: { en: 'Chiang Mai · premium web studio', th: 'เชียงใหม่ · เว็บสตูดิโอพรีเมียม' },
    bannerTitle: { en: 'Trust, craft, and clear enquiries.', th: 'น่าเชื่อถือ สวย และติดต่อได้ง่าย' },
    bannerCopy: { en: 'A calmer first impression for serious local businesses.', th: 'ภาพแรกที่ดูจริงจังขึ้นสำหรับธุรกิจบริการ' },
    directLabel: { en: 'Direct accountability', th: 'คุยตรงกับคนทำ' },
    directTitle: { en: 'Direct owner.', th: 'เจ้าของดูเอง' },
    trust: { en: 'Trust', th: 'เชื่อใจ' },
    clearOffer: { en: 'Clear offer', th: 'ข้อเสนอชัด' },
    clearOfferCopy: { en: 'Say it fast.', th: 'เข้าใจเร็ว' },
    realProof: { en: 'Real proof', th: 'หลักฐานจริง' },
    realProofCopy: { en: 'Photos, work, location.', th: 'รูป ผลงาน ที่อยู่' },
    whatsapp: { en: 'WhatsApp', th: 'WhatsApp' },
    whatsappCopy: { en: 'Ready path.', th: 'ทักได้ทันที' },
    founderLed: { en: 'Direct studio build.', th: 'คุยตรงกับสตูดิโอ' },
    founderLedCopy: { en: 'No agency layers. Preview before payment.', th: 'คุยตรงกับคนทำ ดูตัวอย่างก่อนจ่าย' },
  },
  sections: {
    proofKicker: { en: 'Proof before pitch', th: 'ความน่าเชื่อถือก่อนขาย' },
    proofTitle: { en: 'Customers decide quickly. Your website should answer fast.', th: 'ลูกค้าตัดสินใจเร็ว เว็บต้องตอบให้ชัด' },
    proofBody: { en: 'Clear offer, real proof, mobile flow, simple contact.', th: 'ข้อเสนอชัด หลักฐานจริง มือถือใช้ง่าย ติดต่อเร็ว' },
    offerKicker: { en: 'Free homepage mockup', th: 'ตัวอย่างหน้าแรกฟรี' },
    offerTitle: { en: 'See the direction before you pay.', th: 'เห็นทิศทางก่อนจ่ายเงินจริง' },
    offerBody: { en: 'Send your business basics. I shape one homepage preview. If it feels right, we launch.', th: 'ส่งข้อมูลธุรกิจมา ผมทำตัวอย่างหน้าแรกให้ดู ถ้าถูกใจค่อยเริ่มงานจริง' },
    offerButton: { en: 'Claim free mockup', th: 'ขอตัวอย่างฟรี' },
    offerNote: { en: 'One focused preview. No pressure.', th: 'ตัวอย่างเดียว ชัด ๆ ไม่กดดัน' },
    servicesKicker: { en: 'Services', th: 'บริการ' },
    servicesTitle: { en: 'Simple packages for trust and enquiries.', th: 'แพ็กเกจชัด สำหรับเว็บที่น่าเชื่อถือและมีคนทัก' },
    workKicker: { en: 'Selected builds', th: 'ผลงานที่เลือกมา' },
    workTitle: { en: 'Real sites, not stock mockups.', th: 'เว็บจริง ไม่ใช่ภาพตัวอย่างปลอม' },
    workBody: { en: 'Offer, proof, and next action. Nothing extra.', th: 'ข้อเสนอ หลักฐาน และปุ่มติดต่อ ไม่มีส่วนเกิน' },
    objectionsKicker: { en: 'Objections handled', th: 'ลดความลังเล' },
    objectionsTitle: { en: 'Answer the doubts before customers message.', th: 'ตอบข้อสงสัยก่อนที่ลูกค้าจะทักมา' },

    fitKicker: { en: 'Best fit', th: 'เหมาะกับใคร' },
    fitTitle: { en: 'For owners who want a sharper site without agency drag.', th: 'สำหรับเจ้าของธุรกิจที่อยากได้เว็บดีขึ้น โดยไม่ต้องคุยหลายชั้น' },
    contactKicker: { en: 'Start with one message', th: 'เริ่มด้วยข้อความเดียว' },
    contactTitle: { en: 'Tell me what the website needs to sell, book, or explain.', th: 'บอกผมว่าเว็บต้องขาย รับจอง หรืออธิบายอะไร' },
    contactBody: { en: 'I’ll suggest the simplest premium path.', th: 'ผมจะแนะนำทางที่ง่ายและเหมาะที่สุด' },
    contactButton: { en: 'Start on WhatsApp', th: 'เริ่มคุยทาง WhatsApp' },
  },
} satisfies Record<string, Record<string, LocalText>>

const proofPoints: LocalText[] = [
  { en: 'WhatsApp first', th: 'WhatsApp ก่อน' },
  { en: 'Preview first', th: 'ดูตัวอย่างก่อน' },
]

const heroWorkProof: LocalText[] = [
  { en: 'Wiro4x4', th: 'Wiro4x4' },
  { en: 'Amporn Tour', th: 'Amporn Tour' },
]

const trustLedger = [
  { value: '1', label: { en: 'accountable builder', th: 'คนรับผิดชอบหลัก' }, copy: { en: 'One person handles strategy, copy, design, build, and launch.', th: 'คนเดียวดูแลกลยุทธ์ ข้อความ ดีไซน์ สร้าง และปล่อยเว็บ' } },
  { value: '2', label: { en: 'live public sites', th: 'เว็บจริงที่เปิดใช้งาน' }, copy: { en: 'Real tour and local-service websites, not stock mockups.', th: 'ตัวอย่างจากเว็บทัวร์และธุรกิจบริการที่ใช้งานจริง' } },
  { value: '0', label: { en: 'payment before preview', th: 'จ่ายก่อนดูตัวอย่าง' }, copy: { en: 'See one homepage direction before the paid build starts.', th: 'เห็นตัวอย่างหน้าแรกก่อนเริ่มงานแบบเสียเงิน' } },
]

const trustSignals: LocalText[] = [
  { en: 'One builder', th: 'คนทำคนเดียว' },
  { en: 'Clear quote', th: 'ราคาชัด' },
  { en: 'Real proof', th: 'หลักฐานจริง' },
  { en: 'Direct WhatsApp', th: 'คุยตรง WhatsApp' },
  { en: 'Mobile QA', th: 'เช็กมือถือ' },
]

const services = [
  {
    eyebrow: { en: 'Signature build', th: 'เว็บหลัก' },
    title: { en: 'Premium Business Website', th: 'เว็บไซต์ธุรกิจพรีเมียม' },
    copy: { en: 'A polished homepage that makes the business clear, real, and easy to contact.', th: 'หน้าเว็บที่ดูดี เข้าใจง่าย น่าเชื่อถือ และติดต่อได้ทันที' },
    timeline: { en: '10 to 21 days', th: '10 ถึง 21 วัน' },
    bestFor: { en: 'tours, clinics, consultants, local services', th: 'ทัวร์ คลินิก ที่ปรึกษา ธุรกิจบริการ' },
    includes: [
      { en: 'Trust-first homepage', th: 'หน้าแรกเน้นความน่าเชื่อถือ' },
      { en: 'Proof, FAQ, offer copy', th: 'หลักฐาน FAQ และข้อความขาย' },
      { en: 'Launch and handoff', th: 'ปล่อยเว็บและส่งมอบ' },
    ],
  },
  {
    eyebrow: { en: 'Fast campaign', th: 'แคมเปญเร็ว' },
    title: { en: 'High-Converting Landing Page', th: 'Landing Page สำหรับยอดขาย' },
    copy: { en: 'One focused page for one offer, campaign, or booking path.', th: 'หน้าเดียวสำหรับข้อเสนอ โปรโมชัน หรือเส้นทางจอง' },
    timeline: { en: '5 to 10 days', th: '5 ถึง 10 วัน' },
    bestFor: { en: 'offers, ads, seasonal campaigns', th: 'โปรโมชัน โฆษณา แคมเปญตามฤดูกาล' },
    includes: [
      { en: 'Offer-first page flow', th: 'โครงหน้าที่เริ่มจากข้อเสนอ' },
      { en: 'WhatsApp or form tracking', th: 'ติดตาม WhatsApp หรือฟอร์ม' },
      { en: 'Lead capture handoff', th: 'ส่งมอบระบบรับ lead' },
    ],
  },
  {
    eyebrow: { en: 'Revenue flow', th: 'ระบบรับงาน' },
    title: { en: 'Booking & Inquiry System', th: 'ระบบจองและสอบถาม' },
    copy: { en: 'Forms and WhatsApp flows that help customers ask the right thing faster.', th: 'ฟอร์มและ WhatsApp flow ที่ช่วยให้ลูกค้าสอบถามง่ายขึ้น' },
    timeline: { en: '7 to 14 days', th: '7 ถึง 14 วัน' },
    bestFor: { en: 'tours, appointments, quotes', th: 'ทัวร์ นัดหมาย ขอราคา' },
    includes: [
      { en: 'Forms and routing', th: 'ฟอร์มและการส่งต่อ' },
      { en: 'Quote-ready questions', th: 'คำถามพร้อมประเมินราคา' },
      { en: 'Admin handoff', th: 'ส่งมอบการใช้งาน' },
    ],
  },
]

const heroBanner = {
  src: '/images/mikeweb-premium-chiangmai-banner.webp',
  alt: 'Premium abstract Chiang Mai web studio banner with mountains, warm light, and editorial design shapes',
}

const mockupSteps = [
  ['01', { en: 'Send basics', th: 'ส่งข้อมูล' }, { en: 'Name, link, photos, offer.', th: 'ชื่อเว็บ ลิงก์ รูป ข้อเสนอ' }],
  ['02', { en: 'Review preview', th: 'ดูตัวอย่าง' }, { en: 'One homepage direction.', th: 'ทิศทางหน้าแรกหนึ่งแบบ' }],
  ['03', { en: 'Approve launch', th: 'อนุมัติแล้วปล่อยเว็บ' }, { en: 'Website, WhatsApp, SEO.', th: 'เว็บ WhatsApp และ SEO' }],
] as const

const launchIncludes: LocalText[] = [
  { en: 'Domain setup', th: 'ตั้งค่าโดเมน' },
  { en: 'Hosting setup', th: 'ตั้งค่าโฮสติ้ง' },
  { en: 'Live one-page website', th: 'เว็บหนึ่งหน้าพร้อมใช้งาน' },
  { en: 'WhatsApp flow', th: 'ทางเข้า WhatsApp' },
  { en: 'Mobile testing', th: 'ทดสอบมือถือ' },
  { en: 'SEO basics', th: 'SEO พื้นฐาน' },
]

const mockupGuardrails: LocalText[] = [
  { en: 'One homepage concept', th: 'ตัวอย่างหน้าแรกหนึ่งแบบ' },
  { en: 'One small revision', th: 'แก้เล็กน้อยหนึ่งรอบ' },
  { en: 'Preview before payment', th: 'ดูก่อนจ่าย' },
  { en: 'Files after approval', th: 'ไฟล์หลังอนุมัติ' },
]

const workCards = [
  {
    title: { en: 'Wiro4x4 adventure tours', th: 'Wiro4x4 ทัวร์ผจญภัย' },
    type: { en: 'Tour business website', th: 'เว็บธุรกิจทัวร์' },
    result: { en: 'Clearer private-tour offer, stronger route proof, better WhatsApp path.', th: 'ทำให้ทัวร์ส่วนตัวเข้าใจง่าย มีหลักฐานเส้นทาง และทักง่ายขึ้น' },
    proof: { en: 'More confidence before enquiry.', th: 'มั่นใจก่อนสอบถาม' },
    link: 'https://www.wiro4x4indochina.com/',
    linkLabel: { en: 'View Wiro4x4 site', th: 'ดูเว็บ Wiro4x4' },
    accent: '4x4',
    image: '/images/work/wiro4x4-home.webp',
    imageAlt: 'Screenshot of the Wiro4x4 Indochina website homepage',
  },
  {
    title: { en: 'Amporn Tour Chiang Mai', th: 'Amporn Tour Chiang Mai' },
    type: { en: 'Credibility hardening', th: 'เพิ่มความน่าเชื่อถือ' },
    result: { en: 'Sharper gallery trust, clearer contact route, stronger booking confidence.', th: 'ทำให้รูปภาพ เส้นทางติดต่อ และความน่าเชื่อถือก่อนจองชัดขึ้น' },
    proof: { en: 'Less doubt before booking.', th: 'ช่วยลดความลังเลก่อนจอง' },
    link: 'https://www.amporntourchiangmai.com/',
    linkLabel: { en: 'View Amporn Tour site', th: 'ดูเว็บ Amporn Tour' },
    accent: 'CNX',
    image: '/images/work/amporn-tour-home.webp',
    imageAlt: 'Screenshot of the Amporn Tour Chiang Mai website homepage',
  },
]

const fitItems: LocalText[] = [
  { en: 'Clear offer and packages', th: 'ข้อเสนอและแพ็กเกจชัด' },
  { en: 'Proof, FAQ, WhatsApp flow', th: 'หลักฐาน FAQ และ WhatsApp flow' },
  { en: 'Fast launch with one builder', th: 'ปล่อยเว็บเร็วกับคนรับผิดชอบคนเดียว' },
]

export default function MarketingLanding({ onLogin }: MarketingLandingProps) {
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window === 'undefined') return 'en'
    return new URLSearchParams(window.location.search).get('lang') === 'th' ? 'th' : 'en'
  })
  const text = (item: LocalText) => item[lang]

  return (
    <main className="marketing-page" lang={lang}>
      <header className="marketing-nav" aria-label="Main navigation">
        <a className="marketing-brand" href="/" aria-label="Mike Web Studio home">
          <span>M</span>
          Mike Web Studio
        </a>
        <nav>
          <a href="#offer">{text(copy.nav.free)}</a>
          <a href="#services">{text(copy.nav.services)}</a>
          <a href="#work">{text(copy.nav.work)}</a>

          <a href="#contact">{text(copy.nav.contact)}</a>
          <div className="marketing-language-toggle" aria-label="Language selector">
            {(['en', 'th'] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={lang === option ? 'is-active' : ''}
                onClick={() => setLang(option)}
                aria-pressed={lang === option}
              >
                {option.toUpperCase()}
              </button>
            ))}
          </div>
          <a className="marketing-nav-cta" href={waMockup} target="_blank" rel="noreferrer noopener">
            {text(copy.nav.free)}
          </a>
          <button className="marketing-login-link" type="button" onClick={onLogin}>{text(copy.nav.login)}</button>
        </nav>
      </header>

      <section className="marketing-hero">
        <div className="marketing-hero-copy">
          <p className="marketing-kicker">{text(copy.hero.kicker)}</p>
          <h1>{text(copy.hero.title)}</h1>
          <p>{text(copy.hero.body)}</p>
          <div className="marketing-actions">
            <a href={waMockup} target="_blank" rel="noreferrer noopener">{text(copy.hero.primary)}</a>
            <a href="#work">{text(copy.hero.secondary)}</a>
          </div>
          <p className="marketing-microcopy">{text(copy.hero.micro)}</p>
          <div className="marketing-hero-work-proof" aria-label="Selected live work">
            <span>{lang === 'en' ? 'Live work:' : 'ผลงานจริง:'}</span>
            {heroWorkProof.map((project) => <a key={project.en} href="#work">{text(project)}</a>)}
          </div>
          <div className="marketing-proof-strip" aria-label="Trust points">
            {proofPoints.map((point) => <span key={point.en}>{text(point)}</span>)}
          </div>
        </div>

        <div className="marketing-showcase" aria-label="Website design preview">
          <div className="marketing-banner-panel">
            <figure className="marketing-hero-banner">
              <img src={heroBanner.src} alt={heroBanner.alt} loading="eager" />
            </figure>
            <div className="marketing-banner-caption">
              <span>{text(copy.hero.bannerLabel)}</span>
              <strong>{text(copy.hero.bannerTitle)}</strong>
              <p>{text(copy.hero.bannerCopy)}</p>
            </div>
          </div>
          <div className="marketing-browser-frame">
            <div className="marketing-browser-top"><span /><span /><span /><small>premium-local.build</small></div>
            <div className="marketing-browser-hero">
              <div>
                <small>{text(copy.hero.directLabel)}</small>
                <strong>{text(copy.hero.directTitle)}</strong>
              </div>
              <span>{text(copy.hero.trust)}</span>
            </div>
            <div className="marketing-mini-grid">
              <div><b>{text(copy.hero.clearOffer)}</b><small>{text(copy.hero.clearOfferCopy)}</small></div>
              <div><b>{text(copy.hero.realProof)}</b><small>{text(copy.hero.realProofCopy)}</small></div>
              <div><b>{text(copy.hero.whatsapp)}</b><small>{text(copy.hero.whatsappCopy)}</small></div>
            </div>
          </div>
          <div className="marketing-credibility-card" aria-label="Why clients choose Mike Web Studio">
            <strong>{text(copy.hero.founderLed)}</strong>
            <span>{text(copy.hero.founderLedCopy)}</span>
          </div>
        </div>
      </section>

      <section className="marketing-proof-band" aria-label="Delivery promises">
        <div><strong>01</strong><span>{text(copy.hero.clearOffer)}</span></div>
        <div><strong>02</strong><span>{lang === 'en' ? 'Mobile tested' : 'ทดสอบมือถือ'}</span></div>
        <div><strong>03</strong><span>{lang === 'en' ? 'WhatsApp ready' : 'พร้อม WhatsApp'}</span></div>
      </section>

      <section className="marketing-trust" aria-labelledby="trust-title">
        <div className="marketing-trust-head">
          <p>{text(copy.sections.proofKicker)}</p>
          <h2 id="trust-title">{text(copy.sections.proofTitle)}</h2>
          <small>{text(copy.sections.proofBody)}</small>
        </div>
        <div className="marketing-trust-ledger">
          {trustLedger.map((item) => (
            <article key={item.value}>
              <strong>{item.value}</strong>
              <span>{text(item.label)}</span>
              <p>{text(item.copy)}</p>
            </article>
          ))}
        </div>
        <div className="marketing-signal-list" aria-label="Trust safeguards">
          {trustSignals.map((signal) => <span key={signal.en}>{text(signal)}</span>)}
        </div>
      </section>

      <section className="marketing-offer" id="offer" aria-labelledby="free-mockup-title">
        <div className="marketing-offer-copy">
          <p>{text(copy.sections.offerKicker)}</p>
          <h2 id="free-mockup-title">{text(copy.sections.offerTitle)}</h2>
          <small>{text(copy.sections.offerBody)}</small>
          <div className="marketing-offer-actions">
            <a href={waMockup} target="_blank" rel="noreferrer noopener">{text(copy.sections.offerButton)}</a>
            <span>{text(copy.sections.offerNote)}</span>
          </div>
        </div>

        <div className="marketing-offer-panel" aria-label="Free mockup offer details">
          <div className="marketing-offer-price">
            <span>{lang === 'en' ? 'Start here' : 'เริ่มตรงนี้'}</span>
            <strong>{lang === 'en' ? 'Free' : 'ฟรี'}</strong>
            <small>{lang === 'en' ? 'homepage concept' : 'ตัวอย่างหน้าแรก'}</small>
          </div>
          <div className="marketing-offer-steps">
            {mockupSteps.map(([step, title, itemCopy]) => (
              <article key={step}>
                <span>{step}</span>
                <div>
                  <h3>{text(title)}</h3>
                  <p>{text(itemCopy)}</p>
                </div>
              </article>
            ))}
          </div>
          <div className="marketing-launch-box">
            <h3>{lang === 'en' ? 'If you approve: Launch Starter' : 'ถ้าอนุมัติ: เริ่ม Launch Starter'}</h3>
            <p>{lang === 'en' ? 'Domain, hosting, one-page website, WhatsApp, mobile testing, SEO basics.' : 'โดเมน โฮสติ้ง เว็บหนึ่งหน้า WhatsApp ทดสอบมือถือ และ SEO พื้นฐาน'}</p>
            <ul>
              {launchIncludes.map((item) => <li key={item.en}>{text(item)}</li>)}
            </ul>
          </div>
          <div className="marketing-guardrails">
            {mockupGuardrails.map((item) => <span key={item.en}>{text(item)}</span>)}
          </div>
        </div>
      </section>

      <section className="marketing-band" id="services">
        <div className="marketing-section-head">
          <p>{text(copy.sections.servicesKicker)}</p>
          <h2>{text(copy.sections.servicesTitle)}</h2>
        </div>
        <div className="marketing-services">
          {services.map((service) => (
            <article key={service.title.en}>
              <small>{text(service.eyebrow)}</small>
              <h3>{text(service.title)}</h3>
              <p>{text(service.copy)}</p>
              <div className="marketing-card-meta">
                <span>{text(service.timeline)}</span>
                <span>{text(service.bestFor)}</span>
              </div>
              <ul>
                {service.includes.map((item) => <li key={item.en}>{text(item)}</li>)}
              </ul>
              <a href="#contact">{lang === 'en' ? 'Ask about this' : 'ถามแพ็กเกจนี้'}</a>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-work" id="work">
        <div className="marketing-work-copy">
          <p>{text(copy.sections.workKicker)}</p>
          <h2>{text(copy.sections.workTitle)}</h2>
          <small>{text(copy.sections.workBody)}</small>
        </div>
        <div className="marketing-work-grid">
          {workCards.map((project) => (
            <article key={project.title.en}>
              <div className="marketing-work-visual">
                <img src={project.image} alt={project.imageAlt} loading="eager" />
                <span>{project.accent}</span>
              </div>
              <small>{text(project.type)}</small>
              <h3>{text(project.title)}</h3>
              <p>{text(project.result)}</p>
              <b>{text(project.proof)}</b>
              <a
                className="marketing-work-link"
                href={project.link}
                {...(project.link.startsWith('http') ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
              >
                {text(project.linkLabel)}
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-decision" aria-label="Best fit">
        <div>
          <p>{text(copy.sections.fitKicker)}</p>
          <h2>{text(copy.sections.fitTitle)}</h2>
        </div>
        <ul>
          {fitItems.map((item) => <li key={item.en}>{text(item)}</li>)}
        </ul>
      </section>

      <section className="marketing-contact" id="contact">
        <div>
          <p>{text(copy.sections.contactKicker)}</p>
          <h2>{text(copy.sections.contactTitle)}</h2>
          <small>{text(copy.sections.contactBody)}</small>
        </div>
        <a href={waBuild} target="_blank" rel="noreferrer noopener">
          {text(copy.sections.contactButton)}
        </a>
      </section>
    </main>
  )
}
