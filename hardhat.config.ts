import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-contract-sizer";

import "./tasks";

import dotenv from "dotenv";
dotenv.config()

const privateKey1 = process.env.PRIVATE_KEY1!;
const privateKey2 = process.env.PRIVATE_KEY2!;

const nodeRealApiKey = process.env.NODEREAL_API_KEY!;
const bscScanApiKey = process.env.BSCSCAN_API_KEY!;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      }
    }
  },
  networks: {    
    avax_testnet: {
      url: "https://api.avax-test.network/ext/bc/C/rpc",
      chainId: 43113,
      accounts: [privateKey1, privateKey2]
    },
  },
  etherscan: {
    // Your API key for BSCscan
    // Obtain one at https://bscscan.com/
    apiKey: bscScanApiKey     
  }
};

export default config;
