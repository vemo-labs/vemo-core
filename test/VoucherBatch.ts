import {
    time,
    loadFixture,
  } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { mockVestingSchedules } from "./utils";

import { LINEAR_VESTING_TYPE, STAGED_VESTING_TYPE, DAILY_LINEAR_TYPE, QUARTERLY_LINEAR_TYPE, UNVESTED_STATUS, VESTING_STATUS } from "./Voucher";

export const MAX_INT = ethers.MaxUint256;

describe("Test Voucher Batch", function(){
    // fixtures
    async function deployVoucherFixture(){
        const [owner, account1, account2] = await ethers.getSigners();

        // deploy supplementary contracts
        const nftCollection = await ethers.deployContract("BatchNFTs");
        const dataRegistry = await ethers.deployContract("DataRegistry", [owner.address]);
        const erc20Token = await ethers.deployContract("USDT", [owner.address, owner.address]);

        // deploy voucher contract
        const voucher = await ethers.deployContract("Voucher", [erc20Token.target, nftCollection.target, dataRegistry.target]);

        // grant roles
        // const minterERC721Role = await nftCollection.MINTER_ROLE();
        const writerRole = await dataRegistry.WRITER_ROLE();

        // await nftCollection.grantRole(minterERC721Role, voucher.target);
        await dataRegistry.grantRole(writerRole, voucher.target);

        return {voucher, erc20Token, nftCollection, dataRegistry, owner, account1, account2};
    };

    it("Should CREATE BATCH voucher successfully", async function(){
        const {
          voucher,
          erc20Token,
          nftCollection,
          dataRegistry,
          owner,
          account1,
          account2,
        } = await loadFixture(deployVoucherFixture);
    
        const amount = "10";
        const totalMintToken = "1000000";
        await erc20Token.mint(account1.address, ethers.parseEther(totalMintToken));
        await erc20Token
        .connect(account1)
        .approve(voucher.target, ethers.parseEther(totalMintToken));
    
        // mock schedules
        const quantity = 50;
        const vestingType = STAGED_VESTING_TYPE;
        const startTimestamp = Math.round(Date.now() / 1000);
        const schedules = [{
            amount: ethers.parseEther(amount),
            vestingType,
            linearType: 0,
            startTimestamp: ethers.getBigInt(startTimestamp),
            endTimestamp: 0,
            isVested: UNVESTED_STATUS,
            remainingAmount: ethers.parseEther(amount),
        }];  
        let vesting = {
            balance: ethers.parseEther(amount),
            schedules
        };

        let batch = {
            vesting,
            quantity
        }

        console.log(`CREATE BATCH : Number of schedules ${schedules.length} quantity ${quantity}`);
        await expect(voucher.connect(account1).createBatch(batch)).to.not.be.reverted;

        // assertions
        expect(await nftCollection.ownerOf(ethers.getBigInt(0))).to.equal(account1.address);
        expect(await nftCollection.ownerOf(ethers.getBigInt(49))).to.equal(account1.address);

        // assertions next token id after mint batch
        expect(await nftCollection.nextTokenId()).to.equal(50);

        // check schedule 

        let voucherDetail = await voucher.getVoucher(0);

        expect(voucherDetail[2][0][5]).to.equal(UNVESTED_STATUS);

        // assertions voucher amount and remain after redeem partial
        expect(voucherDetail[2][0][0]).to.equal(ethers.parseEther(amount));
    
    });

    it("Should CREATE BATCH voucher failed due to run out of gas", async function(){
        const {
          voucher,
          erc20Token,
          nftCollection,
          dataRegistry,
          owner,
          account1,
          account2,
        } = await loadFixture(deployVoucherFixture);
    
        const amount = "10";
        const totalMintToken = "1000000";
        await erc20Token.mint(account1.address, ethers.parseEther(totalMintToken));
        await erc20Token
        .connect(account1)
        .approve(voucher.target, ethers.parseEther(totalMintToken));
    
        // mock schedules
        const quantity = 2;
        const schedules = await mockVestingSchedules(1000);  
        let vesting = {
            balance: ethers.parseEther(amount),
            schedules
        };

        let batch = {
            vesting,
            quantity
        }

        // console.log(`CREATE BATCH : Number of schedules ${schedules.length} quantity ${quantity}`);
        // "Error: Transaction reverted: contract call run out of gas and made the transaction revert"
        await expect(voucher.connect(account1).createBatch(batch)).to.be.reverted;
    
    });

    it("Should CREATE BATCH voucher failed due quantity zero", async function(){
        const {
          voucher,
          erc20Token,
          nftCollection,
          dataRegistry,
          owner,
          account1,
          account2,
        } = await loadFixture(deployVoucherFixture);
    
        const amount = "10";
        const totalMintToken = "1000000";
        await erc20Token.mint(account1.address, ethers.parseEther(totalMintToken));
        await erc20Token
        .connect(account1)
        .approve(voucher.target, ethers.parseEther(totalMintToken));
    
        // mock schedules
        const quantity = 0;
        const schedules = await mockVestingSchedules(1000);  
        let vesting = {
            balance: ethers.parseEther(amount),
            schedules
        };

        let batch = {
            vesting,
            quantity
        }

        await expect(voucher.connect(account1).createBatch(batch)).to.be.revertedWith(
            "Total balance must be greater than zero"
        );
    
    });

    it("Should CREATE BATCH voucher failed due amount zero", async function(){
        const {
          voucher,
          erc20Token,
          nftCollection,
          dataRegistry,
          owner,
          account1,
          account2,
        } = await loadFixture(deployVoucherFixture);
    
        const amount = "10";
        const totalMintToken = "1000000";
        await erc20Token.mint(account1.address, ethers.parseEther(totalMintToken));
        await erc20Token
        .connect(account1)
        .approve(voucher.target, ethers.parseEther(totalMintToken));
    
        // mock schedules
        const quantity = 10;
        const schedules = await mockVestingSchedules(1000);  
        let vesting = {
            balance: ethers.parseEther("0"),
            schedules
        };

        let batch = {
            vesting,
            quantity
        }

        await expect(voucher.connect(account1).createBatch(batch)).to.be.revertedWith(
            "Total balance must be greater than zero"
        );
    
    });

    it("Should REDEEM success after create BATCH voucher", async function(){
        const {
          voucher,
          erc20Token,
          nftCollection,
          dataRegistry,
          owner,
          account1,
          account2,
        } = await loadFixture(deployVoucherFixture);
    
        const amount = "10";
        const totalMintToken = "1000000";
        await erc20Token.mint(account1.address, ethers.parseEther(totalMintToken));
        await erc20Token
        .connect(account1)
        .approve(voucher.target, ethers.parseEther(totalMintToken));
    
        // mock schedules
        const quantity = 10;
        const vestingType = STAGED_VESTING_TYPE;
        const startTimestamp = Math.round(Date.now() / 1000);
        const schedules = [{
            amount: ethers.parseEther(amount),
            vestingType,
            linearType: 0,
            startTimestamp: ethers.getBigInt(startTimestamp),
            endTimestamp: 0,
            isVested: UNVESTED_STATUS,
            remainingAmount: ethers.parseEther(amount),
        }];  
        let vesting = {
            balance: ethers.parseEther(amount),
            schedules
        };

        let batch = {
            vesting,
            quantity
        }

        await expect(voucher.connect(account1).createBatch(batch)).to.not.be.reverted;

        let tokenId = 0;
        
        await expect(
            nftCollection
              .connect(account1)
              .transferFrom(account1.address, account2.address, tokenId)
        ).to.not.be.reverted;

        expect(await nftCollection.ownerOf(ethers.getBigInt(tokenId))).to.equal(account2.address);

        await expect(voucher.connect(account2).redeem(tokenId, MAX_INT)).to.not.be.reverted;

        // assertions balance after redeem 
        expect(await erc20Token.balanceOf(account2.address)).to.equal(ethers.parseEther(amount));
        

        // test redeem other
        tokenId = 9;
        
        await expect(
            nftCollection
              .connect(account1)
              .transferFrom(account1.address, account2.address, tokenId)
        ).to.not.be.reverted;

        expect(await nftCollection.ownerOf(ethers.getBigInt(tokenId))).to.equal(account2.address);

        await expect(voucher.connect(account2).redeem(tokenId, MAX_INT)).to.not.be.reverted;

        let new_amount = "20";

        // assertions balance after redeem 
        expect(await erc20Token.balanceOf(account2.address)).to.equal(ethers.parseEther(new_amount));

    });

});