// Hook für die MetaMask-Anbindung
// Verwaltet: Account, Signer, Netzwerkstatus
// Reagiert auf Account-/Netzwerkwechsel in MetaMask

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";

const SEPOLIA_CHAIN_ID = "0xaa36a7";

export function useWallet() {
  const [account, setAccount]                   = useState(null);
  const [signer, setSigner]                     = useState(null);
  const [isConnecting, setIsConnecting]         = useState(false);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);

  // Provider + Signer aufbauen und State setzen
  const setupProvider = useCallback(async (accounts) => {
    if (!window.ethereum || !accounts || accounts.length === 0) {
      setAccount(null);
      setSigner(null);
      setIsCorrectNetwork(false);
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const chainId  = await window.ethereum.request({ method: "eth_chainId" });

      setAccount(accounts[0]);
      setSigner(await provider.getSigner());
      setIsCorrectNetwork(chainId === SEPOLIA_CHAIN_ID);
    } catch (err) {
      console.error("setupProvider fehlgeschlagen:", err);
      setAccount(null);
      setSigner(null);
      setIsCorrectNetwork(false);
    }
  }, []);

  // Beim Laden prüfen ob MetaMask schon verbunden ist + Events registrieren
  useEffect(() => {
    if (!window.ethereum) return;

    // eth_accounts → kein Popup, gibt [] wenn nicht verbunden
    window.ethereum
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        if (accounts.length > 0) setupProvider(accounts);
      })
      .catch(() => {});

    // Account-Wechsel
    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        setAccount(null);
        setSigner(null);
        setIsCorrectNetwork(false);
      } else {
        setupProvider(accounts);
      }
    };

    // Netzwerk-Wechsel → alles neu aufbauen
    const handleChainChanged = () => {
      window.ethereum
        .request({ method: "eth_accounts" })
        .then((accounts) => {
          if (accounts.length > 0) setupProvider(accounts);
          else setIsCorrectNetwork(false);
        })
        .catch(() => {});
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    // Cleanup beim Unmount
    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, [setupProvider]);

  // Manuell verbinden → löst MetaMask-Popup aus
  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("MetaMask ist nicht installiert. Bitte installiere die MetaMask-Erweiterung.");
      return;
    }
    setIsConnecting(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      await setupProvider(accounts);
    } catch (err) {
      console.error("connectWallet fehlgeschlagen:", err);
    } finally {
      setIsConnecting(false);
    }
  };

  // Zu Sepolia wechseln
  const switchToSepolia = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });
      // chainChanged-Event feuert automatisch → setupProvider läuft
    } catch (err) {
      console.error("Netzwerkwechsel fehlgeschlagen:", err);
    }
  };

  return { account, signer, isConnecting, isCorrectNetwork, connectWallet, switchToSepolia };
}
