
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ReportPage from "./pages/ReportPage";
import { useState } from "react";
import {
  Menu,
  X,
  ShieldCheck,
  FileText,
  Search,
  HeartHandshake,
  ArrowRight,
  Users,
  ShieldAlert,
  PhoneCall,
} from "lucide-react";

import ReportForm from "./components/ReportForm";

const navLinks = [
  ["Home", "#home"],
  ["About", "#about"],
  ["Our Mission", "#mission"],
  ["Awareness", "#awareness"],
  ["Contact", "#contact"],
];

function App() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="site-shell">
      <header className="site-header">
        <a href="#home" className="brand">
          <span className="brand-mark">
            <ShieldCheck size={27} />
          </span>
          <span>
            <strong>
              NASHA<span>MUKT</span>
            </strong>
            <small>जागरूकता • सुरक्षा • बदलाव</small>
          </span>
        </a>

        <nav className={menuOpen ? "main-nav open" : "main-nav"}>
          {navLinks.map(([label, link]) => (
            <a
              key={label}
              href={link}
              onClick={() => setMenuOpen(false)}
            >
              {label}
            </a>
          ))}

          <a
            className="nav-mobile-cta"
            href="#report"
            onClick={() => setMenuOpen(false)}
          >
            Report an Incident
          </a>
        </nav>

        <div className="header-actions">
          <a className="button button-outline" href="#track">
            Track Report
          </a>
          <a className="button button-orange" href="#report">
            Report Now
          </a>
        </div>

        <button
          className="menu-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle navigation"
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
      </header>

      <main>
        {/* HERO SECTION */}
        <section className="hero" id="home">
          <div className="hero-top">
            <div className="logo-strip">
              <div className="logo-placeholder">
                <ShieldCheck />
                <span>
                  NASHA MUKT
                  <br />
                  <b>PUBLIC AWARENESS</b>
                </span>
              </div>

              <div className="logo-divider" />

              <div className="logo-placeholder logo-center">
                <HeartHandshake />
                <span>
                  TOGETHER FOR
                  <br />
                  <b>A DRUG-FREE INDIA</b>
                </span>
              </div>

              <div className="logo-divider" />

              <div className="logo-placeholder">
                <Users />
                <span>
                  COMMUNITY
                  <br />
                  <b>PARTICIPATION</b>
                </span>
              </div>
            </div>

            <div className="hero-heading">
              <p className="eyebrow">
                एक स्वस्थ • सुरक्षित • नशामुक्त समाज
              </p>

              <h1>
                नशा मुक्त
                <span>भारत का</span>
                निर्माण करें
              </h1>

              <p className="hero-subtitle">
                Say no to drugs. Say yes to life.
              </p>
            </div>
          </div>

          <div className="hero-bottom">
            <div className="hero-message">
              <span className="message-kicker">
                आपकी जागरूकता, हमारी ताकत
              </span>

              <h2>
                आइए मिलकर बनाएं
                <span>नशामुक्त भारत।</span>
              </h2>

              <p>
                मादक पदार्थों की तस्करी, बिक्री या अवैध गतिविधियों से जुड़ी
                जानकारी जिम्मेदारी से साझा करें। आपकी सतर्कता समाज को
                सुरक्षित बनाने में मदद कर सकती है।
              </p>

              <div className="hero-buttons">
                <a href="#report" className="button button-orange">
                  जानकारी साझा करें <ArrowRight size={18} />
                </a>

                <a href="#awareness" className="button button-light">
                  जागरूक बनें
                </a>
              </div>

              <div className="trust-note">
                <ShieldCheck size={18} />
                जिम्मेदार और गोपनीय रिपोर्टिंग
              </div>
            </div>

            <div
              className="hero-art"
              aria-label="Illustration representing a drug-free society"
            >
              <div className="art-sun" />

              <div className="no-drugs">
                <span>✦</span>
                <b>
                  NO
                  <br />
                  DRUGS
                </b>
              </div>

              <div className="art-person">
                <div className="person-head" />
                <div className="person-body" />
                <div className="person-arm" />
              </div>

              <div className="art-card">
                <ShieldCheck size={48} />
                <strong>CHOOSE LIFE</strong>
                <small>नशे को कहें ना</small>
              </div>

              <div className="art-caption">
                AWARENESS • ACTION • CHANGE
              </div>
            </div>
          </div>

          <div className="paper-edge" />
        </section>

        {/* QUICK ACTIONS */}
        <section className="quick-actions">
          <a href="#report" className="action-card">
            <span className="action-icon blue">
              <FileText />
            </span>
            <span>
              <strong>Report an Incident</strong>
              <small>
                Share information about suspected drug-related activity.
              </small>
            </span>
            <ArrowRight className="action-arrow" />
          </a>

          <a href="#track" className="action-card">
            <span className="action-icon orange">
              <Search />
            </span>
            <span>
              <strong>Track Your Report</strong>
              <small>
                Check the progress of a report you have submitted.
              </small>
            </span>
            <ArrowRight className="action-arrow" />
          </a>

          <a href="#awareness" className="action-card">
            <span className="action-icon green">
              <HeartHandshake />
            </span>
            <span>
              <strong>Spread Awareness</strong>
              <small>
                Learn how communities can help prevent substance abuse.
              </small>
            </span>
            <ArrowRight className="action-arrow" />
          </a>
        </section>

        {/* ABOUT SECTION */}
        <section className="content-section" id="about">
          <div className="section-copy">
            <span className="section-label">ABOUT NASHA MUKT</span>

            <h2>
              A stronger community begins with <span>awareness.</span>
            </h2>

            <p>
              NashaMukt is a digital platform designed to encourage responsible
              reporting, community participation and coordinated action against
              drug-related activities.
            </p>

            <p>
              Citizens can share information, track submitted reports and
              contribute to a safer, healthier society.
            </p>
          </div>

          <div className="feature-grid">
            <div className="feature-box feature-blue">
              <ShieldCheck />
              <strong>Secure Reporting</strong>
              <small>A structured way to share information.</small>
            </div>

            <div className="feature-box feature-orange">
              <Users />
              <strong>Community</strong>
              <small>People working together for change.</small>
            </div>

            <div className="feature-box feature-cream">
              <Search />
              <strong>Transparency</strong>
              <small>Track the progress of submitted reports.</small>
            </div>

            <div className="feature-box feature-green">
              <HeartHandshake />
              <strong>Awareness</strong>
              <small>Promoting education and prevention.</small>
            </div>
          </div>
        </section>

        {/* MISSION SECTION */}
        <section className="mission-section" id="mission">
          <span className="section-label">OUR MISSION</span>

          <h2>
            Awareness. Responsibility. <span>Action.</span>
          </h2>

          <p>
            Technology and community participation working together for a
            drug-free future.
          </p>

          <div className="mission-points">
            <div>
              <b>01</b>
              <strong>Citizen participation</strong>
              <small>
                Make it easier for citizens to share information.
              </small>
            </div>

            <div>
              <b>02</b>
              <strong>Officer coordination</strong>
              <small>
                Support structured assignment and investigation.
              </small>
            </div>

            <div>
              <b>03</b>
              <strong>Accountable action</strong>
              <small>
                Enable review and recording of appropriate action.
              </small>
            </div>
          </div>
        </section>

        {/* REPORT INTRODUCTION */}
        <section className="report-banner" id="report-intro">
          <div>
            <span className="section-label">
              TAKE A RESPONSIBLE STEP
            </span>

            <h2>
              See something concerning? <span>Speak up.</span>
            </h2>

            <p>
              Help make your community safer by sharing relevant information
              through the reporting portal.
            </p>
          </div>

          <a href="#report" className="button button-orange">
            Start Reporting <ArrowRight size={18} />
          </a>
        </section>

        {/* CITIZEN REPORT FORM */}
        <ReportForm />

        {/* TRACK SECTION - FORM WILL BE ADDED NEXT */}
        <section className="track-section" id="track">
          <div className="track-icon">
            <Search size={30} />
          </div>

          <span className="section-label">REPORT FOLLOW-UP</span>

          <h2>Already submitted a report?</h2>

          <p>
            Use your tracking reference and secret to check its progress.
          </p>

          <p>
            The report tracking form will be available here shortly.
          </p>
        </section>

        {/* AWARENESS SECTION */}
        <section className="awareness-section" id="awareness">
          <div className="awareness-symbol">
            <ShieldAlert size={34} />
          </div>

          <div>
            <span className="section-label">SPREAD AWARENESS</span>

            <h2>Choose a healthier future.</h2>

            <p>
              Education, prevention, family support and community awareness
              all play an important role in preventing substance abuse.
            </p>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="site-footer" id="contact">
        <div className="footer-main">
          <div className="footer-brand">
            <a href="#home" className="brand">
              <span className="brand-mark">
                <ShieldCheck size={26} />
              </span>

              <span>
                <strong>
                  NASHA<span>MUKT</span>
                </strong>
                <small>जागरूकता • सुरक्षा • बदलाव</small>
              </span>
            </a>

            <p>
              Together for a healthier, safer and drug-free society.
            </p>
          </div>

          <div>
            <h3>Quick Links</h3>
            <a href="#about">About us</a>
            <a href="#mission">Our mission</a>
            <a href="#report">Report an incident</a>
            <a href="#track">Track a report</a>
          </div>

          <div>
            <h3>Support</h3>
            <p>
              <PhoneCall size={16} />
              For emergencies, contact your local emergency services.
            </p>
            <p>Use official support channels for assistance.</p>
          </div>
        </div>

        <div className="footer-bottom">
          © {new Date().getFullYear()} NashaMukt. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/report" element={<ReportPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;
