# Vemo core
Smart contracts of Vemo core.

## Prerequisites
* [NodeJS v16+](https://nodejs.org/en)
* [Hardhat v2.19](https://hardhat.org/)
* [OpenZeppelin v5](https://docs.openzeppelin.com/contracts/5.x/)

## Setup
* Install npm dependencies
```
$ npm install
```

* Create .env file from template
```
$ cp .env.example .env
```

* Fulfill credentials and secrets to .env file

## Compile
* Compile smart contracts
```
$ npx hardhat compile
```

## Test
* Execute Unit tests
```
$ npx hardhat test
```

* Generate coverage report
```
$ npx hardhat coverage
```

## Deploy in-memory and local node
* Deploy in-memory node (for testing purpose)
```
$ npx hardhat run ./scripts/deploy.ts
```

* Spin up local Hardhat node
```
$ npx hardhat node
```

* Deploy local Hardhat node
```
$ npx hardhat run ./scripts/deploy.ts --network localhost
```

## Deploy to real networks
* Add supported chain config to hardhat.config.ts
```
For example:
...
const config: HardhatUserConfig = {
  networks: {
    avax_testnet: {
      url: "https://api.avax-test.network/ext/bc/C/rpc",
      chainId: 43113,
      accounts: [privateKey1, privateKey2]
    },
    ...
```

* Deploy command
```
$ npx hardhat run ./script/deploy.ts \
  --network <chain-name>
```

## Utils
* Create voucher
```
$ npx hardhat create --contract <voucher-address> \
  --balance <ethers-amount> \
  --schedules <json-encoded-vesting-schedules> \
  --network <network-name>
```
>  - *Prerequisites:* signer must approve voucher contract at least *ethers-amount* beforehand
>  - *IMPORTANT:* the vesting schedules is a json encoded string, with all amount values in Ethers unit, in order to avoid overflow while decoding, for example:
```
--schedules "[{\"amount\":\"1000000\",\"vestingType\":2,\"linearType\":0,\"startTimestamp\":1698828908,\"endTimestamp\":0,\"isVested\":0,\"remainingAmount\":\"0\"},{\"amount\":\"5000000\",\"vestingType\":1,\"linearType\":1,\"startTimestamp\":1700038508,\"endTimestamp\":1731660908,\"isVested\":0,\"remainingAmount\":\"5000000\"}]"
```

* Check smart contract code size, in order to avoid breaking limit 24KB
```
$ npx hardhat size-contracts
```

## License
Copyright belongs to Vemo 2023
