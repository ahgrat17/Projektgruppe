// RegisterUser – Schlüsselverwaltung und Registrierungsstatus
// Hier kann der Nutzer:
// - Ein RSA-Schlüsselpaar generieren (wird mit Passwort verschlüsselt in localStorage gespeichert)
// - Einen vorhandenen Schlüssel mit Passwort entsperren
// - Seinen Registrierungsstatus beim AdminContract prüfen

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { AdminContractABI, ADMIN_CONTRACT_ADDRESS } from "../abi/AdminContractABI";
import {
  deriveAESKeyFromPassword,
  encryptAndStorePrivateKey,
  loadAndDecryptPrivateKey,
  hasStoredPrivateKey,
  deleteStoredPrivateKey,
} from "../utils/crypto";
import { translateContractError } from "../utils/errorMessages";
import { Lock, AlertTriangle, CheckCircle, InfoCircle } from "./Icons";

export default function RegisterUser({ signer, account, onKeyPairGenerated }) {
  const [status,        setStatus]        = useState(null);   // Statusmeldung { type, text }
  const [isLoading,     setIsLoading]     = useState(false);
  const [publicKeyHex,  setPublicKeyHex]  = useState(null);   // Generierter Public Key als Hex (für den Admin)
  const [hasStoredKey,  setHasStoredKey]  = useState(false);  // Gibt's schon einen gespeicherten Key?
  const [password,        setPassword]        = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [unlockPassword,  setUnlockPassword]  = useState("");

  // Beim Laden prüfen ob schon ein Key im localStorage liegt
  useEffect(() => {
    if (account) setHasStoredKey(hasStoredPrivateKey(account));
  }, [account]);

  // Registrierungsstatus beim AdminContract abfragen
  const checkRegistration = async () => {
    if (!signer || !account) return;
    setIsLoading(true);
    setStatus({ type: "info", text: "Status wird geprüft…" });
    try {
      const contract   = new ethers.Contract(ADMIN_CONTRACT_ADDRESS, AdminContractABI, signer);
      const registered = await contract.isRegistered(account);
      const active     = registered ? await contract.isActive(account) : false;

      if (!registered) {
        setStatus({ type: "error", text: "Du bist noch nicht registriert. Bitte kontaktiere den Admin." });
      } else if (!active) {
        setStatus({ type: "error", text: "Dein Konto ist deaktiviert. Bitte kontaktiere den Admin." });
      } else {
        const username = await contract.getUsername(account);
        setStatus({ type: "success", text: `Registriert als „${username}" — dein Konto ist aktiv.` });
      }
    } catch (err) {
      setStatus({ type: "error", text: translateContractError(err) });
    } finally {
      setIsLoading(false);
    }
  };

  // RSA-2048 Schlüsselpaar generieren, mit Passwort verschlüsseln, in localStorage speichern
  const handleGenerateKey = async () => {
    if (!signer || !account) return;

    // Eingabevalidierung
    if (!password) {
      setStatus({ type: "error", text: "Bitte ein Passwort eingeben." });
      return;
    }
    if (password.length < 8) {
      setStatus({ type: "error", text: "Das Passwort muss mindestens 8 Zeichen lang sein." });
      return;
    }
    if (password !== passwordConfirm) {
      setStatus({ type: "error", text: "Die Passwörter stimmen nicht überein." });
      return;
    }

    setIsLoading(true);
    setStatus({ type: "info", text: "Dein RSA-2048-Schlüsselpaar wird generiert…" });
    setPublicKeyHex(null);

    try {
      // Schlüsselpaar erzeugen
      const keyPair = await window.crypto.subtle.generateKey(
        { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
        true, ["encrypt", "decrypt"]
      );

      // Public Key als Hex exportieren – den braucht der Admin für die On-Chain-Registrierung
      const spki     = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
      const pubBytes = new Uint8Array(spki);
      const hex      = "0x" + Array.from(pubBytes).map(b => b.toString(16).padStart(2, "0")).join("");

      // Private Key mit Passwort verschlüsseln und in localStorage ablegen
      setStatus({ type: "info", text: "Schlüssel wird verschlüsselt und gespeichert…" });
      const aesKey = await deriveAESKeyFromPassword(password, account);
      await encryptAndStorePrivateKey(keyPair.privateKey, aesKey, account);

      // Private Key an App.js weitergeben (für ReceiveData)
      if (onKeyPairGenerated) onKeyPairGenerated(keyPair.privateKey);

      setPublicKeyHex(hex);
      setHasStoredKey(true);
      setPassword("");
      setPasswordConfirm("");
      setStatus({
        type: "success",
        text: "Schlüsselpaar generiert und sicher gespeichert! Beim nächsten Besuch reicht dein Passwort zum Entsperren.",
      });
    } catch (err) {
      console.error(err);
      setStatus({ type: "error", text: translateContractError(err) });
    } finally {
      setIsLoading(false);
    }
  };

  // Gespeicherten Private Key mit Passwort entschlüsseln
  const handleUnlock = async () => {
    if (!account || !unlockPassword) {
      setStatus({ type: "error", text: "Bitte gib dein Passwort ein." });
      return;
    }
    setIsLoading(true);
    setStatus({ type: "info", text: "Schlüssel wird entschlüsselt…" });

    try {
      const aesKey     = await deriveAESKeyFromPassword(unlockPassword, account);
      const privateKey = await loadAndDecryptPrivateKey(aesKey, account);

      if (onKeyPairGenerated) onKeyPairGenerated(privateKey);

      setUnlockPassword("");
      setStatus({ type: "success", text: "Schlüssel erfolgreich entsperrt! Du kannst jetzt Dateien entschlüsseln." });
    } catch (err) {
      setStatus({ type: "error", text: translateContractError(err) });
    } finally {
      setIsLoading(false);
    }
  };

  // Schlüssel aus localStorage löschen – danach muss neu generiert werden
  const handleDeleteKey = () => {
    if (!window.confirm(
      "Gespeicherten Schlüssel wirklich löschen?\n\nDu kannst dann keine alten Dateien mehr entschlüsseln!"
    )) return;
    deleteStoredPrivateKey(account);
    setHasStoredKey(false);
    setStatus({ type: "info", text: "Der gespeicherte Schlüssel wurde gelöscht." });
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(publicKeyHex);
      setStatus({ type: "success", text: "Public Key in die Zwischenablage kopiert!" });
    } catch {
      setStatus({ type: "error", text: "Kopieren fehlgeschlagen — bitte markiere den Text manuell und kopiere ihn." });
    }
  };

  const pwOk = password.length >= 8;

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-header-icon"><Lock /></span>
        <h2>Konto & Schlüssel</h2>
      </div>

      <div className="card-body">
        {status && (
          <div className={`status-banner status-${status.type}`} role={status.type === "error" ? "alert" : "status"}>
            <span className="status-banner-icon">
              {status.type === "error" ? <AlertTriangle /> : status.type === "success" ? <CheckCircle /> : <InfoCircle />}
            </span>
            <span>{status.text}</span>
          </div>
        )}

        {/* Public Key anzeigen nach Generierung – muss dem Admin gegeben werden */}
        {publicKeyHex && (
          <div className="info-box" style={{ wordBreak: "break-all", fontSize: 11 }}>
            <strong>Dein Public Key (für den Admin):</strong>
            <div style={{ marginTop: 6, fontFamily: "ui-monospace, monospace" }}>{publicKeyHex}</div>
            <button
              className="btn btn-secondary btn-sm"
              style={{ marginTop: 10 }}
              onClick={copyToClipboard}
              aria-label="Public Key in die Zwischenablage kopieren"
            >
              Kopieren
            </button>
          </div>
        )}

        {/* Zwei Ansichten: Entsperren (wenn Key vorhanden) oder Neu generieren */}
        {hasStoredKey ? (
          <>
            <div className="info-box">
              <strong>Verschlüsselter Schlüssel vorhanden.</strong>{" "}
              Bitte gib dein Passwort ein, um den Zugriff freizugeben.
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="unlock-pw">Passwort</label>
              <input
                id="unlock-pw"
                className="input-field"
                type="password"
                placeholder="Dein Passwort"
                autoComplete="current-password"
                value={unlockPassword}
                onChange={e => setUnlockPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleUnlock()}
              />
            </div>

            <div className="button-row">
              <button className="btn btn-secondary" onClick={checkRegistration} disabled={isLoading || !signer}>
                Status prüfen
              </button>
              <button className="btn btn-primary" onClick={handleUnlock} disabled={isLoading || !unlockPassword}>
                {isLoading ? <><span className="spinner" /> Entsperre…</> : "Entsperren"}
              </button>
            </div>

            <button className="btn btn-danger btn-sm" style={{ alignSelf: "flex-start" }} onClick={handleDeleteKey}>
              Schlüssel löschen & neu generieren
            </button>
          </>
        ) : (
          <>
            <p className="description">
              Generiere dein RSA-Schlüsselpaar. Es wird mit deinem Passwort
              verschlüsselt und lokal gespeichert — beim nächsten Besuch
              reicht dein Passwort zum Entsperren.
            </p>

            <div className="input-group">
              <label className="input-label" htmlFor="gen-pw">Passwort (min. 8 Zeichen)</label>
              <input
                id="gen-pw" className="input-field" type="password"
                placeholder="Sicheres Passwort wählen" autoComplete="new-password"
                value={password} onChange={e => setPassword(e.target.value)}
              />
              {password.length > 0 && (
                <span className={`pw-strength ${pwOk ? "pw-strength--ok" : "pw-strength--weak"}`}>
                  {pwOk ? "✓ Mindestlänge erreicht" : `Noch ${8 - password.length} Zeichen benötigt`}
                </span>
              )}
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="gen-pw-confirm">Passwort bestätigen</label>
              <input
                id="gen-pw-confirm" className="input-field" type="password"
                placeholder="Passwort wiederholen" autoComplete="new-password"
                value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)}
              />
              {passwordConfirm.length > 0 && password !== passwordConfirm && (
                <span className="input-error">Die Passwörter stimmen nicht überein</span>
              )}
            </div>

            <div className="button-row">
              <button className="btn btn-secondary" onClick={checkRegistration} disabled={isLoading || !signer}>
                Status prüfen
              </button>
              <button className="btn btn-primary" onClick={handleGenerateKey} disabled={isLoading || !signer || !pwOk || password !== passwordConfirm}>
                {isLoading ? <><span className="spinner" /> Generiere…</> : "Schlüsselpaar generieren"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
