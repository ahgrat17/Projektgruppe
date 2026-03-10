// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IAdminContract.sol";


// Verwaltet den verschlüsselten Datenaustausch zwischen registrierten Nutzern
contract DataSharingContract {
    IAdminContract public immutable adminContract;

    struct SharedData {
        string  cid;          
        bytes   encryptedKey;  
        address sender;      
        uint256 timestamp;     
        bool    active;        
    }

    mapping(address => SharedData[]) private sharedDataFor;

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

        sharedDataFor[receiver].push(SharedData({
            cid:          cid,
            encryptedKey: encryptedKey,
            sender:       msg.sender,
            timestamp:    block.timestamp,
            active:       true
        }));

        emit DataShared(msg.sender, receiver, cid, block.timestamp);
    }

    function revokeAccess(address receiver, uint256 index) external onlyRegistered {
        require(receiver != address(0),                    "DataSharing: Ungueltige Empfaenger-Adresse");
        require(index < sharedDataFor[receiver].length,   "DataSharing: Ungueltiger Index");

        SharedData storage data = sharedDataFor[receiver][index];
        require(data.sender == msg.sender, "DataSharing: Nur der Sender darf widerrufen");
        require(data.active,               "DataSharing: Zugriff bereits widerrufen");

        data.active = false;
        emit AccessRevoked(msg.sender, receiver, index, block.timestamp);
    }

    function getMySharedData() external view onlyRegistered returns (SharedData[] memory) {
        SharedData[] storage allData = sharedDataFor[msg.sender];

        uint256 activeCount = 0;
        for (uint256 i = 0; i < allData.length; i++) {
            if (allData[i].active) activeCount++;
        }

        SharedData[] memory activeData = new SharedData[](activeCount);
        uint256 currentIndex = 0;
        for (uint256 i = 0; i < allData.length; i++) {
            if (allData[i].active) {
                activeData[currentIndex] = allData[i];
                currentIndex++;
            }
        }

        return activeData;
    }
}
