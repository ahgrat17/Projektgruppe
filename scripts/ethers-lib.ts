// Hilfsfunktion fürs Deployment über Remix IDE
// Liest das kompilierte ABI + Bytecode aus den Remix-Artefakten
// und deployed den Contract mit ethers.js

import { ethers } from 'ethers'

export const deploy = async (contractName: string, args: Array<any>, accountIndex?: number): Promise<ethers.Contract> => {

  console.log(`deploying ${contractName}`)

  // Artefakt-Pfad – muss zum Remix-Projektverzeichnis passen
  const artifactsPath = `browser/artifacts/${contractName}.json`

  const metadata = JSON.parse(await remix.call('fileManager', 'getFile', artifactsPath))

  // Signer vom Remix Web3-Provider holen
  const signer = (new ethers.providers.Web3Provider(web3Provider)).getSigner(accountIndex)

  const factory = new ethers.ContractFactory(metadata.abi, metadata.data.bytecode.object, signer)

  const contract = await factory.deploy(...args)

  // Warten bis die Transaktion gemined ist
  await contract.deployed()
  return contract
}
