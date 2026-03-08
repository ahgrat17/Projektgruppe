// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;


interface IAdminContract {
    function isRegistered(address user) external view returns (bool);
    function isActive(address user) external view returns (bool);
}