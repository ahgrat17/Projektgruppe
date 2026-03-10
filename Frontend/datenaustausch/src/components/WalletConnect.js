// ============================================================
// components/WalletConnect.js
// MetaMask-Verbindung und Netzwerkprüfung
// ============================================================

import React from "react";

/**
 * WalletConnect-Komponente
 * @param {object}   props
 * @param {string}   props.account           - Verbundene Adresse (null wenn nicht verbunden)
 * @param {boolean}  props.isConnecting      - Loading-State
 * @param {boolean}  props.isCorrectNetwork  - Ist das Netzwerk Sepolia?
 * @param {string}   props.networkError      - Fehlermeldung bei falschem Netzwerk
 * @param {function} props.connectWallet     - Wallet verbinden
 * @param {function} props.disconnectWallet  - Wallet trennen
 * @param {function} props.switchToSepolia   - Zu Sepolia wechseln
 */
export default function WalletConnect({
  account,
  isConnecting,
  isCorrectNetwork,
  networkError,
  connectWallet,
  disconnectWallet,
  switchToSepolia
}) {
  const shortenAddress = (addr) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

  return (
    <div className="wallet-bar">
      <div className="wallet-brand">
        <span className="brand-name">SecureShare</span>
        <span className="brand-network">Sepolia</span>
      </div>

      <div className="wallet-right">
        {/* Netzwerk-Warnung */}
        {account && !isCorrectNetwork && (
          <div className="network-warning">
            <span>Falsches Netzwerk</span>
            <button className="btn btn-warning btn-sm" onClick={switchToSepolia}>
              Zu Sepolia wechseln
            </button>
          </div>
        )}

        {/* Verbunden */}
        {account ? (
          <div className="wallet-connected">
            <span className="dot-green" />
            <span className="wallet-address">{shortenAddress(account)}</span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={disconnectWallet}
            >
              Trennen
            </button>
          </div>
        ) : (
          <button
            className="btn btn-primary"
            onClick={connectWallet}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <><span className="spinner" /> Verbinde...</>
            ) : (
              "Wallet verbinden"
            )}
          </button>
        )}
      </div>
    </div>
  );
}
