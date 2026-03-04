// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IAdminContract.sol"; 



contract DataSharingContract {

    IAdminContract public immutable adminContract;

    struct SharedData {
        string  cid;          
        bytes   encryptedKey;  
        address sender;        
        uint256 timestamp;     
    }


    mapping(address => SharedData[]) private sharedDataFor;

    // Event: Wird ausgelöst, wenn Daten geteilt werden
    event DataShared(
        address indexed sender,
        address indexed receiver,
        string  cid,
        uint256 timestamp
    );


    modifier onlyRegistered() {
        require(
            adminContract.isRegistered(msg.sender),
            "DataSharing: msg.sender ist nicht registriert"
        );
        _;
    }

 
    constructor(address _adminContract) {
        require(_adminContract != address(0), "DataSharing: Ungueltige AdminContract-Adresse");
        adminContract = IAdminContract(_adminContract);
    }


    function shareData(
        address receiver,
        string  calldata cid,
        bytes   calldata encryptedKey
    ) external onlyRegistered {
        require(receiver != address(0),                         "DataSharing: Ungueltige Empfaenger-Adresse");
        require(receiver != msg.sender,                         "DataSharing: Sender und Empfaenger identisch");
        require(adminContract.isRegistered(receiver),           "DataSharing: Empfaenger nicht registriert");
        require(bytes(cid).length > 0,                          "DataSharing: CID darf nicht leer sein");
        require(encryptedKey.length > 0,                        "DataSharing: Verschl. Schluessel darf nicht leer sein");

        sharedDataFor[receiver].push(SharedData({
            cid:          cid,
            encryptedKey: encryptedKey,
            sender:       msg.sender,
            timestamp:    block.timestamp
        }));

        emit DataShared(msg.sender, receiver, cid, block.timestamp);
    }


    function getMySharedData() external view onlyRegistered returns (SharedData[] memory) {
        return sharedDataFor[msg.sender];
    }
}