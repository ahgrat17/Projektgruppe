// IPFS-Anbindung für SecureShare
// Upload: läuft über die lokale IPFS Desktop API (Port 5001)
// Download: erst lokal versuchen, dann öffentlichen Gateway als Fallback
//
// Wichtig: IPFS Desktop muss laufen und CORS erlauben
// (Einstellungen → API → Access-Control-Allow-Origin: http://localhost:3000)

const IPFS_API     = "http://127.0.0.1:5001/api/v0";
const IPFS_GATEWAY = "https://ipfs.io/ipfs";

// Verschlüsselten Blob zu IPFS hochladen → gibt CID zurück
// Die CID wird dann im Smart Contract gespeichert
export async function uploadToIPFS(encryptedBlob, filename = "encrypted_file") {
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([encryptedBlob], { type: "application/octet-stream" }),
    filename
  );

  let response;
  try {
    // pin=true → Datei bleibt erhalten und wird nicht vom Garbage Collector entfernt
    response = await fetch(`${IPFS_API}/add?pin=true`, {
      method: "POST",
      body:   formData,
    });
  } catch {
    throw new Error(
      "IPFS Desktop nicht erreichbar. Läuft IPFS Desktop und ist die API aktiv? " +
      "(Einstellungen → API → http://127.0.0.1:5001)"
    );
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`IPFS Upload fehlgeschlagen: ${text}`);
  }

  const data = await response.json();
  return data.Hash; // CID, z.B. "QmXyz..."
}

// Verschlüsselte Datei von IPFS herunterladen
// Erst lokale Node, dann Fallback auf öffentlichen Gateway
export async function downloadFromIPFS(cid) {
  // Versuch 1: lokale IPFS Node
  try {
    const response = await fetch(`${IPFS_API}/cat?arg=${cid}`, { method: "POST" });
    if (response.ok) return new Uint8Array(await response.arrayBuffer());
  } catch {
    // IPFS Desktop läuft nicht → Fallback
  }

  // Versuch 2: öffentlicher Gateway
  const response = await fetch(`${IPFS_GATEWAY}/${cid}`);
  if (!response.ok) {
    throw new Error(
      `IPFS Download fehlgeschlagen für CID ${cid} (Status ${response.status}). ` +
      "Stelle sicher dass IPFS Desktop läuft oder das Netzwerk die Datei kennt."
    );
  }
  return new Uint8Array(await response.arrayBuffer());
}

// Gateway-URL für eine CID (zum Öffnen im Browser, Datei ist aber verschlüsselt)
export function getIPFSGatewayURL(cid) {
  return `${IPFS_GATEWAY}/${cid}`;
}
