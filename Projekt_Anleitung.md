# SecureShare

Sichere Datenaustausch-Plattform auf der Ethereum Sepolia Blockchain mit IPFS und Ende-zu-Ende-Verschluesselung.

## Voraussetzungen

Folgende Software muss installiert sein:

- **Node.js** (v18 oder höher) — [https://nodejs.org](https://nodejs.org)
- **MetaMask** Browser-Extension — [https://metamask.io](https://metamask.io)
- **IPFS Desktop** — [https://docs.ipfs.tech/install/ipfs-desktop](https://docs.ipfs.tech/install/ipfs-desktop)
- **Git** — [https://git-scm.com](https://git-scm.com)

## Start (ohne Redeployment)

Aktuell sind die Contracts bereits deployed. Falls sie neu deployed werden, müssen die Adressen in Frontend/datenaustausch/src/abi aktualisiert werden.


### 1. Backend-Abhaengigkeiten installieren

```bash
cd Projektgruppe
npm install
```

### 2. Frontend-Abhaengigkeiten installieren

```bash
cd Frontend/datenaustausch
npm install
```

### 3. IPFS Desktop konfigurieren

1. IPFS Desktop starten
2. In den Einstellungen unter **API** folgende CORS-Header setzen:
   - `Access-Control-Allow-Origin`: `http://localhost:3000`
   - Danach IPFS Desktop neu starten

### 4. MetaMask einrichten

1. MetaMask öffnen und zum **Sepolia Testnet** wechseln
2. Sepolia-ETH besorgen (z.b: https://cloud.google.com/application/web3/faucet/ethereum/sepolia)

### 5. Frontend starten

```bash
cd Frontend/datenaustausch
npm start
```

Die App oeffnet sich unter [http://localhost:3000](http://localhost:3000).

### 6. App nutzen

1. Auf **"MetaMask verbinden"** klicken
2. Im Tab **"Zugang"** registrieren und Schluessel generieren
3. Ueber **"Datei senden"** verschluesselte Dateien teilen
4. Ueber **"Empfang"** empfangene Dateien entschluesseln

---

## Contracts neu deployen

Falls die Smart Contracts neu deployed werden muessen (z.B. nach Aenderungen am Solidity-Code):



### 1. Contracts auf Sepolia deployen


1. [Remix IDE](https://remix.ethereum.org) oeffnen
2. Die drei Contract-Dateien aus `contracts/` hochladen:
   - `IAdminContract.sol`
   - `admincontract.sol`
   - `datasharingcontract.sol`
3. In Remix unter **Solidity Compiler** die Version `0.8.20` auswaehlen und kompilieren
4. Unter **Deploy & Run Transactions**:
   - Environment auf **"Injected Provider - MetaMask"** stellen
   - MetaMask muss mit Sepolia verbunden sein

#### Reihenfolge beim Deployen:

**Schritt A: AdminContract deployen**

1. Im Dropdown `AdminContract` auswählen
2. Auf **Deploy** klicken und in MetaMask bestätigen
3. Die Contract-Adresse kopieren

**Schritt B: DataSharingContract deployen**

1. Im Dropdown `DataSharingContract` auswaehlen
2. Im Constructor-Feld die AdminContract-Adresse einfuegen
3. Auf **Deploy** klicken und in MetaMask bestaetigen
4. Die Contract-Adresse kopieren 

### 3. Frontend-Adressen aktualisieren

Nach dem Deployment muessen die neuen Contract-Adressen im Frontend eingetragen werden:

**Datei `Frontend/datenaustausch/src/abi/AdminContractABI.js`** — Zeile 1:

```js
export const ADMIN_CONTRACT_ADDRESS = "0xNEUE_ADMIN_ADRESSE_HIER";
```

**Datei `Frontend/datenaustausch/src/abi/DataSharingContractABI.js`** — Zeile 1:

```js
export const DATA_SHARING_CONTRACT_ADDRESS = "0xNEUE_DATASHARING_ADRESSE_HIER";
```

### 4. ABIs aktualisieren (falls Contract-Code geaendert wurde)

Wenn sich die Solidity-Contracts geändert haben, muessen auch die ABIs im Frontend aktualisiert werden. Diese können in der Remix IDE nach dem kompilieren kopiert werden und danach in Frontent/datenaustausch/src/abi in die entsprechende Datei eingefügt werden.


### 5. Frontend neu starten

```bash
cd Frontend/datenaustausch
npm start
```

---

## Projektstruktur

```
Projektgruppe/
├── contracts/                  # Solidity Smart Contracts
│   ├── IAdminContract.sol      # Interface fuer den AdminContract
│   ├── admincontract.sol       # Nutzerverwaltung (Admin, Registrierung)
│   └── datasharingcontract.sol # Datenaustausch-Logik (IPFS CID, verschl. Keys)
├── Frontend/datenaustausch/    # React-Frontend
│   └── src/
│       ├── abi/                # Contract-Adressen und ABIs
│       ├── components/         # React-Komponenten
│       └── utils/              # Hilfsfunktionen (IPFS, Crypto, Wallet)
├── tests/                      # Smart-Contract-Tests
├── hardhat.config.js           # Hardhat-Konfiguration
└── package.json                # Backend-Abhaengigkeiten
```

## Wichtige Hinweise

- Die **Admin-Wallet** ist die Adresse, die den AdminContract deployed hat. Nur diese Adresse sieht den Admin-Tab im Frontend.
- **IPFS Desktop** muss während der Nutzung laufen, damit Dateien hoch- und heruntergeladen werden können.
- Der **RSA Private Key** wird im Browser-Speicher gespeichert. Wird der Browser Cache gelöscht, muss ein neues Schlüsselpaar generiert werden.
- Das Projekt laeuft auf dem **Sepolia Testnet**. Fuer Transaktionen wird Sepolia-ETH benoetigt z.B erhältlich über :https://cloud.google.com/application/web3/faucet/ethereum/sepolia
