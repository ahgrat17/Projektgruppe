// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IAdminContract.sol";

// DataSharingContract – Kern des Datenaustauschs
// Speichert verschlüsselte Datei-Referenzen (IPFS CID + verschlüsselter AES-Key).
// Nutzer müssen im AdminContract registriert und aktiv sein.
contract DataSharingContract {
    IAdminContract public immutable adminContract;

    // Ein geteiltes Datenpaket
    struct SharedData {
        string  cid;           // IPFS Content ID der verschlüsselten Datei
        bytes   encryptedKey;  // AES-Key, verschlüsselt mit dem RSA Public Key des Empfängers
        address sender;
        uint256 timestamp;
        bool    active;        // false = Zugriff widerrufen
    }

    // Hilfs-Struct für die Sender-Übersicht
    struct SentEntry {
        address receiver;
        uint256 index;         // Index im sharedDataFor-Array des Empfängers
    }

    // Pro Empfänger: alle empfangenen Datenpakete
    mapping(address => SharedData[]) private sharedDataFor;
    // Pro Sender: Verweise auf gesendete Pakete (für getMySentData)
    mapping(address => SentEntry[]) private sentBy;

    event DataShared(
        address indexed sender,
        address indexed receiver,
        string  cid,
        uint256 timestamp
    );

    event AccessRevoked(
        address indexed sender,
        address indexed receiver,
        uint256 index,
        uint256 timestamp
    );

    // Nur registrierte + aktive Nutzer dürfen Funktionen aufrufen
    modifier onlyRegistered() {
        require(
            adminContract.isRegistered(msg.sender),
            "DataSharing: msg.sender ist nicht registriert"
        );
        require(
            adminContract.isActive(msg.sender),
            "DataSharing: msg.sender ist deaktiviert"
        );
        _;
    }

    constructor(address _adminContract) {
        require(_adminContract != address(0), "DataSharing: Ungueltige AdminContract-Adresse");
        adminContract = IAdminContract(_adminContract);
    }

    // Datei mit einem Empfänger teilen
    // CID = IPFS-Hash, encryptedKey = AES-Key verschlüsselt mit Public Key des Empfängers
    function shareData(
        address receiver,
        string  calldata cid,
        bytes   calldata encryptedKey
    ) external onlyRegistered {
        require(receiver != address(0),               "DataSharing: Ungueltige Empfaenger-Adresse");
        require(receiver != msg.sender,               "DataSharing: Sender und Empfaenger identisch");
        require(adminContract.isRegistered(receiver), "DataSharing: Empfaenger nicht registriert");
        require(adminContract.isActive(receiver),     "DataSharing: Empfaenger ist deaktiviert");
        require(bytes(cid).length > 0,                "DataSharing: CID darf nicht leer sein");
        require(encryptedKey.length > 0,              "DataSharing: Verschl. Schluessel darf nicht leer sein");

        uint256 idx = sharedDataFor[receiver].length;

        sharedDataFor[receiver].push(SharedData({
            cid:          cid,
            encryptedKey: encryptedKey,
            sender:       msg.sender,
            timestamp:    block.timestamp,
            active:       true
        }));

        // Sender-Referenz speichern für getMySentData
        sentBy[msg.sender].push(SentEntry({
            receiver: receiver,
            index:    idx
        }));

        emit DataShared(msg.sender, receiver, cid, block.timestamp);
    }

    // Zugriff auf ein Datenpaket widerrufen – nur der Sender darf das
    function revokeAccess(address receiver, uint256 index) external onlyRegistered {
        require(receiver != address(0),                   "DataSharing: Ungueltige Empfaenger-Adresse");
        require(index < sharedDataFor[receiver].length,   "DataSharing: Ungueltiger Index");

        SharedData storage data = sharedDataFor[receiver][index];
        require(data.sender == msg.sender, "DataSharing: Nur der Sender darf widerrufen");
        require(data.active,               "DataSharing: Zugriff bereits widerrufen");

        data.active = false;
        emit AccessRevoked(msg.sender, receiver, index, block.timestamp);
    }

    // Alle aktiven Datenpakete für den Aufrufer abrufen (Empfänger-Sicht)
    function getMySharedData() external view onlyRegistered returns (SharedData[] memory) {
        SharedData[] storage allData = sharedDataFor[msg.sender];

        // Erst zählen wie viele aktiv sind, dann Array bauen
        uint256 activeCount = 0;
        for (uint256 i = 0; i < allData.length; i++) {
            if (allData[i].active) activeCount++;
        }

        SharedData[] memory activeData = new SharedData[](activeCount);
        uint256 j = 0;
        for (uint256 i = 0; i < allData.length; i++) {
            if (allData[i].active) activeData[j++] = allData[i];
        }

        return activeData;
    }

    // Hilfs-Struct für die Sender-Ansicht (inkl. Receiver + Status)
    struct SentDataView {
        address receiver;
        uint256 index;
        string  cid;
        uint256 timestamp;
        bool    active;
    }

    // Alle vom Aufrufer gesendeten Datenpakete abrufen (Sender-Sicht)
    function getMySentData() external view onlyRegistered returns (SentDataView[] memory) {
        SentEntry[] storage entries = sentBy[msg.sender];
        SentDataView[] memory result = new SentDataView[](entries.length);

        for (uint256 i = 0; i < entries.length; i++) {
            SentEntry storage e = entries[i];
            SharedData storage d = sharedDataFor[e.receiver][e.index];
            result[i] = SentDataView({
                receiver:  e.receiver,
                index:     e.index,
                cid:       d.cid,
                timestamp: d.timestamp,
                active:    d.active
            });
        }

        return result;
    }
}
