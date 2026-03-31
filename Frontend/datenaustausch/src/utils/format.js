// Ethereum-Adresse kürzen: "0x1234...abcd"
export const shortenAddress = (addr) =>
  addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "—";
