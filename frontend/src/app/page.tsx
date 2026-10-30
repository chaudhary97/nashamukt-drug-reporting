"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  HeartHandshake,
  Users,
  FileText,
  Search,
  ArrowRight,
  Heart,
  Menu,
  Building2,
  ClipboardList,
  LockKeyhole,
  Gift,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 35 },
  visible: { opacity: 1, y: 0 },
};

type Portal = {
  title: string;
  subtitle: string;
  description: string;
  icon: React.ComponentType<{ size?: number }>;
  href: string;
  secondaryHref?: string;
  rewardHref?: string;
  button: string;
  secondaryButton?: string;
  rewardButton?: string;
  className: string;
};

function HeroIllustration() {
  return (
    <motion.div
      className="hero-illustration"
      initial={{ opacity: 0, scale: 0.85, x: 35 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      transition={{ duration: 1, ease: "easeOut" }}
    >
      <motion.div
        className="illustration-circle"
        animate={{ y: [0, -12, 0] }}
        transition={{ duration: 4, repeat: Infinity }}
      />

      <motion.div
        className="person"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        <div className="person-head" />
        <div className="person-body" />
        <div className="person-arm" />
      </motion.div>

      <motion.div
        className="no-drugs-sign"
        animate={{ rotate: [5, -5, 5] }}
        transition={{ duration: 4, repeat: Infinity }}
      >
        <span className="sign-star">✦</span>
        <strong>NO</strong>
        <strong>DRUGS</strong>
      </motion.div>

      <motion.div
        className="choose-card"
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 3.5, repeat: Infinity }}
      >
        <ShieldCheck size={48} strokeWidth={2.2} />
        <strong>CHOOSE LIFE</strong>
        <span>नशे को कहें ना</span>
      </motion.div>

      <div className="illustration-caption">
        AWARENESS · ACTION · CHANGE
      </div>
    </motion.div>
  );
}

const portals: Portal[] = [
  {
  title: "Citizen Portal",
  subtitle: "Public Reporting",
  description:
    "Report suspected drug-related activities anonymously and privately track your submitted report.",
  icon: Users,
  href: "/report",
  secondaryHref: "/track",
  rewardHref: "/rewards",
  button: "Report an Incident",
  secondaryButton: "Track Report",
  rewardButton: "Claim Your Reward",
  className: "citizen",
},
  {
    title: "Government Admin",
    subtitle: "Central / State Authority",
    description:
      "Review citizen reports, set priorities, assign investigations to local officers and verify findings.",
    icon: Building2,
    href: "/admin/login",
    button: "Admin Login",
    className: "admin",
  },
  {
    title: "Local Officer",
    subtitle: "Investigation Portal",
    description:
      "Access assigned reports, investigate incidents, submit findings and upload investigation evidence.",
    icon: ClipboardList,
    href: "/officer/login",
    button: "Officer Login",
    className: "officer",
  },
];

export default function Home() {
  return (
    <main>
      <header className="navbar">
        <Link href="/" className="brand">
          <div className="brand-icon">
            <ShieldCheck size={31} />
          </div>
          <div>
            <div className="brand-name">
              NASHA<span>MUKT</span>
            </div>
            <small>जागरूकता · सुरक्षा · बदलाव</small>
          </div>
        </Link>

        <nav className="nav-links">
          <a href="#">Home</a>
          <a href="#about">About</a>
          <a href="#mission">Our Mission</a>
          <a href="#awareness">Awareness</a>
          <a href="#portals">Portals</a>
          <a href="#contact">Contact</a>
        </nav>

        <div className="nav-actions">
          <Link href="/track" className="track-button">
            Track Report
          </Link>
          <Link href="/report" className="report-button">
            Report Now
          </Link>
        </div>

        <button className="mobile-menu" aria-label="Open menu">
          <Menu size={26} />
        </button>
      </header>

      <section className="intro-strip">
        <div className="intro-item">
          <ShieldCheck size={34} />
          <div>
            <small>NASHA MUKT</small>
            <strong>PUBLIC AWARENESS</strong>
          </div>
        </div>
        <div className="intro-item">
          <HeartHandshake size={36} />
          <div>
            <small>TOGETHER FOR</small>
            <strong>A DRUG-FREE INDIA</strong>
          </div>
        </div>
        <div className="intro-item">
          <Users size={35} />
          <div>
            <small>COMMUNITY</small>
            <strong>PARTICIPATION</strong>
          </div>
        </div>
      </section>

      <section className="headline-section" >
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.16 } },
          }}
        >
          <motion.p className="hindi-tag" variants={fadeUp}>
            एक स्वस्थ · सुरक्षित · नशामुक्त समाज
          </motion.p>

          <motion.h1 variants={fadeUp}>
            नशा मुक्त
            <span>भारत का</span>
            निर्माण करें
          </motion.h1>

          <motion.p className="headline-subtitle" variants={fadeUp}>
            SAY NO TO DRUGS. SAY YES TO LIFE.
          </motion.p>
        </motion.div>
      </section>

      <section className="hero-section" id="awareness">
        <div className="hero-content">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.18 } },
            }}
          >
            <motion.p className="eyebrow" variants={fadeUp}>
              आपकी जागरूकता, हमारी ताकत
            </motion.p>

            <motion.h2 variants={fadeUp}>
              आइए मिलकर बनाएं
              <span>नशामुक्त भारत।</span>
            </motion.h2>

            <motion.p className="hero-description" variants={fadeUp}>
              मादक पदार्थों की तस्करी, बिक्री या अवैध गतिविधियों से जुड़ी
              जानकारी जिम्मेदारी से साझा करें। आपकी सतर्कता समाज को
              सुरक्षित बनाने में मदद कर सकती है।
            </motion.p>

            <motion.div className="hero-buttons" variants={fadeUp}>
              <Link href="/report" className="primary-cta">
                जानकारी साझा करें <ArrowRight size={19} />
              </Link>
              <a href="#about" className="secondary-cta">
                जागरूक बनें
              </a>
            </motion.div>

            <motion.div className="privacy-note" variants={fadeUp}>
              <ShieldCheck size={20} />
              जिम्मेदार और गोपनीय रिपोर्टिंग
            </motion.div>
          </motion.div>

          <HeroIllustration />
        </div>
      </section>

      <section className="quick-cards" id="about">
        {/* Submit Report */}
        <motion.div
          className="quick-card"
          whileHover={{ y: -8 }}
          transition={{ duration: 0.25 }}
        >
          <div className="quick-icon blue">
            <FileText size={27} />
          </div>
          <div className="quick-card-text">
            <h3>Report an Incident</h3>
            <p>
              Share information about suspected drug-related activity.
            </p>
            <Link href="/report" className="quick-link">
              Submit Report <ArrowRight size={16} />
            </Link>
          </div>
        </motion.div>

        {/* Track Report */}
        <motion.div
          className="quick-card"
          whileHover={{ y: -8 }}
          transition={{ duration: 0.25 }}
        >
          <div className="quick-icon orange">
            <Search size={27} />
          </div>
          <div className="quick-card-text">
            <h3>Track Your Report</h3>
            <p>
              Check the progress of a report you have submitted.
            </p>
            <Link href="/track" className="quick-link">
              Track Now <ArrowRight size={16} />
            </Link>
          </div>
        </motion.div>

        {/* Claim Reward - NEW */}
        <motion.div
          className="quick-card"
          whileHover={{ y: -8 }}
          transition={{ duration: 0.25 }}
        >
          <div className="quick-icon green">
            <Gift size={28} />
          </div>
          <div className="quick-card-text">
            <h3>Claim Your Reward</h3>
            <p>
              Check reward eligibility for your completed report and
              redeem your reward through UPI.
            </p>
            <Link href="/rewards" className="quick-link">
              View Rewards <ArrowRight size={16} />
            </Link>
          </div>
        </motion.div>

        {/* Spread Awareness */}
        <motion.div
          className="quick-card"
          whileHover={{ y: -8 }}
          transition={{ duration: 0.25 }}
        >
          <div className="quick-icon green">
            <HeartHandshake size={28} />
          </div>
          <div className="quick-card-text">
            <h3>Spread Awareness</h3>
            <p>
              Learn how communities can help prevent substance abuse.
            </p>
            <a href="#mission" className="quick-link">
              Learn More <ArrowRight size={16} />
            </a>
          </div>
        </motion.div>
      </section>

      <section className="about-section">
        <div className="about-copy">
          <p className="section-label">ABOUT NASHA MUKT</p>
          <h2>
            Technology for a
            <span> safer tomorrow.</span>
          </h2>
          <p>
            NashaMukt is a digital platform designed to encourage
            responsible reporting, community participation and
            coordinated action against drug-related activities.
          </p>
          <p>
            Citizens can share information and privately track submitted
            reports, while authorized officials can coordinate
            appropriate follow-up.
          </p>
        </div>

        <div className="about-side-cards">
          <div className="about-mini-card transparency">
            <Search size={32} />
            <h3>Transparency</h3>
            <p>Track the progress of submitted reports.</p>
          </div>
          <div className="about-mini-card awareness">
            <Heart size={32} />
            <h3>Awareness</h3>
            <p>Promoting education and prevention.</p>
          </div>
        </div>
      </section>

      <section className="mission-section" id="mission">
        <motion.div
          className="mission-heading"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
        >
          <p className="section-label">OUR MISSION</p>
          <h2>
            Awareness. Responsibility. <span>Action.</span>
          </h2>
          <p>
            Technology and community participation working together
            for a drug-free future.
          </p>
        </motion.div>

        <div className="mission-cards">
          {[
            {
              number: "01",
              title: "Citizen participation",
              description:
                "Make it easier for citizens to share information responsibly.",
            },
            {
              number: "02",
              title: "Officer coordination",
              description:
                "Support structured assignment and investigation.",
            },
            {
              number: "03",
              title: "Accountable action",
              description:
                "Enable review and recording of appropriate action.",
            },
          ].map((item, index) => (
            <motion.div
              className="mission-card"
              key={item.number}
              initial={{ opacity: 0, y: 35 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15, duration: 0.6 }}
              whileHover={{ y: -8 }}
            >
              <span>{item.number}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="portal-section" id="portals">
        <div className="portal-heading">
          <p className="section-label">ACCESS YOUR PORTAL</p>
          <h2>
            One Platform. <span>Three Interfaces.</span>
          </h2>
          <p>
            Select your role to access the appropriate NashaMukt services.
          </p>
        </div>

        
<div className="portal-grid">
  {portals.map((portal, index) => {
    const Icon = portal.icon;

    return (
      <motion.div
        key={portal.title}
        className={`portal-card ${portal.className}`}
        initial={{ opacity: 0, y: 35 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: index * 0.15, duration: 0.6 }}
        whileHover={{ y: -8 }}
      >
        <div className="portal-icon">
          <Icon size={32} />
        </div>

        <p className="portal-subtitle">{portal.subtitle}</p>

        <h3>{portal.title}</h3>

        <p className="portal-description">
          {portal.description}
        </p>

        {/* Main portal button */}
        <Link href={portal.href} className="portal-button">
          {portal.button}
          <ArrowRight size={18} />
        </Link>

        {/* Track Report button */}
        {portal.secondaryHref && portal.secondaryButton && (
          <Link
            href={portal.secondaryHref}
            className="portal-secondary-link"
          >
            {portal.secondaryButton}
          </Link>
        )}

        {/* Claim Reward button */}
        {portal.rewardHref && portal.rewardButton && (
          <Link
            href={portal.rewardHref}
            className="portal-secondary-link"
          >
            <Gift size={17} className="inline mr-2" />
            {portal.rewardButton}
            <ArrowRight size={16} className="inline ml-2" />
          </Link>
        )}
      </motion.div>
    );
  })}
</div>

<div className="portal-security-note">
  <LockKeyhole size={18} />
  <span>
    Admin and officer portals are restricted to authorized accounts.
  </span>
</div>
</section>

<footer className="footer" id="contact">
  <div className="footer-brand">
    <ShieldCheck size={29} />
    <strong>
      NASHA<span>MUKT</span>
    </strong>
  </div>
  <p>Say no to drugs. Say yes to life.</p>
  <small>
    © 2026 NashaMukt. Awareness · Responsibility · Action.
  </small>
</footer>
</main>
);
}
