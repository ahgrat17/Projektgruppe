// Fehlerübersetzung – technische Contract-Meldungen → nutzerfreundliches Deutsch
// Wird in allen Komponenten-Catch-Blöcken benutzt, damit nie rohe Fehlertexte
// wie "DataSharing: msg.sender ist nicht registriert" beim Nutzer ankommen.

// Mapping: Teilstring aus dem Fehler → verständlicher Text
// Reihenfolge zählt: spezifischere Muster zuerst
const ERROR_MAP = [

  // AdminContract-Fehler
  { match: "Nur Admin erlaubt",           text: "Du hast keine Administratorrechte für diese Aktion." },
  { match: "Ungueltige Adresse",          text: "Die eingegebene Adresse ist ungültig. Bitte prüfe das Format (0x…)." },
  { match: "Public Key darf nicht leer sein", text: "Es wurde kein Public Key angegeben. Bitte füge den Public Key des Nutzers ein." },
  { match: "Nutzer bereits registriert",  text: "Dieser Nutzer ist bereits registriert." },
  { match: "Username darf nicht leer sein", text: "Bitte gib einen Username ein." },
  { match: "Username zu lang",            text: "Der Username ist zu lang (maximal 32 Zeichen)." },
  { match: "Username bereits vergeben",   text: "Dieser Username ist bereits vergeben. Bitte wähle einen anderen." },
  { match: "Nutzer bereits deaktiviert",  text: "Dieser Nutzer ist bereits deaktiviert." },
  { match: "Nutzer bereits aktiv",        text: "Dieser Nutzer ist bereits aktiv." },
  { match: "Nutzer ist deaktiviert",      text: "Dieses Konto ist deaktiviert. Bitte wende dich an den Administrator." },
  { match: "Nutzer nicht registriert",    text: "Dieser Nutzer ist nicht registriert." },
  { match: "Username nicht gefunden",     text: "Kein Nutzer mit diesem Username gefunden." },

  // DataSharingContract-Fehler
  { match: "msg.sender ist nicht registriert", text: "Du bist noch nicht als Nutzer registriert. Bitte wende dich an den Administrator, um freigeschaltet zu werden." },
  { match: "msg.sender ist deaktiviert",       text: "Dein Konto ist deaktiviert. Bitte wende dich an den Administrator." },
  { match: "Sender und Empfaenger identisch",  text: "Du kannst keine Datei an dich selbst senden." },
  { match: "Empfaenger nicht registriert",      text: "Der ausgewählte Empfänger ist nicht registriert." },
  { match: "Empfaenger ist deaktiviert",        text: "Der ausgewählte Empfänger ist deaktiviert und kann keine Dateien empfangen." },
  { match: "Ungueltige Empfaenger-Adresse",     text: "Die Empfänger-Adresse ist ungültig." },
  { match: "CID darf nicht leer sein",          text: "Es wurde keine Datei zum Teilen angegeben." },
  { match: "Schluessel darf nicht leer sein",   text: "Der verschlüsselte Schlüssel fehlt. Bitte versuche es erneut." },
  { match: "Ungueltiger Index",                 text: "Der Eintrag konnte nicht gefunden werden. Bitte lade die Liste neu." },
  { match: "Nur der Sender darf widerrufen",    text: "Du kannst nur Freigaben widerrufen, die du selbst erstellt hast." },
  { match: "Zugriff bereits widerrufen",        text: "Der Zugriff auf diese Datei wurde bereits widerrufen." },

  // MetaMask / ethers.js Fehler
  { match: "user rejected",         text: "Du hast die Transaktion in MetaMask abgelehnt." },
  { match: "User denied",           text: "Du hast die Transaktion in MetaMask abgelehnt." },
  { match: "ACTION_REJECTED",       text: "Du hast die Transaktion in MetaMask abgelehnt." },
  { match: "insufficient funds",    text: "Nicht genügend ETH auf deinem Konto, um die Transaktion zu bezahlen." },
  { match: "nonce too low",         text: "Es gibt ein Problem mit deiner Transaktion. Bitte versuche es erneut." },
  { match: "replacement fee too low", text: "Die Transaktionsgebühr ist zu niedrig. Bitte versuche es erneut." },
  { match: "network changed",       text: "Das Netzwerk wurde gewechselt. Bitte stelle sicher, dass du mit Sepolia verbunden bist." },

  // IPFS + Crypto Fehler
  { match: "IPFS Desktop nicht erreichbar",                text: "IPFS Desktop ist nicht erreichbar. Bitte stelle sicher, dass die Anwendung läuft und die API unter http://127.0.0.1:5001 aktiv ist." },
  { match: "IPFS Download fehlgeschlagen",                 text: "Die Datei konnte nicht von IPFS heruntergeladen werden. Bitte stelle sicher, dass IPFS Desktop läuft." },
  { match: "Falsches Passwort oder beschädigter Schlüssel", text: "Das Passwort ist falsch oder der gespeicherte Schlüssel ist beschädigt. Bitte versuche es erneut." },

  // Allgemeiner Fallback für "execution reverted" ohne spezifische Meldung
  { match: "execution reverted",    text: "Die Transaktion konnte nicht ausgeführt werden. Bitte prüfe, ob du registriert und mit dem richtigen Netzwerk verbunden bist." },
];

// Technischen Fehler übersetzen – prüft err.reason und err.message per Teilstring-Match
export function translateContractError(error) {
  const reason  = typeof error === "string" ? error : (error?.reason ?? "");
  const message = typeof error === "string" ? error : (error?.message ?? "");
  const combined = `${reason} ${message}`;

  for (const entry of ERROR_MAP) {
    if (combined.includes(entry.match)) {
      return entry.text;
    }
  }

  // Kein Treffer → allgemeine Meldung
  return "Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut oder wende dich an den Administrator.";
}
