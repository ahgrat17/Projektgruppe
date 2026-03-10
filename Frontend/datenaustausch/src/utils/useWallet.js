import { useState } from "react";
import { ethers } from "ethers";

const SEPOLIA_CHAIN_ID = "0xaa36a7";

export function useWallet() {
  const [account, setAccount]               = useState(null);
  const [signer, setSigner]                 = useState(null);
  const [isConnecting, setIsConnecting]     = useState(false);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);

  const connectWallet = async () => {
    if (!window.ethereum) { alert("MetaMask nicht gefunden!"); return; }
    setIsConnecting(true);
    try {
      const provider  = new ethers.BrowserProvider(window.ethereum);
      const accounts  = await provider.send("eth_requestAccounts", []);
      const chainId   = await window.ethereum.request({ method: "eth_chainId" });
      setAccount(accounts[0]);
      setSigner(await provider.getSigner());
      setIsCorrectNetwork(chainId === SEPOLIA_CHAIN_ID);
    } catch (err) {
      console.error(err);
    } finally {
      setIsConnecting(false);
    }
  };

  const switchToSepolia = async () => {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: SEPOLIA_CHAIN_ID }]
    });
    setIsCorrectNetwork(true);
  };

  return { account, signer, isConnecting, isCorrectNetwork, connectWallet, switchToSepolia };
}