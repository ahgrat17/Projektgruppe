// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// AdminContract – Nutzerverwaltung für SecureShare
// Verwaltet registrierte Nutzer mit Public Keys und Usernames.
// Nur der Admin (Deployer) darf Nutzer registrieren, deaktivieren etc.
contract AdminContract {
    address public immutable admin;

    // Mappings für Nutzerdaten
    mapping(address => bytes)   private publicKeys;        // RSA Public Key pro Nutzer (SPKI-Format)
    mapping(address => bool)    private registered;
    mapping(address => bool)    private active;
    mapping(address => string)  private usernames;
    mapping(string  => address) private usernameToAddress;  // Reverse-Lookup: Username → Adresse

    // Events – werden im Frontend per queryFilter abgefragt
    event UserRegistered(address indexed user, bytes publicKey, string username);
    event UserDeactivated(address indexed user);
    event UserReactivated(address indexed user);
    event PublicKeyUpdated(address indexed user, bytes newPublicKey);

    modifier onlyAdmin() {
        require(msg.sender == admin, "AdminContract: Nur Admin erlaubt");
        _;
    }

    // Deployer wird automatisch Admin
    constructor() {
        admin = msg.sender;
    }

    // Neuen Nutzer registrieren – nur Admin
    // Prüft: Adresse gültig, Key vorhanden, noch nicht registriert, Username eindeutig
    function registerUser(
        address user,
        bytes calldata publicKey,
        string calldata username
    ) external onlyAdmin {
        require(user != address(0),                        "AdminContract: Ungueltige Adresse");
        require(publicKey.length > 0,                      "AdminContract: Public Key darf nicht leer sein");
        require(!registered[user],                         "AdminContract: Nutzer bereits registriert");
        require(bytes(username).length > 0,                "AdminContract: Username darf nicht leer sein");
        require(bytes(username).length <= 32,              "AdminContract: Username zu lang");
        require(usernameToAddress[username] == address(0), "AdminContract: Username bereits vergeben");

        registered[user]            = true;
        active[user]                = true;
        publicKeys[user]            = publicKey;
        usernames[user]             = username;
        usernameToAddress[username] = user;

        emit UserRegistered(user, publicKey, username);
    }

    // Nutzer deaktivieren – kann danach nicht mehr teilen/empfangen
    function deactivateUser(address user) external onlyAdmin {
        require(registered[user], "AdminContract: Nutzer nicht registriert");
        require(active[user],     "AdminContract: Nutzer bereits deaktiviert");
        active[user] = false;
        emit UserDeactivated(user);
    }

    // Deaktivierten Nutzer wieder freischalten
    function reactivateUser(address user) external onlyAdmin {
        require(registered[user],  "AdminContract: Nutzer nicht registriert");
        require(!active[user],     "AdminContract: Nutzer bereits aktiv");
        active[user] = true;
        emit UserReactivated(user);
    }

    // Public Key aktualisieren, z.B. wenn Nutzer neues Schlüsselpaar generiert
    function updatePublicKey(address user, bytes calldata newPublicKey) external onlyAdmin {
        require(registered[user],        "AdminContract: Nutzer nicht registriert");
        require(active[user],            "AdminContract: Nutzer ist deaktiviert");
        require(newPublicKey.length > 0, "AdminContract: Public Key darf nicht leer sein");
        publicKeys[user] = newPublicKey;
        emit PublicKeyUpdated(user, newPublicKey);
    }

    // --- View-Funktionen (kein Gas on-chain) ---

    // Public Key eines Nutzers abrufen – braucht der Sender zum Verschlüsseln
    function getPublicKey(address user) external view returns (bytes memory) {
        require(registered[user], "AdminContract: Nutzer nicht registriert");
        require(active[user],     "AdminContract: Nutzer ist deaktiviert");
        return publicKeys[user];
    }

    function getUsername(address user) external view returns (string memory) {
        require(registered[user], "AdminContract: Nutzer nicht registriert");
        return usernames[user];
    }

    // Username → Adresse auflösen (fürs Admin-Panel)
    function getAddressByUsername(string calldata username) external view returns (address) {
        address user = usernameToAddress[username];
        require(user != address(0), "AdminContract: Username nicht gefunden");
        return user;
    }

    function isRegistered(address user) external view returns (bool) {
        return registered[user];
    }

    function isActive(address user) external view returns (bool) {
        return active[user];
    }
}
