// Gas-Messung für alle Smart-Contract-Funktionen
// Misst den tatsächlichen Gas-Verbrauch pro Funktion (Durchschnitt über mehrere Iterationen)
// und gibt die Ergebnisse als formatierte Tabelle aus.
// Ausführen: npx hardhat test tests/gas_measurement.test.js

const { expect } = require("chai");
const { ethers } = require("hardhat");

// --- Konfiguration (anpassbar) ---
const GAS_PRICE_GWEI = 20;
const ETH_USD_PRICE = 3500;
const ITERATIONS = 5;

// --- Hilfsfunktionen ---

// Gas → ETH umrechnen
function gasToEth(gasUsed) {
  return (Number(gasUsed) * GAS_PRICE_GWEI) / 1e9;
}

// Gas → USD umrechnen
function gasToUsd(gasUsed) {
  return gasToEth(gasUsed) * ETH_USD_PRICE;
}

function fmt(n, decimals = 6) {
  return n.toFixed(decimals);
}

// Ergebnisse als Tabelle in der Konsole ausgeben
function printTable(title, rows) {
  const colWidths = [42, 14, 18, 14];
  const sep = colWidths.map((w) => "-".repeat(w)).join("-+-");
  const header = [
    "Funktion".padEnd(colWidths[0]),
    "Gas Used".padStart(colWidths[1]),
    "Kosten (ETH)".padStart(colWidths[2]),
    "Kosten (USD)".padStart(colWidths[3]),
  ].join(" | ");

  console.log(`\n${"=".repeat(sep.length)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(sep.length)}`);
  console.log(header);
  console.log(sep);

  let totalGas = 0n;
  for (const r of rows) {
    totalGas += r.gas;
    console.log(
      [
        r.name.padEnd(colWidths[0]),
        String(r.gas).padStart(colWidths[1]),
        fmt(gasToEth(r.gas), 8).padStart(colWidths[2]),
        fmt(gasToUsd(r.gas), 4).padStart(colWidths[3]),
      ].join(" | ")
    );
  }

  console.log(sep);
  console.log(
    [
      "TOTAL".padEnd(colWidths[0]),
      String(totalGas).padStart(colWidths[1]),
      fmt(gasToEth(totalGas), 8).padStart(colWidths[2]),
      fmt(gasToUsd(totalGas), 4).padStart(colWidths[3]),
    ].join(" | ")
  );
  console.log();
  return totalGas;
}

// Funktion mehrfach ausführen und Durchschnitts-Gas messen
async function measureAvgGas(fn, iterations = ITERATIONS) {
  let totalGas = 0n;
  for (let i = 0; i < iterations; i++) {
    const tx = await fn(i);
    const receipt = await tx.wait();
    totalGas += receipt.gasUsed;
  }
  return totalGas / BigInt(iterations);
}

// --- Testsuites ---
describe("Gas-Messung: AdminContract & DataSharingContract", function () {
  this.timeout(120_000);

  let admin, users, providers;
  let adminContract, dataSharingContract;

  // Ergebnisse pro Phase sammeln
  const phase1Results = [];
  const phase2Results = [];
  const phase3Results = [];

  // Contracts deployen + Test-Accounts vorbereiten
  before(async function () {
    const signers = await ethers.getSigners();
    admin = signers[0];
    users = signers.slice(1, 1 + ITERATIONS);
    providers = signers.slice(1 + ITERATIONS, 1 + 2 * ITERATIONS);

    const AdminFactory = await ethers.getContractFactory("AdminContract", admin);
    adminContract = await AdminFactory.deploy();
    await adminContract.waitForDeployment();

    // DataSharingContract braucht die Adresse des AdminContract
    const DataFactory = await ethers.getContractFactory("DataSharingContract", admin);
    dataSharingContract = await DataFactory.deploy(await adminContract.getAddress());
    await dataSharingContract.waitForDeployment();
  });

  // ── Phase 1: Registrierung ──
  describe("Phase 1 — Registration", function () {
    it("registerUser (Nutzer)", async function () {
      const avg = await measureAvgGas(async (i) => {
        const pubKey = ethers.toUtf8Bytes(`pubkey_user_${i}`);
        return adminContract.connect(admin).registerUser(users[i].address, pubKey, `user_${i}`);
      });
      phase1Results.push({ name: "registerUser (Nutzer)", gas: avg });
    });

    it("registerUser (Datenanbieter)", async function () {
      const avg = await measureAvgGas(async (i) => {
        const pubKey = ethers.toUtf8Bytes(`pubkey_provider_${i}`);
        return adminContract.connect(admin).registerUser(providers[i].address, pubKey, `provider_${i}`);
      });
      phase1Results.push({ name: "registerUser (Datenanbieter)", gas: avg });
    });

    it("updatePublicKey", async function () {
      const avg = await measureAvgGas(async (i) => {
        const newKey = ethers.toUtf8Bytes(`new_pubkey_user_${i}_${Date.now()}`);
        return adminContract.connect(admin).updatePublicKey(users[i].address, newKey);
      });
      phase1Results.push({ name: "updatePublicKey", gas: avg });
    });

    it("deactivateUser", async function () {
      const avg = await measureAvgGas(async (i) => {
        return adminContract.connect(admin).deactivateUser(providers[i].address);
      });
      phase1Results.push({ name: "deactivateUser", gas: avg });
    });

    it("reactivateUser", async function () {
      const avg = await measureAvgGas(async (i) => {
        return adminContract.connect(admin).reactivateUser(providers[i].address);
      });
      phase1Results.push({ name: "reactivateUser", gas: avg });
    });

    after(function () {
      printTable("Phase 1 — Registration", phase1Results);
    });
  });

  // ── Phase 2: Datenaustausch ──
  describe("Phase 2 — Authentication & Data Sharing", function () {
    it("shareData", async function () {
      const avg = await measureAvgGas(async (i) => {
        const cid = `QmTestCID_${i}_${Date.now()}`;
        const encKey = ethers.toUtf8Bytes(`encryptedKey_${i}`);
        return dataSharingContract.connect(users[i]).shareData(providers[i].address, cid, encKey);
      });
      phase2Results.push({ name: "shareData", gas: avg });
    });

    it("shareData (mehrere Datensätze an selben Empfänger)", async function () {
      const avg = await measureAvgGas(async (i) => {
        const cid = `QmMultiCID_${i}_${Date.now()}`;
        const encKey = ethers.toUtf8Bytes(`encKey_multi_${i}`);
        return dataSharingContract.connect(users[i]).shareData(providers[0].address, cid, encKey);
      });
      phase2Results.push({ name: "shareData (mehrere an selben Empf.)", gas: avg });
    });

    after(function () {
      printTable("Phase 2 — Authentication & Data Sharing", phase2Results);
    });
  });

  // ── Phase 3: Verifizierung + Widerruf ──
  describe("Phase 3 — Verification & Data Addition", function () {
    it("revokeAccess", async function () {
      const avg = await measureAvgGas(async (i) => {
        return dataSharingContract.connect(users[i]).revokeAccess(providers[i].address, 0);
      });
      phase3Results.push({ name: "revokeAccess", gas: avg });
    });

    it("shareData (erneut nach Revoke)", async function () {
      const avg = await measureAvgGas(async (i) => {
        const cid = `QmReShareCID_${i}_${Date.now()}`;
        const encKey = ethers.toUtf8Bytes(`encKey_reshare_${i}`);
        return dataSharingContract.connect(users[i]).shareData(providers[i].address, cid, encKey);
      });
      phase3Results.push({ name: "shareData (nach Revoke)", gas: avg });
    });

    // View-Funktionen: kein echtes Gas on-chain, aber estimateGas zeigt den Aufwand
    it("getMySharedData (estimateGas)", async function () {
      let totalGas = 0n;
      for (let i = 0; i < ITERATIONS; i++) {
        const gas = await dataSharingContract.connect(providers[i]).getMySharedData.estimateGas();
        totalGas += gas;
      }
      phase3Results.push({ name: "getMySharedData (view, est.)", gas: totalGas / BigInt(ITERATIONS) });
    });

    it("getMySentData (estimateGas)", async function () {
      let totalGas = 0n;
      for (let i = 0; i < ITERATIONS; i++) {
        const gas = await dataSharingContract.connect(users[i]).getMySentData.estimateGas();
        totalGas += gas;
      }
      phase3Results.push({ name: "getMySentData (view, est.)", gas: totalGas / BigInt(ITERATIONS) });
    });

    it("getPublicKey (estimateGas)", async function () {
      let totalGas = 0n;
      for (let i = 0; i < ITERATIONS; i++) {
        const gas = await adminContract.connect(admin).getPublicKey.estimateGas(users[i].address);
        totalGas += gas;
      }
      phase3Results.push({ name: "getPublicKey (view, est.)", gas: totalGas / BigInt(ITERATIONS) });
    });

    it("getUsername (estimateGas)", async function () {
      let totalGas = 0n;
      for (let i = 0; i < ITERATIONS; i++) {
        const gas = await adminContract.connect(admin).getUsername.estimateGas(users[i].address);
        totalGas += gas;
      }
      phase3Results.push({ name: "getUsername (view, est.)", gas: totalGas / BigInt(ITERATIONS) });
    });

    it("getAddressByUsername (estimateGas)", async function () {
      let totalGas = 0n;
      for (let i = 0; i < ITERATIONS; i++) {
        const gas = await adminContract.connect(admin).getAddressByUsername.estimateGas(`user_${i}`);
        totalGas += gas;
      }
      phase3Results.push({ name: "getAddressByUsername (view, est.)", gas: totalGas / BigInt(ITERATIONS) });
    });

    it("isRegistered (estimateGas)", async function () {
      let totalGas = 0n;
      for (let i = 0; i < ITERATIONS; i++) {
        const gas = await adminContract.connect(admin).isRegistered.estimateGas(users[i].address);
        totalGas += gas;
      }
      phase3Results.push({ name: "isRegistered (view, est.)", gas: totalGas / BigInt(ITERATIONS) });
    });

    it("isActive (estimateGas)", async function () {
      let totalGas = 0n;
      for (let i = 0; i < ITERATIONS; i++) {
        const gas = await adminContract.connect(admin).isActive.estimateGas(users[i].address);
        totalGas += gas;
      }
      phase3Results.push({ name: "isActive (view, est.)", gas: totalGas / BigInt(ITERATIONS) });
    });

    after(function () {
      printTable("Phase 3 — Verification & Data Addition", phase3Results);
    });
  });

  // ── Gesamtübersicht am Ende ──
  after(function () {
    console.log("\n");
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║              GESAMTZUSAMMENFASSUNG                          ║");
    console.log("╠══════════════════════════════════════════════════════════════╣");
    console.log(`║  Gas-Preis:    ${GAS_PRICE_GWEI} Gwei`.padEnd(63) + "║");
    console.log(`║  ETH/USD:     $${ETH_USD_PRICE}`.padEnd(63) + "║");
    console.log(`║  Iterationen:  ${ITERATIONS}`.padEnd(63) + "║");
    console.log("╠══════════════════════════════════════════════════════════════╣");

    const phases = [
      { name: "Phase 1 — Registration", results: phase1Results },
      { name: "Phase 2 — Auth & Data Sharing", results: phase2Results },
      { name: "Phase 3 — Verification & Data Add.", results: phase3Results },
    ];

    let grandTotal = 0n;
    for (const p of phases) {
      const total = p.results.reduce((sum, r) => sum + r.gas, 0n);
      grandTotal += total;
      const line = `║  ${p.name.padEnd(38)} ${String(total).padStart(8)} Gas | ${fmt(gasToEth(total), 8).padStart(14)} ETH | $${fmt(gasToUsd(total), 2).padStart(8)}`;
      console.log(line.padEnd(63) + "║");
    }

    console.log("╠══════════════════════════════════════════════════════════════╣");
    const totalLine = `║  GESAMT:${" ".repeat(30)} ${String(grandTotal).padStart(8)} Gas | ${fmt(gasToEth(grandTotal), 8).padStart(14)} ETH | $${fmt(gasToUsd(grandTotal), 2).padStart(8)}`;
    console.log(totalLine.padEnd(63) + "║");
    console.log("╚══════════════════════════════════════════════════════════════╝");
  });
});
