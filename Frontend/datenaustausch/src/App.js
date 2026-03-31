// App.js – Hauptkomponente von SecureShare
// Steuert Wallet-Verbindung, Tab-Navigation und Admin-Erkennung.
// Je nach Tab wird die passende Unterkomponente gerendert.

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useWallet } from "./utils/useWallet";
import RegisterUser from "./components/RegisterUser";
import ShareData    from "./components/ShareData";
import ReceiveData  from "./components/ReceiveData";
import SharedByMe   from "./components/SharedByMe";
import AdminPanel   from "./components/AdminPanel";
import { AdminContractABI, ADMIN_CONTRACT_ADDRESS } from "./abi/AdminContractABI";
import { shortenAddress } from "./utils/format";
import "./App.css";

// Tabs die jeder Nutzer sieht
const BASE_TABS = [
  { id: "register", label: "Zugang",       icon: "🔑" },
  { id: "share",    label: "Datei senden",  icon: "📤" },
  { id: "shared",   label: "Freigaben",     icon: "📋" },
  { id: "receive",  label: "Empfang",       icon: "📥" },
];

// Admin-Tab wird nur angezeigt wenn die Wallet die Admin-Adresse ist
const ADMIN_TAB = { id: "admin", label: "Admin", icon: "🛡️" };

export default function App() {
  const [activeTab,  setActiveTab]  = useState("register");
  const [privateKey, setPrivateKey] = useState(null);    // RSA Private Key (nur im RAM, nie persistiert)
  const [isAdmin,    setIsAdmin]    = useState(false);
  const [mobileNav,  setMobileNav]  = useState(false);   // Hamburger-Menü offen/zu

  const {
    account, signer, isConnecting, isCorrectNetwork,
    connectWallet, switchToSepolia,
  } = useWallet();

  const short = account ? shortenAddress(account) : null;

  // Admin-Status prüfen: Wallet-Adresse mit admin() aus dem Contract vergleichen
  useEffect(() => {
    if (!signer || !account) { setIsAdmin(false); return; }
    const contract = new ethers.Contract(ADMIN_CONTRACT_ADDRESS, AdminContractABI, signer);
    contract.admin()
      .then(addr => setIsAdmin(addr.toLowerCase() === account.toLowerCase()))
      .catch(() => setIsAdmin(false));
  }, [signer, account]);

  const tabs = isAdmin ? [...BASE_TABS, ADMIN_TAB] : BASE_TABS;

  const switchTab = (id) => {
    setActiveTab(id);
    setMobileNav(false); // Mobile-Menü schließen nach Tab-Wechsel
  };

  // Callback von RegisterUser – speichert den Private Key im App-State
  // Wird an ReceiveData weitergegeben zum Entschlüsseln
  const handleKeyPairGenerated = (privKey) => setPrivateKey(privKey);

  const activeLabel = tabs.find(t => t.id === activeTab)?.label ?? "Navigation";

  return (
    <div className="app">
      <a href="#main-content" className="skip-link">
        Zum Inhalt springen
      </a>

      <div className="top-accent-bar" role="presentation" />

      {/* Header mit Logo + Wallet-Status */}
      <header className="platform-header">
        <div className="brand-section">
          <div className="brand-logo brand-logo--intro" aria-hidden="true">
            <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 2L36 10v12c0 8-8 15-16 17C12 37 4 30 4 22V10z" fill="#1a1a2e"/>
              <path d="M13 17h9m-3-3 3 3-3 3" stroke="#00d4ff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M27 23H18m3 3-3-3 3-3" stroke="#00d4ff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="brand-text">
            <div className="brand-name">SecureShare</div>
            <div className="brand-badge">Sepolia Testnet</div>
          </div>
        </div>

        <div className="wallet-right">
          {account ? (
            <div className="wallet-pill" role="status" aria-label={`Wallet verbunden: ${short}`}>
              <span className="wallet-dot" aria-hidden="true" />
              {short}
            </div>
          ) : (
            <button
              className="btn btn-primary btn-large"
              onClick={connectWallet}
              disabled={isConnecting}
            >
              {isConnecting ? <><span className="spinner" /> Verbinde…</> : "Wallet verbinden"}
            </button>
          )}
        </div>
      </header>

      {/* Hero-Bereich */}
      <section className="hero-section" aria-label="Einleitung">
        <div className="hero-text">
          <p className="hero-kicker">Sichere Web3-Plattform</p>
          <h1>Sicherer Datenaustausch auf der Blockchain</h1>
          <p className="hero-subtitle">
            Verschlüsselte Dateien teilen über Ethereum Sepolia und IPFS — Ende-zu-Ende-verschlüsselt.
          </p>
        </div>
      </section>
      <div className="hero-bottom-bar" role="presentation" />

      {/* Aufforderung: Wallet verbinden */}
      {!account && (
        <div className="connect-prompt">
          <div className="connect-prompt-inner">
            <h2>Wallet verbinden</h2>
            <p>Verbinde deine MetaMask-Wallet, um SecureShare zu nutzen.</p>
            <button
              className="btn btn-primary btn-large btn-full"
              onClick={connectWallet}
              disabled={isConnecting}
            >
              {isConnecting ? <><span className="spinner" /> Verbinde…</> : "MetaMask verbinden"}
            </button>
          </div>
        </div>
      )}

      {/* Warnung: falsches Netzwerk */}
      {account && !isCorrectNetwork && (
        <div className="network-banner" role="alert">
          <span>Bitte wechsle zum Sepolia-Testnet.</span>
          <button className="btn btn-secondary btn-sm" onClick={switchToSepolia}>
            Jetzt wechseln
          </button>
        </div>
      )}

      {/* Hauptbereich – nur wenn Wallet verbunden + richtiges Netzwerk */}
      {account && isCorrectNetwork && (
        <main className="main" id="main-content">

          {/* Warnung wenn Private Key fehlt (außer auf Register/Admin-Tab) */}
          {!privateKey && activeTab !== "register" && activeTab !== "admin" && (
            <div className="status-banner status-error" role="alert" style={{ marginBottom: 16 }}>
              <span className="status-banner-icon" aria-hidden="true">⚠️</span>
              <span>Kein privater Schlüssel in dieser Sitzung. Bitte zuerst im Tab „Zugang" deinen Schlüssel entsperren.</span>
            </div>
          )}

          {/* Tab-Navigation mit Hamburger für Mobile */}
          <div className="tabs-wrapper">
            <button
              className="hamburger"
              onClick={() => setMobileNav(v => !v)}
              aria-expanded={mobileNav}
              aria-controls="tab-navigation"
              aria-label="Navigation öffnen"
            >
              <span className="hamburger-icon" aria-hidden="true">
                <span /><span /><span />
              </span>
              {activeLabel}
            </button>

            <nav
              id="tab-navigation"
              className={`tabs ${mobileNav ? "tabs--open" : ""}`}
              role="tablist"
              aria-label="Hauptnavigation"
            >
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`panel-${tab.id}`}
                  className={`tab ${activeTab === tab.id ? "tab-active" : ""}`}
                  onClick={() => switchTab(tab.id)}
                >
                  <span className="tab-icon" aria-hidden="true">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Aktiver Tab-Inhalt */}
          <div role="tabpanel" id={`panel-${activeTab}`} aria-label={activeLabel}>
            {activeTab === "register" && (
              <RegisterUser signer={signer} account={account} onKeyPairGenerated={handleKeyPairGenerated} />
            )}
            {activeTab === "share" && (
              <ShareData signer={signer} account={account} />
            )}
            {activeTab === "shared" && (
              <SharedByMe signer={signer} account={account} />
            )}
            {activeTab === "receive" && (
              <ReceiveData signer={signer} account={account} privateKey={privateKey} />
            )}
            {activeTab === "admin" && isAdmin && (
              <AdminPanel signer={signer} />
            )}
          </div>
        </main>
      )}
    </div>
  );
}
