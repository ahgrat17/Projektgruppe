// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Interface für den AdminContract
// Wird vom DataSharingContract benutzt um Registrierung und Status zu prüfen
interface IAdminContract {
    function isRegistered(address user) external view returns (bool);
    function isActive(address user)     external view returns (bool);
    function getPublicKey(address user) external view returns (bytes memory);
    function getUsername(address user)  external view returns (string memory);
}
