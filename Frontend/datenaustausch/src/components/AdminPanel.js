// AdminPanel – Nutzerverwaltung für den Administrator
// Zwei Bereiche:
// 1. Nutzer registrieren (Adresse + Public Key + Username)
// 2. Nutzer suchen, deaktivieren, reaktivieren

import { useState } from "react";
import { ethers } from "ethers";
import { AdminContractABI, ADMIN_CONTRACT_ADDRESS } from "../abi/AdminContractABI";
import { shortenAddress } from "../utils/format";
import { translateContractError } from "../utils/errorMessages";

export default function AdminPanel({ signer }) {
  // --- Registrierung ---
  const [regAddress,   setRegAddress]   = useState("");
  const [regPublicKey, setRegPublicKey] = useState("");
  const [regUsername,  setRegUsername]  = useState("");
  const [regStatus,    setRegStatus]    = useState(null);
  const [regLoading,   setRegLoading]   = useState(false);

  // --- Nutzer verwalten ---
  const [mgmtAddress, setMgmtAddress] = useState("");
  const [mgmtInfo,    setMgmtInfo]    = useState(null);   // { username, isActive, address }
  const [mgmtStatus,  setMgmtStatus]  = useState(null);
  const [mgmtLoading, setMgmtLoading] = useState(false);

  const getContract = () =>
    new ethers.Contract(ADMIN_CONTRACT_ADDRESS, AdminContractABI, signer);

  // Nutzer im AdminContract registrieren
  const handleRegister = async () => {
    if (!signer) return;

    // Eingabevalidierung
    if (!ethers.isAddress(regAddress)) {
      setRegStatus({ type: "error", text: "Bitte gib eine gültige Ethereum-Adresse ein (0x…)." }); return;
    }
    if (!regPublicKey.startsWith("0x") || regPublicKey.length < 10) {
      setRegStatus({ type: "error", text: "Bitte gib einen gültigen Public Key ein (0x…)." }); return;
    }
    if (!regUsername.trim()) {
      setRegStatus({ type: "error", text: "Bitte gib einen Username ein." }); return;
    }

    setRegLoading(true);
    setRegStatus({ type: "info", text: "Transaktion wird gesendet…" });
    try {
      const contract    = getContract();
      // Public Key Hex → Bytes (Contract erwartet bytes, nicht string)
      const cleanHex    = regPublicKey.startsWith("0x") ? regPublicKey.slice(2) : regPublicKey;
      const pubKeyBytes = new Uint8Array(cleanHex.match(/.{1,2}/g).map(b => parseInt(b, 16)));

      const tx = await contract.registerUser(regAddress, pubKeyBytes, regUsername.trim());
      setRegStatus({ type: "info", text: `TX gesendet… (${tx.hash.slice(0, 16)}…)` });
      await tx.wait();

      setRegStatus({
        type: "success",
        text: `„${regUsername}" (${shortenAddress(regAddress)}) wurde erfolgreich registriert!`,
      });
      setRegAddress(""); setRegPublicKey(""); setRegUsername("");
    } catch (err) {
      setRegStatus({ type: "error", text: translateContractError(err) });
    } finally {
      setRegLoading(false);
    }
  };

  // Nutzer per Adresse oder Username suchen
  const handleLookup = async () => {
    if (!signer || !mgmtAddress.trim()) {
      setMgmtStatus({ type: "error", text: "Bitte gib eine Adresse oder einen Username ein." }); return;
    }
    setMgmtLoading(true);
    setMgmtInfo(null);
    setMgmtStatus(null);
    try {
      const contract = getContract();
      let resolvedAddress = mgmtAddress.trim();

      // Falls kein 0x-Format → als Username behandeln und Adresse nachschlagen
      if (!ethers.isAddress(resolvedAddress)) {
        resolvedAddress = await contract.getAddressByUsername(resolvedAddress);
        if (!resolvedAddress || resolvedAddress === ethers.ZeroAddress) {
          setMgmtStatus({ type: "error", text: "Kein Nutzer mit diesem Username gefunden." });
          return;
        }
      }

      const registered = await contract.isRegistered(resolvedAddress);
      if (!registered) {
        setMgmtStatus({ type: "error", text: "Diese Adresse ist nicht registriert." });
        return;
      }

      const username = await contract.getUsername(resolvedAddress);
      const isActive = await contract.isActive(resolvedAddress);
      setMgmtInfo({ username, isActive, address: resolvedAddress });
      setMgmtAddress(resolvedAddress);
    } catch (err) {
      setMgmtStatus({ type: "error", text: translateContractError(err) });
    } finally {
      setMgmtLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!window.confirm(`„${mgmtInfo.username}" wirklich deaktivieren?`)) return;
    setMgmtLoading(true);
    setMgmtStatus({ type: "info", text: "Transaktion wird gesendet…" });
    try {
      const tx = await getContract().deactivateUser(mgmtAddress);
      await tx.wait();
      setMgmtInfo(prev => ({ ...prev, isActive: false }));
      setMgmtStatus({ type: "success", text: `„${mgmtInfo.username}" wurde deaktiviert.` });
    } catch (err) {
      setMgmtStatus({ type: "error", text: translateContractError(err) });
    } finally {
      setMgmtLoading(false);
    }
  };

  const handleReactivate = async () => {
    setMgmtLoading(true);
    setMgmtStatus({ type: "info", text: "Transaktion wird gesendet…" });
    try {
      const tx = await getContract().reactivateUser(mgmtAddress);
      await tx.wait();
      setMgmtInfo(prev => ({ ...prev, isActive: true }));
      setMgmtStatus({ type: "success", text: `„${mgmtInfo.username}" wurde reaktiviert.` });
    } catch (err) {
      setMgmtStatus({ type: "error", text: translateContractError(err) });
    } finally {
      setMgmtLoading(false);
    }
  };

  // Wiederverwendbare Statusanzeige mit Icon
  const StatusBanner = ({ status }) => status ? (
    <div className={`status-banner status-${status.type}`} role={status.type === "error" ? "alert" : "status"}>
      <span className="status-banner-icon" aria-hidden="true">
        {status.type === "error" ? "⚠️" : status.type === "success" ? "✅" : "ℹ️"}
      </span>
      <span>{status.text}</span>
    </div>
  ) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Karte: Nutzer registrieren */}
      <div className="card">
        <div className="card-header">
          <span className="card-header-icon" aria-hidden="true">👤</span>
          <h2>Nutzer registrieren</h2>
        </div>
        <div className="card-body">
          <StatusBanner status={regStatus} />

          <div className="input-group">
            <label className="input-label" htmlFor="reg-address">Wallet-Adresse</label>
            <input id="reg-address" className="input-field" placeholder="0x…"
              value={regAddress} onChange={e => setRegAddress(e.target.value)} />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="reg-pubkey">Public Key (0x…)</label>
            <textarea id="reg-pubkey" className="input-field" placeholder="0x30820122…"
              rows={3} value={regPublicKey} onChange={e => setRegPublicKey(e.target.value)} />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="reg-username">Username (max. 32 Zeichen)</label>
            <input id="reg-username" className="input-field" placeholder="z. B. Max"
              maxLength={32} value={regUsername} onChange={e => setRegUsername(e.target.value)} />
          </div>

          <button className="btn btn-primary btn-full" onClick={handleRegister} disabled={regLoading || !signer}>
            {regLoading ? <><span className="spinner" /> Registriere…</> : "Nutzer registrieren"}
          </button>
        </div>
      </div>

      {/* Karte: Nutzer verwalten */}
      <div className="card">
        <div className="card-header">
          <span className="card-header-icon" aria-hidden="true">⚙️</span>
          <h2>Nutzer verwalten</h2>
        </div>
        <div className="card-body">
          <StatusBanner status={mgmtStatus} />

          <div className="input-group">
            <label className="input-label" htmlFor="mgmt-address">Adresse oder Username</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input id="mgmt-address" className="input-field" placeholder="0x… oder Username"
                value={mgmtAddress} style={{ flex: 1 }}
                onChange={e => { setMgmtAddress(e.target.value); setMgmtInfo(null); setMgmtStatus(null); }}
                onKeyDown={e => e.key === "Enter" && handleLookup()} />
              <button className="btn btn-secondary" onClick={handleLookup} disabled={mgmtLoading || !signer || !mgmtAddress}>
                {mgmtLoading && !mgmtInfo ? <span className="spinner-small" /> : "Suchen"}
              </button>
            </div>
          </div>

          {/* Nutzer-Info + Aktionsbuttons */}
          {mgmtInfo && (
            <div className="info-box">
              <div><strong>Username:</strong> {mgmtInfo.username}</div>
              <div style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", color: "#94a3b8", marginTop: 2 }}>
                {mgmtInfo.address}
              </div>
              <div style={{ marginTop: 8 }}>
                <strong>Status:</strong>{" "}
                <span className={mgmtInfo.isActive ? "status-active" : "status-inactive"}>
                  {mgmtInfo.isActive ? "Aktiv" : "Deaktiviert"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button className="btn btn-danger btn-sm" onClick={handleDeactivate} disabled={mgmtLoading || !mgmtInfo.isActive}>
                  {mgmtLoading && mgmtInfo.isActive ? <span className="spinner-small" /> : "Deaktivieren"}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleReactivate} disabled={mgmtLoading || mgmtInfo.isActive}>
                  {mgmtLoading && !mgmtInfo.isActive ? <span className="spinner-small" /> : "Reaktivieren"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
