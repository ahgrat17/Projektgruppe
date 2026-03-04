// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;


// CONTRACT 1: AdminContract
// Verwaltet registrierte Nutzer und deren Public Keys


contract AdminContract {

    address public immutable admin;


    mapping(address => bytes) private publicKeys;


    mapping(address => bool) private registered;


    event UserRegistered(address indexed user, bytes publicKey);


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


    function registerUser(address user, bytes calldata publicKey) external   {
        require(user != address(0),      "AdminContract: Ungueltige Adresse");
        require(publicKey.length > 0,    "AdminContract: Public Key darf nicht leer sein");
        require(!registered[user],       "AdminContract: Nutzer bereits registriert");

        registered[user]  = true;
        publicKeys[user]  = publicKey;

        emit UserRegistered(user, publicKey);
    }


    function getPublicKey(address user) external view returns (bytes memory) {
        require(registered[user], "AdminContract: Nutzer nicht registriert");
        return publicKeys[user];
    }


    function isRegistered(address user) external view returns (bool) {
        return registered[user];
    }
}