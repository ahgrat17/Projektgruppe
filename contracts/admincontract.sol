// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;


// CONTRACT 1: AdminContract
// Verwaltet registrierte Nutzer und deren Public Keys


contract AdminContract {

    address public immutable admin;


    mapping(address => bytes) private publicKeys;


 mapping(address => bool) private registered;
 mapping(address => bool) private active;


 event UserRegistered(address indexed user, bytes publicKey);
 event UserDeactivated(address indexed user);
 event UserReactivated(address indexed user);
 event PublicKeyUpdated(address indexed user, bytes newPublicKey);


    modifier onlyAdmin() {
        require(msg.sender == admin, "AdminContract: Nur Admin erlaubt");
        _;
    }


    modifier onlyRegistered() {
        require(registered[msg.sender], "AdminContract: Nutzer nicht registriert");
        _;
    }

    constructor() {
        admin = msg.sender;
    }


   function registerUser(address user, bytes calldata publicKey) external onlyAdmin {
        require(user != address(0),      "AdminContract: Ungueltige Adresse");
        require(publicKey.length > 0,    "AdminContract: Public Key darf nicht leer sein");
        require(!registered[user],       "AdminContract: Nutzer bereits registriert");

        registered[user]  = true;
        active[user]      = true;
        publicKeys[user]  = publicKey;

        emit UserRegistered(user, publicKey);
    }


    function deactivateUser(address user) external onlyAdmin {
    require(registered[user], "AdminContract: Nutzer nicht registriert");
    require(active[user], "AdminContract: Nutzer bereits deaktiviert");

    active[user] = false;

        emit UserDeactivated(user);
  }


  function reactivateUser(address user) external onlyAdmin {
    require(registered[user], "AdminContract: Nutzer nicht registriert");
    require(!active[user], "AdminContract: Nutzer bereits aktiv");

    active[user] = true;

    emit UserReactivated(user);
}


   function updatePublicKey(address user, bytes calldata newPublicKey) external onlyAdmin {
    require(registered[user], "AdminContract: Nutzer nicht registriert");
     require(active[user], "AdminContract: Nutzer ist deaktiviert");
    require(newPublicKey.length > 0, "AdminContract: Public Key darf nicht leer sein");

    publicKeys[user] = newPublicKey;

    emit PublicKeyUpdated(user, newPublicKey);
}


    function getPublicKey(address user) external view returns (bytes memory) {
        require(registered[user], "AdminContract: Nutzer nicht registriert");
        require(active[user], "AdminContract: Nutzer ist deaktiviert");
        return publicKeys[user];
    }


    function isRegistered(address user) external view returns (bool) {
        return registered[user];
    }


    function isActive(address user) external view returns (bool) {
        return active[user];
    }
}