import { useState } from "react";
import { useWallet } from "./utils/useWallet";
import RegisterUser from "./components/RegisterUser";
import ShareData    from "./components/ShareData";
import ReceiveData  from "./components/ReceiveData";
import "./App.css";

const TABS = [
  { id: "register", label: "Registrieren" },
  { id: "share",    label: "Teilen"       },
  { id: "receive",  label: "Empfangen"    }
];

export default function App() {
  const [activeTab, setActiveTab] = useState("register");

  const {
    account,
    isConnecting,
    isCorrectNetwork,
    connectWallet,
    switchToSepolia
  } = useWallet();

  const short = account
    ? `${account.slice(0, 6)}...${account.slice(-4)}`
    : null;

  return (
    <div className="app">

      <div className="wallet-bar">
        <div className="wallet-brand">
          Sicherer Datenaustausch
          <span className="brand-network">Sepolia</span>
        </div>
        <div className="wallet-right">
          {account ? (
            <div className="wallet-connected">
              <span className="dot-green" />
              {short}
            </div>
          ) : (
            <button
              className="btn btn-primary"
              onClick={connectWallet}
              disabled={isConnecting}
            >
              {isConnecting ? "Verbinde..." : "Wallet verbinden"}
            </button>
          )}
        </div>
      </div>

      <header className="hero">
        <h1 className="hero-title">
          Sicherer Datenaustausch
        </h1>
        <p className="hero-subtitle">
          Dezentraler Datenaustausch auf Ethereum Sepolia &amp; IPFS
        </p>
      </header>

      {/* Kein Wallet */}
      {!account && (
        <div className="connect-prompt">
          <div className="connect-prompt-inner">
            <h2>Wallet verbinden</h2>
            <p>Verbinde MetaMask um es zu nutzen.</p>
            <button
              className="btn btn-large btn-primary"
              onClick={connectWallet}
              disabled={isConnecting}
            >
              {isConnecting ? "Verbinde..." : "MetaMask verbinden"}
            </button>
          </div>
        </div>
      )}


      {account && !isCorrectNetwork && (
        <div className="network-banner">
          <span>Bitte wechsle zu Sepolia</span>
          <button className="btn btn-secondary btn-sm" onClick={switchToSepolia}>
            Jetzt wechseln
          </button>
        </div>
      )}


      {account && isCorrectNetwork && (
        <main className="main">
          <nav className="tabs">
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`tab ${activeTab === tab.id ? "tab-active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {activeTab === "register" && <RegisterUser />}
          {activeTab === "share"    && <ShareData />}
          {activeTab === "receive"  && <ReceiveData />}
        </main>
      )}
    </div>
  );
}
