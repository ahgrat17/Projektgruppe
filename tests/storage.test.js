// Einfacher Test für den Storage-Beispielcontract (aus Remix-Template)

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Storage", function () {
  // Prüft ob der Initialwert 0 ist
  it("test initial value", async function () {
    const Storage = await ethers.getContractFactory("Storage");
    const storage = await Storage.deploy();
    await storage.deployed();
    console.log("storage deployed at:" + storage.address);
    expect((await storage.retrieve()).toNumber()).to.equal(0);
  });

  // Wert speichern und wieder auslesen
  it("test updating and retrieving updated value", async function () {
    const Storage = await ethers.getContractFactory("Storage");
    const storage = await Storage.deploy();
    await storage.deployed();
    const storage2 = await ethers.getContractAt("Storage", storage.address);
    const setValue = await storage2.store(56);
    await setValue.wait();
    expect((await storage2.retrieve()).toNumber()).to.equal(56);
  });
});
