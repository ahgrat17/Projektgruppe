// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// INTERFACE: IAdminContract
// Wird vom DataSharingContract importiert
interface IAdminContract {
    function isRegistered(address user) external view returns (bool);
    function isActive(address user)     external view returns (bool);
    function getPublicKey(address user) external view returns (bytes memory);
    function getUsername(address user)  external view returns (string memory);
}
