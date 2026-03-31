// Deployment-Script für den Storage-Contract (Beispiel aus Remix)
// Wird über Rechtsklick → "Run" in Remix ausgeführt
// TODO: Anpassen für AdminContract + DataSharingContract Deployment

import { deploy } from './ethers-lib'

(async () => {
  try {
    const result = await deploy('Storage', [])
    console.log(`address: ${result.address}`)
  } catch (e) {
    console.log(e.message)
  }
})()
