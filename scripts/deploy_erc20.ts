import { ethers } from "hardhat";
import { setTimeout } from "timers/promises";

const WAITING_SETTLE_TIME = 3000; // in miliseconds

async function main() {
  let [signer] = await ethers.getSigners();

  const token = await ethers.deployContract("NewERC20", [signer.address, signer.address, "TUSD"]);
  console.log(`Deploy ERC20 contract at address ${token.target}`);

  await setTimeout(3000);

//   const token = await ethers.getContractAt("NewERC20", "0x031Da399397987aC26a493151Fd1E6292fb9CC1A");

  await token.mint(signer.address, ethers.parseEther("50000"));

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});