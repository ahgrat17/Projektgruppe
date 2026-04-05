// SharedByMe – Übersicht aller Dateien die der Nutzer geteilt hat
// Kann den Zugriff pro Eintrag widerrufen (revokeAccess im Contract)

import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { AdminContractABI, ADMIN_CONTRACT_ADDRESS } from "../abi/AdminContractABI";
import { DataSharingContractABI, DATA_SHARING_CONTRACT_ADDRESS } from "../abi/DataSharingContractABI";
import { shortenAddress } from "../utils/format";
import { translateContractError } from "../utils/errorMessages";
import { ClipboardList, AlertTriangle, InfoCircle, FileIcon, Folder } from "./Icons";

export default function SharedByMe({ signer, account }) {
  const [sharedItems, setSharedItems] = useState([]);
  const [isLoading,   setIsLoading]   = useState(false);
  const [revokingKey, setRevokingKey] = useState(null);   // Key des Eintrags der gerade widerrufen wird
  const [statusMsg,   setStatusMsg]   = useState(null);
  const [error,       setError]       = useState(null);

  // Alle gesendeten Dateien vom Contract laden (getMySentData)
  const fetchSharedByMe = useCallback(async () => {
    if (!signer || !account) return;
    setIsLoading(true);
    setError(null);
    setStatusMsg(null);
    setSharedItems([]);

    try {
      const dsContract    = new ethers.Contract(DATA_SHARING_CONTRACT_ADDRESS, DataSharingContractABI, signer);
      const adminContract = new ethers.Contract(ADMIN_CONTRACT_ADDRESS, AdminContractABI, signer);
      const data = await dsContract.getMySentData();

      if (data.length === 0) {
        setStatusMsg(null);
        return;
      }

      // Usernames für alle Empfänger in einem Batch laden
      const uniqueReceivers = [...new Set(data.map(d => d.receiver))];
      const usernameMap = Object.fromEntries(
        await Promise.all(uniqueReceivers.map(async (r) => {
          try { return [r, await adminContract.getUsername(r)]; }
          catch { return [r, "Unbekannt"]; }
        }))
      );

      const items = data.map((d) => ({
        key:          `${d.receiver}_${d.index}`,
        receiver:     d.receiver,
        receiverName: usernameMap[d.receiver] ?? "Unbekannt",
        cid:          d.cid,
        timestamp:    new Date(Number(d.timestamp) * 1000).toLocaleString("de-DE"),
        index:        Number(d.index),
        active:       d.active,
      }));

      setSharedItems(items);
      setStatusMsg(`${items.length} geteilte Datei(en) gefunden.`);
    } catch (err) {
      console.error("Fehler beim Laden:", err);
      setError(translateContractError(err));
    } finally {
      setIsLoading(false);
    }
  }, [signer, account]);

  // Zugriff widerrufen – ruft revokeAccess(receiver, index) im Contract auf
  const handleRevoke = async (item) => {
    if (!signer) return;
    if (!window.confirm(
      `Zugriff für „${item.receiverName}" wirklich widerrufen?\n\nDiese Aktion erzeugt eine Blockchain-Transaktion und kann nicht rückgängig gemacht werden.`
    )) return;

    setRevokingKey(item.key);
    setError(null);

    try {
      const contract = new ethers.Contract(DATA_SHARING_CONTRACT_ADDRESS, DataSharingContractABI, signer);
      const tx = await contract.revokeAccess(item.receiver, item.index);
      await tx.wait();
      // Lokalen State direkt aktualisieren ohne erneut den Contract zu fragen
      setSharedItems(prev =>
        prev.map(i => i.key === item.key ? { ...i, active: false } : i)
      );
    } catch (err) {
      console.error("revokeAccess fehlgeschlagen:", err);
      setError(translateContractError(err));
    } finally {
      setRevokingKey(null);
    }
  };

  const hasLoaded = statusMsg !== null || sharedItems.length > 0 || (!isLoading && statusMsg === null && sharedItems.length === 0 && error === null);
  const showEmpty = !isLoading && sharedItems.length === 0 && !error && statusMsg === null && hasLoaded;

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-header-icon"><ClipboardList /></span>
        <h2>Von mir geteilte Dateien</h2>
      </div>

      <div className="card-body">
        <p className="description">
          Alle Dateien, die du mit anderen geteilt hast. Du kannst den
          Zugriff jederzeit widerrufen.
        </p>

        {statusMsg && (
          <div className="status-banner status-info" role="status">
            <span className="status-banner-icon"><InfoCircle /></span>
            <span>{statusMsg}</span>
          </div>
        )}

        {error && (
          <div className="status-banner status-error" role="alert">
            <span className="status-banner-icon"><AlertTriangle /></span>
            <span>{error}</span>
          </div>
        )}

        <button
          className="btn btn-primary" onClick={fetchSharedByMe}
          disabled={isLoading || !signer} aria-label="Geteilte Dateien vom Smart Contract laden"
        >
          {isLoading ? <><span className="spinner" /> Lade…</> : "Geteilte Dateien laden"}
        </button>

        {showEmpty && (
          <div className="empty-state">
            <div className="empty-state-icon"><Folder width="36" height="36" /></div>
            <div className="empty-state-text">Du hast noch keine Dateien geteilt.</div>
            <div className="empty-state-hint">Sobald du eine Datei teilst, erscheint sie hier.</div>
          </div>
        )}

        {sharedItems.length > 0 && (
          <div className="data-list">
            {sharedItems.map(item => (
              <div key={item.key} className="data-item" style={{ opacity: item.active ? 1 : 0.55 }}>
                <div className="data-item-header">
                  <span className="data-item-icon"><FileIcon /></span>
                  <div className="data-item-meta">
                    <div className="data-cid">
                      <a href={`https://ipfs.io/ipfs/${item.cid}`} target="_blank" rel="noreferrer" className="link"
                        aria-label={`IPFS-Link ${item.cid.slice(0, 12)}`}>
                        {item.cid.slice(0, 20)}…
                      </a>
                    </div>
                    <div className="data-sender">
                      An: <strong>{item.receiverName}</strong> ({shortenAddress(item.receiver)})
                    </div>
                    <div className="data-time">{item.timestamp}</div>
                    {!item.active && <span className="revoked-badge">Zugriff widerrufen</span>}
                  </div>
                </div>

                {item.active && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleRevoke(item)}
                    disabled={revokingKey === item.key}
                    aria-label={`Zugriff für ${item.receiverName} widerrufen`}
                  >
                    {revokingKey === item.key
                      ? <><span className="spinner-small" /> Widerrufe…</>
                      : "Widerrufen"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
