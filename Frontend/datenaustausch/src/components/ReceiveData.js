// ReceiveData – Empfangene Dateien anzeigen und entschlüsselt herunterladen
// Ablauf beim Download:
// 1. Verschlüsselten AES-Key mit eigenem RSA Private Key entschlüsseln
// 2. Datei von IPFS laden
// 3. Mit AES-Key entschlüsseln
// 4. Dateiname extrahieren + Browser-Download auslösen

import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { AdminContractABI, ADMIN_CONTRACT_ADDRESS } from "../abi/AdminContractABI";
import { DataSharingContractABI, DATA_SHARING_CONTRACT_ADDRESS } from "../abi/DataSharingContractABI";
import {
  decryptData, decryptAESKeyWithPrivateKey, importAESKey,
  unpackEncryptedBlob, unpackFileWithName, hexToBuffer,
} from "../utils/crypto";
import { downloadFromIPFS } from "../utils/ipfs";
import { shortenAddress } from "../utils/format";
import { translateContractError } from "../utils/errorMessages";

export default function ReceiveData({ signer, privateKey }) {
  const [sharedItems,   setSharedItems]   = useState([]);    // Empfangene Datenpakete
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [loadingCid,    setLoadingCid]    = useState(null);  // CID die gerade heruntergeladen wird
  const [statusMsg,     setStatusMsg]     = useState(null);
  const [error,         setError]         = useState(null);

  // Datenpakete vom DataSharingContract laden (getMySharedData)
  const fetchSharedData = useCallback(async () => {
    if (!signer) { setError("Bitte zuerst deine Wallet verbinden."); return; }
    setIsLoadingList(true);
    setError(null);
    setStatusMsg(null);
    setSharedItems([]);

    try {
      const dsContract    = new ethers.Contract(DATA_SHARING_CONTRACT_ADDRESS, DataSharingContractABI, signer);
      const adminContract = new ethers.Contract(ADMIN_CONTRACT_ADDRESS, AdminContractABI, signer);
      const data = await dsContract.getMySharedData();

      // Pro Paket den Sender-Username nachschlagen
      const items = await Promise.all(data.map(async (item, index) => {
        let senderName = "";
        try { senderName = await adminContract.getUsername(item.sender); }
        catch { senderName = "Unbekannt"; }
        return {
          id:           index,
          cid:          item.cid,
          encryptedKey: item.encryptedKey,
          sender:       item.sender,
          senderName,
          timestamp:    new Date(Number(item.timestamp) * 1000).toLocaleString("de-DE"),
        };
      }));

      setSharedItems(items);
      setStatusMsg(items.length === 0 ? null : `${items.length} Dateipaket(e) gefunden.`);
    } catch (err) {
      console.error("getMySharedData fehlgeschlagen:", err);
      setError(translateContractError(err));
    } finally {
      setIsLoadingList(false);
    }
  }, [signer]);

  // Datei entschlüsseln und herunterladen
  const handleDownload = async (item) => {
    if (!privateKey) {
      setError(`Kein privater Schlüssel vorhanden. Bitte gehe zum Tab „Zugang" und entsperre deinen Schlüssel.`);
      return;
    }
    setLoadingCid(item.cid);
    setError(null);

    try {
      // AES-Key entschlüsseln (RSA mit eigenem Private Key)
      const encryptedKeyBytes = hexToBuffer(item.encryptedKey);
      const rawAesKey = await decryptAESKeyWithPrivateKey(encryptedKeyBytes, privateKey);
      const aesKey    = await importAESKey(rawAesKey);

      // Verschlüsselte Datei von IPFS laden
      const encryptedBlob       = await downloadFromIPFS(item.cid);
      const { iv, ciphertext }  = unpackEncryptedBlob(encryptedBlob);

      // Datei entschlüsseln + Dateinamen extrahieren
      const decryptedBuffer     = await decryptData(aesKey, iv, ciphertext);
      const { filename, fileBuffer } = unpackFileWithName(decryptedBuffer);

      // Browser-Download auslösen
      const blob = new Blob([fileBuffer], { type: "application/octet-stream" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = filename ?? `decrypted_${item.cid.slice(0, 8)}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Entschlüsselung fehlgeschlagen:", err);
      setError(translateContractError(err));
    } finally {
      setLoadingCid(null);
    }
  };

  const hasLoaded = statusMsg !== null || sharedItems.length > 0;

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-header-icon" aria-hidden="true">📥</span>
        <h2>Meine Datenpakete</h2>
      </div>

      <div className="card-body">
        <p className="description">
          Alle Datenpakete, die für deine Adresse freigegeben wurden.
          Du kannst sie entschlüsselt herunterladen.
        </p>

        {!privateKey && (
          <div className="status-banner status-error" role="alert">
            <span className="status-banner-icon" aria-hidden="true">⚠️</span>
            <span>Kein privater Schlüssel vorhanden. Gehe zum Tab „Zugang" und entsperre deinen Schlüssel.</span>
          </div>
        )}

        {statusMsg && (
          <div className="status-banner status-info" role="status">
            <span className="status-banner-icon" aria-hidden="true">ℹ️</span>
            <span>{statusMsg}</span>
          </div>
        )}

        {error && (
          <div className="status-banner status-error" role="alert">
            <span className="status-banner-icon" aria-hidden="true">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <button
          className="btn btn-primary" onClick={fetchSharedData}
          disabled={isLoadingList || !signer} aria-label="Datenpakete vom Smart Contract laden"
        >
          {isLoadingList ? <><span className="spinner" /> Lade Daten…</> : "Datenpakete laden"}
        </button>

        {/* Leerer Zustand */}
        {hasLoaded && sharedItems.length === 0 && !isLoadingList && (
          <div className="empty-state">
            <div className="empty-state-icon" aria-hidden="true">📭</div>
            <div className="empty-state-text">Keine Datenpakete vorhanden.</div>
            <div className="empty-state-hint">Sobald jemand eine Datei mit dir teilt, erscheint sie hier.</div>
          </div>
        )}

        {/* Liste der empfangenen Pakete */}
        {sharedItems.length > 0 && (
          <div className="data-list">
            {sharedItems.map(item => (
              <div key={item.id} className="data-item">
                <div className="data-item-header">
                  <span className="data-item-icon" aria-hidden="true">📄</span>
                  <div className="data-item-meta">
                    <div className="data-cid">
                      <a href={`https://ipfs.io/ipfs/${item.cid}`} target="_blank" rel="noreferrer" className="link"
                        aria-label={`IPFS-Link ${item.cid.slice(0, 12)}`}>
                        {item.cid.slice(0, 20)}…
                      </a>
                    </div>
                    <div className="data-sender">
                      Von: <strong>{item.senderName}</strong> ({shortenAddress(item.sender)})
                    </div>
                    <div className="data-time">{item.timestamp}</div>
                  </div>
                </div>

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleDownload(item)}
                  disabled={loadingCid === item.cid || !privateKey}
                  aria-label={`Datei von ${item.senderName} herunterladen`}
                >
                  {loadingCid === item.cid
                    ? <><span className="spinner-small" /> Entschlüssele…</>
                    : "Download"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
