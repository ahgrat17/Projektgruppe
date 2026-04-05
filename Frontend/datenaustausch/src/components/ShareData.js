// ShareData – Datei verschlüsseln und über IPFS + Blockchain teilen
// Ablauf in 7 Schritten:
// 1. Datei einlesen  2. AES-Key erzeugen  3. Datei verschlüsseln
// 4. Public Key des Empfängers laden  5. AES-Key mit RSA verschlüsseln
// 6. Blob zu IPFS hochladen  7. shareData() im Smart Contract aufrufen

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { AdminContractABI, ADMIN_CONTRACT_ADDRESS, ADMIN_DEPLOY_BLOCK } from "../abi/AdminContractABI";
import { DataSharingContractABI, DATA_SHARING_CONTRACT_ADDRESS } from "../abi/DataSharingContractABI";
import {
  generateAESKey, encryptData, exportAESKey,
  encryptAESKeyWithPublicKey, packEncryptedBlob, packFileWithName,
} from "../utils/crypto";
import { uploadToIPFS } from "../utils/ipfs";
import { shortenAddress } from "../utils/format";
import { translateContractError } from "../utils/errorMessages";
import { Upload, AlertTriangle } from "./Icons";

// Labels für die Fortschrittsanzeige
const STEPS = [
  { id: 1, label: "Datei lesen" },
  { id: 2, label: "AES-Schlüssel generieren" },
  { id: 3, label: "Datei verschlüsseln" },
  { id: 4, label: "Public Key abrufen" },
  { id: 5, label: "AES-Schlüssel verschlüsseln" },
  { id: 6, label: "IPFS-Upload" },
  { id: 7, label: "On-Chain teilen" },
];

export default function ShareData({ signer, account }) {
  const [selectedFile,    setSelectedFile]    = useState(null);
  const [receiver,        setReceiver]        = useState("");
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [isLoadingUsers,  setIsLoadingUsers]  = useState(false);
  const [currentStep,     setCurrentStep]     = useState(0);     // 0 = kein Fortschritt aktiv
  const [isLoading,       setIsLoading]       = useState(false);
  const [result,          setResult]          = useState(null);  // { cid, txHash } nach Erfolg
  const [error,           setError]           = useState(null);
  const [showConfirm,     setShowConfirm]     = useState(false); // Bestätigungsdialog

  // Alle registrierten + aktiven Nutzer laden (außer sich selbst)
  // Nutzt UserRegistered-Events vom AdminContract
  const loadRegisteredUsers = async () => {
    if (!signer) return;
    setIsLoadingUsers(true);
    setError(null);
    try {
      const adminContract = new ethers.Contract(ADMIN_CONTRACT_ADDRESS, AdminContractABI, signer);
      const filter  = adminContract.filters.UserRegistered();
      const events  = await adminContract.queryFilter(filter, ADMIN_DEPLOY_BLOCK, "latest");

      // Eigenen Account rausfiltern
      const addresses = [...new Set(events.map(e => e.args.user))].filter(
        addr => addr.toLowerCase() !== account.toLowerCase()
      );

      // Pro Adresse: aktiv? Username?
      const users = (await Promise.all(
        addresses.map(async (addr) => {
          try {
            const active = await adminContract.isActive(addr);
            if (!active) return null;
            const username = await adminContract.getUsername(addr);
            return { address: addr, username };
          } catch { return null; }
        })
      )).filter(Boolean);
      setRegisteredUsers(users);
    } catch (err) {
      setError(translateContractError(err));
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Nutzerliste beim Mounten laden
  useEffect(() => {
    if (signer && account) loadRegisteredUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signer, account]);

  const resetState = () => {
    setCurrentStep(0);
    setResult(null);
    setError(null);
  };

  // Die eigentliche Share-Logik – alle 7 Schritte
  const handleShare = async () => {
    if (!signer)                     { setError("Bitte zuerst deine Wallet verbinden."); return; }
    if (!selectedFile)               { setError("Bitte wähle eine Datei aus."); return; }
    if (!ethers.isAddress(receiver)) { setError("Bitte wähle einen Empfänger aus."); return; }

    setShowConfirm(false);
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // 1. Datei einlesen + Dateinamen einbetten
      setCurrentStep(1);
      const fileBuffer = await selectedFile.arrayBuffer();
      const payload    = packFileWithName(selectedFile.name, fileBuffer);

      // 2. Zufälligen AES-Key erzeugen
      setCurrentStep(2);
      const aesKey = await generateAESKey();

      // 3. Payload verschlüsseln
      setCurrentStep(3);
      const { iv, ciphertext } = await encryptData(aesKey, payload);
      const encryptedBlob      = packEncryptedBlob(iv, ciphertext);

      // 4. Public Key des Empfängers vom Contract holen
      setCurrentStep(4);
      const adminContract = new ethers.Contract(ADMIN_CONTRACT_ADDRESS, AdminContractABI, signer);
      const isRegistered  = await adminContract.isRegistered(receiver);
      const isActive      = await adminContract.isActive(receiver);
      if (!isRegistered) throw new Error("Der Empfänger ist nicht registriert.");
      if (!isActive)     throw new Error("Der Empfänger ist deaktiviert.");

      const publicKeyHex   = await adminContract.getPublicKey(receiver);
      const cleanHex       = publicKeyHex.startsWith("0x") ? publicKeyHex.slice(2) : publicKeyHex;
      const publicKeyBytes = new Uint8Array(cleanHex.match(/.{1,2}/g).map(b => parseInt(b, 16)));

      // 5. AES-Key mit dem RSA Public Key des Empfängers verschlüsseln
      setCurrentStep(5);
      const rawAesKey       = await exportAESKey(aesKey);
      const encryptedAesKey = await encryptAESKeyWithPublicKey(rawAesKey, publicKeyBytes);

      // 6. Verschlüsselten Blob zu IPFS hochladen
      setCurrentStep(6);
      const cid = await uploadToIPFS(encryptedBlob, selectedFile.name);

      // 7. On-Chain: CID + verschlüsselter Key im DataSharingContract speichern
      setCurrentStep(7);
      const dsContract = new ethers.Contract(DATA_SHARING_CONTRACT_ADDRESS, DataSharingContractABI, signer);
      const tx = await dsContract.shareData(receiver, cid, encryptedAesKey);
      await tx.wait();

      setResult({ cid, txHash: tx.hash });
      setCurrentStep(0);
    } catch (err) {
      console.error("shareData fehlgeschlagen:", err);
      setError(translateContractError(err));
      setCurrentStep(0);
    } finally {
      setIsLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024)        return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const selectedUser = registeredUsers.find(u => u.address === receiver);
  const canShare     = !isLoading && selectedFile && receiver;

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-header-icon"><Upload /></span>
        <h2>Datei teilen</h2>
      </div>

      <div className="card-body">
        <p className="description">
          Wähle eine Datei und einen Empfänger. Die Datei wird
          verschlüsselt und über IPFS geteilt.
        </p>

        <div className="input-group">
          <label className="input-label" htmlFor="file-input">Datei</label>
          <input
            id="file-input" type="file" className="input-field"
            onChange={(e) => { setSelectedFile(e.target.files[0] || null); resetState(); }}
          />
          {selectedFile && (
            <span className="input-hint">
              {selectedFile.name} — {formatFileSize(selectedFile.size)}
            </span>
          )}
        </div>

        {/* Empfänger-Dropdown */}
        <div className="input-group">
          <div className="label-row">
            <label className="input-label" htmlFor="receiver-select">Empfänger auswählen</label>
            <button
              className="btn-refresh" onClick={loadRegisteredUsers}
              disabled={isLoadingUsers} aria-label="Nutzerliste aktualisieren"
            >
              {isLoadingUsers ? <span className="spinner-small" /> : "↻"}
            </button>
          </div>

          {isLoadingUsers ? (
            <div className="loading-users"><span className="spinner-small" /> Lade Nutzer…</div>
          ) : registeredUsers.length === 0 ? (
            <div className="empty-state" style={{ padding: "16px 0" }}>
              <div className="empty-state-text">Keine anderen registrierten Nutzer gefunden.</div>
              <div className="empty-state-hint">Stelle sicher, dass andere Nutzer vom Admin registriert wurden.</div>
            </div>
          ) : (
            <select
              id="receiver-select" className="input-field select-field"
              value={receiver} onChange={(e) => { setReceiver(e.target.value); resetState(); }}
            >
              <option value="">– Empfänger wählen –</option>
              {registeredUsers.map((user) => (
                <option key={user.address} value={user.address}>
                  {user.username} — {shortenAddress(user.address)}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Gewählter Empfänger mit voller Adresse */}
        {selectedUser && (
          <div className="selected-receiver">
            <div>
              <div style={{ fontWeight: 600 }}>{selectedUser.username}</div>
              <div className="receiver-address">{selectedUser.address}</div>
            </div>
          </div>
        )}

        {/* Fortschrittsanzeige während des 7-Schritte-Prozesses */}
        {isLoading && currentStep > 0 && (
          <div className="progress-steps" role="status" aria-label="Fortschritt">
            {STEPS.map((step) => (
              <div
                key={step.id}
                className={`progress-step ${
                  step.id < currentStep ? "done" : step.id === currentStep ? "active" : "pending"
                }`}
              >
                <span className="step-dot">
                  {step.id < currentStep ? "✓"
                    : step.id === currentStep ? <span className="spinner-small" />
                    : step.id}
                </span>
                <span>{step.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Erfolg */}
        {result && (
          <div className="status-banner status-success" role="status">
            <div><strong>Erfolgreich geteilt!</strong></div>
            <div className="result-detail">
              CID:{" "}
              <a href={`https://ipfs.io/ipfs/${result.cid}`} target="_blank" rel="noreferrer" className="link">
                {result.cid}
              </a>
            </div>
            <div className="result-detail">
              TX:{" "}
              <a href={`https://sepolia.etherscan.io/tx/${result.txHash}`} target="_blank" rel="noreferrer" className="link">
                {result.txHash.slice(0, 24)}…
              </a>
            </div>
          </div>
        )}

        {error && (
          <div className="status-banner status-error" role="alert">
            <span className="status-banner-icon"><AlertTriangle /></span>
            <span>{error}</span>
          </div>
        )}

        {/* Hauptbutton – öffnet erst den Bestätigungsdialog */}
        <button
          className="btn btn-primary btn-full"
          onClick={() => canShare ? setShowConfirm(true) : handleShare()}
          disabled={isLoading || !selectedFile || !receiver}
        >
          {isLoading
            ? <><span className="spinner" /> Wird verarbeitet…</>
            : "Verschlüsseln & Teilen"}
        </button>

        {/* Bestätigung vor dem eigentlichen Share */}
        {showConfirm && (
          <div className="confirm-overlay" onClick={() => setShowConfirm(false)}>
            <div className="confirm-dialog" role="alertdialog" aria-labelledby="confirm-title" onClick={e => e.stopPropagation()}>
              <h3 id="confirm-title">Datei wirklich teilen?</h3>
              <p>
                <strong>{selectedFile.name}</strong> ({formatFileSize(selectedFile.size)}) wird
                verschlüsselt und an <strong>{selectedUser?.username ?? shortenAddress(receiver)}</strong> gesendet.
                Dies erzeugt eine Blockchain-Transaktion.
              </p>
              <div className="confirm-actions">
                <button className="btn btn-ghost" onClick={() => setShowConfirm(false)}>Abbrechen</button>
                <button className="btn btn-primary" onClick={handleShare} autoFocus>Bestätigen & Teilen</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
