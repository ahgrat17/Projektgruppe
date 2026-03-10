import React from "react";

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
        {account && !isCorrectNetwork && (
          <div className="network-warning">
            <span>Falsches Netzwerk</span>
            <button className="btn btn-warning btn-sm" onClick={switchToSepolia}>
              Zu Sepolia wechseln
            </button>
          </div>
        )}

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
