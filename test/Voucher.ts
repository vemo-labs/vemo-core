import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";

import { accessControlErrorRegex } from "./utils";
import { token } from "../typechain-types/@openzeppelin/contracts";

export const LINEAR_VESTING_TYPE = 1;
export const STAGED_VESTING_TYPE = 2;

export const DAILY_LINEAR_TYPE = 1;
export const WEEKLY_LINEAR_TYPE = 2;
export const MONTHLY_LINEAR_TYPE = 3;
export const QUARTERLY_LINEAR_TYPE = 4;

export const UNVESTED_STATUS = 0;
export const VESTED_STATUS = 1;
export const VESTING_STATUS = 2;

export const MAX_INT = ethers.MaxUint256;

describe("Voucher", function(){
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

  async function createVoucherFixture(){
    const {
      voucher,
      erc20Token,
      nftCollection,
      dataRegistry,
      owner,
      account1,
      account2,
    } = await deployVoucherFixture();

    const totalAmount = "10000";
    const voucherBalance = "2000";
    const amount = "1000";
    let startTimestamp = await time.latest();
    let endTimestamp = startTimestamp + 30 * 24 * 3600;

    // mint erc20 token and approve for voucher contract
    await erc20Token.mint(account1.address, ethers.parseEther(totalAmount));
    await erc20Token
      .connect(account1)
      .approve(voucher.target, ethers.parseEther(totalAmount));

    // first voucher, staged schedule
    let vesting = {
      balance: ethers.parseEther(voucherBalance),
      schedules: [
        {
          amount: ethers.parseEther(amount),
          vestingType: ethers.getBigInt(STAGED_VESTING_TYPE),
          linearType: ethers.getBigInt(0),
          startTimestamp: ethers.getBigInt(startTimestamp),
          endTimestamp: ethers.getBigInt(0),
          isVested: UNVESTED_STATUS,
          remainingAmount: ethers.parseEther("0"),
        },
        {
          amount: ethers.parseEther(amount),
          vestingType: ethers.getBigInt(STAGED_VESTING_TYPE),
          linearType: ethers.getBigInt(0),
          startTimestamp: ethers.getBigInt(endTimestamp),
          endTimestamp: ethers.getBigInt(0),
          isVested: UNVESTED_STATUS,
          remainingAmount: ethers.parseEther("0"),
        },
      ],
    };

    await voucher.connect(account1).create(vesting);

    // second voucher, linear schedule
    vesting = {
      balance: ethers.parseEther(amount),
      schedules: [
        {
          amount: ethers.parseEther(amount),
          vestingType: ethers.getBigInt(LINEAR_VESTING_TYPE),
          linearType: ethers.getBigInt(DAILY_LINEAR_TYPE),
          startTimestamp: ethers.getBigInt(startTimestamp),
          endTimestamp: ethers.getBigInt(endTimestamp),
          isVested: UNVESTED_STATUS,
          remainingAmount: ethers.parseEther(amount),
        },
      ],
    };

    await voucher.connect(account1).create(vesting);

    // third voucher, hybrid schedule
    vesting = {
      balance: ethers.parseEther(voucherBalance),
      schedules: [
        {
          amount: ethers.parseEther(amount),
          vestingType: ethers.getBigInt(STAGED_VESTING_TYPE),
          linearType: ethers.getBigInt(0),
          startTimestamp: ethers.getBigInt(startTimestamp),
          endTimestamp: ethers.getBigInt(0),
          isVested: UNVESTED_STATUS,
          remainingAmount: ethers.getBigInt(0),
        },
        {
          amount: ethers.parseEther(amount),
          vestingType: ethers.getBigInt(LINEAR_VESTING_TYPE),
          linearType: ethers.getBigInt(DAILY_LINEAR_TYPE),
          startTimestamp: ethers.getBigInt(startTimestamp + 30*24*3600),
          endTimestamp: ethers.getBigInt(endTimestamp + 30*24*3600),
          isVested: UNVESTED_STATUS,
          remainingAmount: ethers.parseEther(amount),
        },
      ],
    };

    await voucher.connect(account1).create(vesting);

    // fourth voucher, staged schedule
    vesting = {
      balance: ethers.parseEther(voucherBalance),
      schedules: [
        {
          amount: ethers.parseEther(amount),
          vestingType: ethers.getBigInt(STAGED_VESTING_TYPE),
          linearType: ethers.getBigInt(0),
          startTimestamp: ethers.getBigInt(startTimestamp),
          endTimestamp: ethers.getBigInt(0),
          isVested: UNVESTED_STATUS,
          remainingAmount: ethers.parseEther("0"),
        },
        {
          amount: ethers.parseEther(amount),
          vestingType: ethers.getBigInt(STAGED_VESTING_TYPE),
          linearType: ethers.getBigInt(0),
          startTimestamp: ethers.getBigInt(endTimestamp),
          endTimestamp: ethers.getBigInt(0),
          isVested: UNVESTED_STATUS,
          remainingAmount: ethers.parseEther("0"),
        },
      ],
    };

    await voucher.connect(account1).create(vesting);

    return {
      voucher,
      erc20Token,
      nftCollection,
      dataRegistry,
      owner,
      account1,
      account2,
      amount,
      startTimestamp,
      endTimestamp,
      voucherBalance,
    };
  };

  describe("Deployment", function(){
    it("Should deploy successfully", async function(){
      const {voucher, erc20Token, nftCollection, dataRegistry, owner} = await loadFixture(deployVoucherFixture);

      expect(voucher.target).to.be.properAddress;
      expect(erc20Token.target).to.be.properAddress;
      expect(nftCollection.target).to.be.properAddress;
      expect(dataRegistry.target).to.be.properAddress;
    });

    it("Should grant roles properly", async function(){
      const { voucher, erc20Token, nftCollection, dataRegistry, owner } = await loadFixture(deployVoucherFixture);

      const minterERC721Role = await nftCollection.MINTER_ROLE();
      const writerRole = await dataRegistry.WRITER_ROLE();
      const minterERC20Role = await erc20Token.MINTER_ROLE();

      // expect(await nftCollection.hasRole(minterERC721Role, voucher.target)).to.equal(true);
      expect(await dataRegistry.hasRole(writerRole, voucher.target)).to.equal(true);
      expect(await erc20Token.hasRole(minterERC20Role, owner.address)).to.equal(true);
    });
  });

  describe("Create", function(){
    it("Should create failed due to unauthorized requester", async function(){
      const { voucher, erc20Token, nftCollection, dataRegistry, owner, account1, account2 } = await loadFixture(deployVoucherFixture);

      const amount = 1;
      const startTimestamp = Math.round(Date.now() / 1000);

      const vesting = {
        balance: ethers.getBigInt(amount),
        schedules: [
          {
            amount: ethers.getBigInt(amount),
            vestingType: ethers.getBigInt(STAGED_VESTING_TYPE),
            linearType: ethers.getBigInt(0),
            startTimestamp: ethers.getBigInt(startTimestamp),
            endTimestamp: ethers.getBigInt(0),
            isVested: ethers.getBigInt(0),
            remainingAmount: ethers.getBigInt(0),            
          }
        ]
      }
      await expect(voucher.connect(account1).create(vesting)).to.be.revertedWith(
        "Requester must approve sufficient amount to create voucher"
      );
    });

    it("Should create successfully", async function(){
      const {
        voucher,
        erc20Token,
        nftCollection,
        dataRegistry,
        owner,
        account1,
        account2,
      } = await loadFixture(deployVoucherFixture);

      const amount = "1000";
      const startTimestamp = Math.round(Date.now() / 1000);

      // mint erc20 token and approve for voucher contract
      await expect(erc20Token.mint(account1.address, ethers.parseEther(amount))).to.not.be.reverted;
      await expect(erc20Token.connect(account1).approve(voucher.target, ethers.parseEther(amount))).to.not.be.reverted;

      // create voucher
      const vesting = {
        balance: ethers.parseEther(amount),
        schedules: [
          {
            amount: ethers.parseEther(amount),
            vestingType: ethers.getBigInt(STAGED_VESTING_TYPE),
            linearType: ethers.getBigInt(0),
            startTimestamp: ethers.getBigInt(startTimestamp),
            endTimestamp: ethers.getBigInt(0),
            isVested: ethers.getBigInt(0),
            remainingAmount: ethers.parseEther(amount),
          },
        ],
      };

      // estimate gas
      const estimateGas = await voucher.connect(account1).create.estimateGas(vesting);
      console.log(`Estimating gas for CREATE:  ${estimateGas}`);

      // assertions
      // await expect(voucher.connect(account1).create(vesting)).to.not.be.reverted;
      await expect(voucher.connect(account1).create(vesting))
        .to.emit(voucher, "VoucherCreated")
        .withArgs(account1.address, erc20Token.target, ethers.parseEther(amount), nftCollection.target, 0);

      expect(await nftCollection.ownerOf(ethers.getBigInt(0))).to.equal(account1.address);
      expect(await erc20Token.balanceOf(voucher.target)).to.equal(ethers.parseEther(amount));

      // assertions voucher data: balance, schedules
      const abiCoder = new ethers.AbiCoder();

      const balanceKey = ethers.id("BALANCE");
      const balanceValue = abiCoder.encode(["uint256"], [ethers.parseEther(amount)]);

      const scheduleKey = ethers.id("SCHEDULE");
      let scheduleValue = abiCoder.encode(["tuple(uint256,uint8,uint8,uint256,uint256,uint8,uint256)[]"],[[
          [ethers.parseEther(amount),STAGED_VESTING_TYPE,0,startTimestamp,0,0,ethers.parseEther(amount)]
      ]]);

      expect(await dataRegistry.read(nftCollection.target, ethers.getBigInt(0), balanceKey)).to.equal(balanceValue);
      expect(await dataRegistry.read(nftCollection.target, ethers.getBigInt(0), scheduleKey)).to.equal(scheduleValue);
    });
  });

  describe("Get voucher detail", function(){
    it("Should get voucher detail fail due not exist voucher", async function(){
      const {
        voucher,
        erc20Token,
        nftCollection,
        dataRegistry,
        owner,
        account1,
        account2,
      } = await loadFixture(createVoucherFixture);

      // assertions
      await expect(
        voucher.connect(account1).getVoucher(1000)
      ).to.be.revertedWith("Voucher not exist");
    });

    it("Should get voucher detail success after create", async function(){
      const {
        voucher,
        erc20Token,
        nftCollection,
        dataRegistry,
        owner,
        account1,
        account2,
      } = await loadFixture(createVoucherFixture);

      // assertions
      await expect(
        voucher.connect(account1).getVoucher(0)
      ).to.not.be.reverted;

      const tokenId = 3;
      const amount = "1000";
      const voucherDetail = await voucher.getVoucher(tokenId);

      //assertions voucher data total amount
      expect(voucherDetail[0]).to.equal(ethers.parseEther(String(parseFloat(amount)*2)));

      //assertions voucher data claimable
      expect(voucherDetail[1]).to.equal(ethers.parseEther(amount));

      //assertions voucher schedule stage status
      expect(voucherDetail[2][0][5]).to.equal(UNVESTED_STATUS);
      expect(voucherDetail[2][1][5]).to.equal(UNVESTED_STATUS);

      // assertions voucher data: balance, schedules
      expect(voucherDetail[2][0][0]).to.equal(ethers.parseEther(amount));
      expect(voucherDetail[2][0][6]).to.equal(ethers.parseEther(amount));

      expect(voucherDetail[2][1][0]).to.equal(ethers.parseEther(amount));
      expect(voucherDetail[2][1][6]).to.equal(ethers.parseEther(amount));

    });
  });

  describe("Redeem", function(){
    it("Should redeem failed due to unauthorized redeemer", async function(){
      const {
        voucher,
        erc20Token,
        nftCollection,
        dataRegistry,
        owner,
        account1,
        account2,
      } = await loadFixture(createVoucherFixture);

      // assertions
      await expect(
        voucher.connect(account2).redeem(0, MAX_INT)
      ).to.be.revertedWith("Redeemer must be true owner of voucher");
    });

    it("Should redeem failed due to insufficient balance voucher", async function(){
      const {
        voucher,
        erc20Token,
        nftCollection,
        dataRegistry,
        owner,
        account1,
        account2,
        amount,
        startTimestamp
      } = await loadFixture(createVoucherFixture);

      const tokenId = 0;
      // redeem 1st, should be succeed
      await expect(voucher.connect(account1).redeem(tokenId, MAX_INT)).to.not.be.reverted;

      await time.increaseTo(startTimestamp + 45*24*3600);
      // redeem 2nd, should be succeed
      await expect(voucher.connect(account1).redeem(tokenId, MAX_INT)).to.not.be.reverted;

      // redeem again, should be failed
      await expect(
        voucher.connect(account1).redeem(tokenId, MAX_INT)
      ).to.be.revertedWith("Voucher balancer must be greater than zero");
    });

    it("Should redeem failed due to insufficient gas", async function () {
      const {
        voucher,
        erc20Token,
        nftCollection,
        dataRegistry,
        owner,
        account1,
        account2,
        amount,
      } = await loadFixture(createVoucherFixture);

      // estimate gas
      const estimateGas = await voucher.connect(account1).redeem.estimateGas(ethers.getBigInt(0), MAX_INT);
      console.log(`Estimating gas for REDEEM: ${estimateGas}`);

      await expect(
        voucher
          .connect(account1)
          .redeem(ethers.getBigInt(0), MAX_INT, {
            gasLimit: estimateGas - ethers.getBigInt(1000),
          })
      ).to.be.reverted;
    });

    it("Should redeem STAGED successfully", async function () {
      const {
        voucher,
        erc20Token,
        nftCollection,
        dataRegistry,
        owner,
        account1,
        account2,
        amount,
        startTimestamp,
        endTimestamp,
        voucherBalance,
      } = await loadFixture(createVoucherFixture);

      const tokenId = 0;

      // transfer voucher nft to other account
      await expect(
        nftCollection
          .connect(account1)
          .transferFrom(account1.address, account2.address, ethers.getBigInt(0))
      ).to.not.be.reverted;

      // 1st vesting
      // await expect(voucher.connect(account2).redeem(tokenId)).to.not.be.reverted;
      await expect(voucher.connect(account2).redeem(tokenId, ethers.parseEther(amount)))
        .to.emit(voucher, "VoucherRedeem")
        .withArgs(account2.address, erc20Token.target, ethers.parseEther(amount), nftCollection.target, 0);

      // assertions proper received amount  
      expect(await erc20Token.balanceOf(account2.address)).to.equal(ethers.parseEther(amount));
      
      // assertions voucher data: balance, schedules      
      const abiCoder = new ethers.AbiCoder();
      const balanceKey = ethers.id("BALANCE");
      const scheduleKey = ethers.id("SCHEDULE");

      // assertions voucher data: balance, schedules
      let balanceValue = await dataRegistry.read(nftCollection.target, tokenId, balanceKey);
      let decodeResult = abiCoder.decode(["uint256"],balanceValue);
      let delta = Math.abs(parseFloat(amount) - parseFloat(ethers.formatEther(decodeResult.toString())));
      expect(delta).to.lt(1e-5);

      let scheduleValue = await dataRegistry.read(nftCollection.target, tokenId, scheduleKey);
      decodeResult = abiCoder.decode(
        ["tuple(uint256,uint8,uint8,uint32,uint32,uint8,uint256)[]"],
        scheduleValue
      );
      expect(decodeResult[0][0][5]).to.equal(VESTED_STATUS);
      expect(decodeResult[0][1][5]).to.equal(UNVESTED_STATUS);

      // 2nd vesting - next 45d
      await time.increaseTo(startTimestamp + 45*24*3600); // shift time to next 45d, it will pass over 1st schedule and reach 2nd schedule

      await expect(voucher.connect(account2).redeem(tokenId, ethers.parseEther(amount))).to.not.be.reverted;

      // assertions proper received amount  
      expect(await erc20Token.balanceOf(account2.address)).to.equal(ethers.parseEther(voucherBalance));
      
      // assertions voucher data: balance, schedules
      balanceValue = await dataRegistry.read(nftCollection.target, tokenId, balanceKey);
      decodeResult = abiCoder.decode(["uint256"],balanceValue);
      delta = parseFloat(ethers.formatEther(decodeResult.toString()));
      expect(delta).to.lt(1e-5);

      scheduleValue = await dataRegistry.read(nftCollection.target, tokenId, scheduleKey);
      decodeResult = abiCoder.decode(
        ["tuple(uint256,uint8,uint8,uint32,uint32,uint8,uint256)[]"],
        scheduleValue
      );
      expect(decodeResult[0][0][5]).to.equal(VESTED_STATUS);
      expect(decodeResult[0][1][5]).to.equal(VESTED_STATUS);
    });

    it("Should redeem LINEAR successfully", async function () {
      const {
        voucher,
        erc20Token,
        nftCollection,
        dataRegistry,
        owner,
        account1,
        account2,
        amount,
        startTimestamp,
        endTimestamp,
      } = await loadFixture(createVoucherFixture);

      const tokenId = 1;

      // assertions 2nd voucher, linear type
      const abiCoder = new ethers.AbiCoder();
      const balanceKey = ethers.id("BALANCE");
      let balanceValue = abiCoder.encode(["uint256"], [ethers.parseEther(amount)]);
      expect(
        await dataRegistry.read(
          nftCollection.target,
          tokenId,
          balanceKey
        )
      ).to.equal(balanceValue);

      const scheduleKey = ethers.id("SCHEDULE");
      let scheduleValue = abiCoder.encode(
        ["tuple(uint256,uint8,uint8,uint32,uint32,uint8,uint256)[]"],
        [
          [
            [
              ethers.parseEther(amount),
              LINEAR_VESTING_TYPE,
              DAILY_LINEAR_TYPE,
              startTimestamp,
              endTimestamp,
              0,
              ethers.parseEther(amount),
            ],
          ],
        ]
      );
      
      expect(
        await dataRegistry.read(
          nftCollection.target,
          tokenId,
          scheduleKey
        )
      ).to.equal(scheduleValue);

      // transfer voucher nft to other account
      await expect(
        nftCollection
          .connect(account1)
          .transferFrom(account1.address, account2.address, tokenId)
      ).to.not.be.reverted;

      expect(await erc20Token.balanceOf(account2.address)).to.equal(0);

      // 1st vesting at 15d from start
      await time.increaseTo(startTimestamp + 15*24*3600); // shift time to next 15 days, it will reach schedule
      await expect(voucher.connect(account2).redeem(tokenId, MAX_INT)).to.not.be.reverted;

      // assertions proper received amount
      let delta = Math.abs(
        parseFloat(amount)/2 -
          parseFloat(
            ethers.formatEther(await erc20Token.balanceOf(account2.address))
          )
      );
      expect(delta).to.lt(1e-5);
      
      // assertions voucher data: balance, schedules
      balanceValue = await dataRegistry.read(nftCollection.target, tokenId, balanceKey);
      let decodeResult = abiCoder.decode(["uint256"],balanceValue);
      delta = Math.abs(parseFloat(amount) / 2 - parseFloat(ethers.formatEther(decodeResult.toString())));
      expect(delta).to.lt(1e-5);

      scheduleValue = await dataRegistry.read(nftCollection.target, tokenId, scheduleKey);
      decodeResult = abiCoder.decode(
        ["tuple(uint256,uint8,uint8,uint32,uint32,uint8,uint256)[]"],
        scheduleValue
      );

      expect(decodeResult[0][0][5]).to.equal(VESTING_STATUS);
      delta = Math.abs(parseFloat(amount) / 2 - parseFloat(ethers.formatEther(decodeResult[0][0][6].toString())));
      expect(delta).to.lt(1e-5);

      // 2nd vesting after 60d from start
      await time.increaseTo(startTimestamp + 60*24*3600); // shift time to next 60 days, it will pass over schedule
      await expect(voucher.connect(account2).redeem(tokenId, MAX_INT)).to.not.be.reverted;

      // assertions proper received amount
      delta = Math.abs(
        parseFloat(amount) -
          parseFloat(
            ethers.formatEther(await erc20Token.balanceOf(account2.address))
          )
      );
      expect(delta).to.lt(1e-5);
      
      // assertions voucher data: balance, schedules
      balanceValue = await dataRegistry.read(nftCollection.target, tokenId, balanceKey);
      decodeResult = abiCoder.decode(["uint256"],balanceValue);
      delta = parseFloat(ethers.formatEther(decodeResult.toString()));
      expect(delta).to.lt(1e-5);

      scheduleValue = await dataRegistry.read(nftCollection.target, tokenId, scheduleKey);
      decodeResult = abiCoder.decode(
        ["tuple(uint256,uint8,uint8,uint32,uint32,uint8,uint256)[]"],
        scheduleValue
      );

      expect(decodeResult[0][0][5]).to.equal(VESTED_STATUS);
      delta = parseFloat(ethers.formatEther(decodeResult[0][0][6].toString()));
      expect(delta).to.lt(1e-5);
    });

    it("Should redeem HYBRID successfully", async function () {
      const {
        voucher,
        erc20Token,
        nftCollection,
        dataRegistry,
        owner,
        account1,
        account2,
        amount,
        startTimestamp,
        endTimestamp,
      } = await loadFixture(createVoucherFixture);

      // assertions 3nd voucher, hybrid type
      const tokenId = 2;
      const totalAmount = "2000";

      const abiCoder = new ethers.AbiCoder();
      const balanceKey = ethers.id("BALANCE");
      let balanceValue = abiCoder.encode(
        ["uint256"],
        [ethers.parseEther(totalAmount)]
      );
      expect(
        await dataRegistry.read(nftCollection.target, 2, balanceKey)
      ).to.equal(balanceValue);

      const scheduleKey = ethers.id("SCHEDULE");
      let scheduleValue = abiCoder.encode(
        ["tuple(uint256,uint8,uint8,uint256,uint256,uint8,uint256)[]"],
        [
          [
            [
              ethers.parseEther(amount),
              STAGED_VESTING_TYPE,
              0,
              startTimestamp,
              0,
              0,
              ethers.parseEther(amount),
            ],
            [
              ethers.parseEther(amount),
              LINEAR_VESTING_TYPE,
              DAILY_LINEAR_TYPE,
              startTimestamp + 30 * 24 * 3600,
              endTimestamp + 30 * 24 * 3600,
              0,
              ethers.parseEther(amount),
            ],
          ],
        ]
      );

      expect(
        await dataRegistry.read(nftCollection.target, 2, scheduleKey)
      ).to.equal(scheduleValue);

      // transfer voucher nft to other account
      await expect(
        nftCollection
          .connect(account1)
          .transferFrom(account1.address, account2.address, tokenId)
      ).to.not.be.reverted;

      expect(await erc20Token.balanceOf(account2.address)).to.equal(0);

      let delta: number;
      // vesting staged schedule
      console.log(`1st vesting - STAGE`);
      await time.increaseTo(startTimestamp + 15 * 24 * 60 * 60); // shift time to next 15 days, it will reach staged schedule
      await expect(voucher.connect(account2).redeem(tokenId, MAX_INT)).to.not
        .be.reverted;

      // assertions proper received amount
      delta = Math.abs(parseFloat(amount) - parseFloat(ethers.formatEther(await erc20Token.balanceOf(account2.address))));
      expect(delta).to.lt(1e-5);

      // assertions voucher data: balance, schedules
      balanceValue = await dataRegistry.read(
        nftCollection.target,
        tokenId,
        balanceKey
      );
      let decodeResult = abiCoder.decode(["uint256"], balanceValue);
      // console.log(`Decode BALANCE result ${decodeResult}`);
      delta = Math.abs(parseFloat(amount) - parseFloat(ethers.formatEther(decodeResult.toString())));
      expect(delta).to.lt(1e-5);

      scheduleValue = await dataRegistry.read(
        nftCollection.target,
        tokenId,
        scheduleKey
      );
      decodeResult = abiCoder.decode(
        ["tuple(uint256,uint8,uint8,uint32,uint32,uint8,uint256)[]"],
        scheduleValue
      );

      // console.log(`Decode SCHEDULE result ${decodeResult}`);

      // schedule 1 - staged
      expect(decodeResult[0][0][5]).to.equal(VESTED_STATUS);
      delta = parseFloat(ethers.formatEther(decodeResult[0][0][6].toString()));
      expect(delta).to.lt(1e-5);

      // schedule 2 - linear
      expect(decodeResult[0][1][5]).to.equal(UNVESTED_STATUS);
      delta = Math.abs(parseFloat(amount) - parseFloat(ethers.formatEther(decodeResult[0][1][6].toString())));
      expect(delta).to.lt(1e-5);

      // 2nd vesting - linear schedule
      console.log(`2nd vesting - LINEAR`);
      await time.increaseTo(startTimestamp + 45 * 24 * 60 * 60); // shift time to next 45 days, it will pass staged over, and reach linear schedule, but not pass over
      await expect(voucher.connect(account2).redeem(tokenId, MAX_INT)).to.not.be.reverted;

      // assertions proper received amount
      delta = Math.abs(
        (parseFloat(amount) * 3) / 2 -
          parseFloat(
            ethers.formatEther(await erc20Token.balanceOf(account2.address))
          )
      );
      expect(delta).to.lt(1e-5);

      // assertions voucher data: balance, schedules
      balanceValue = await dataRegistry.read(
        nftCollection.target,
        tokenId,
        balanceKey
      );
      decodeResult = abiCoder.decode(["uint256"], balanceValue);
      // console.log(`Decode BALANCE result ${decodeResult}`);
      delta = Math.abs(parseFloat(amount)/2 - parseFloat(ethers.formatEther(decodeResult.toString())));
      expect(delta).to.lt(1e-5);

      scheduleValue = await dataRegistry.read(
        nftCollection.target,
        tokenId,
        scheduleKey
      );
      decodeResult = abiCoder.decode(
        ["tuple(uint256,uint8,uint8,uint32,uint32,uint8,uint256)[]"],
        scheduleValue
      );

      // console.log(`Decode SCHEDULE result ${decodeResult}`);

      // schedule 1 - staged
      expect(decodeResult[0][0][5]).to.equal(VESTED_STATUS);
      delta = parseFloat(ethers.formatEther(decodeResult[0][0][6].toString()));
      expect(delta).to.lt(1e-5);

      // schedule 2 - linear
      expect(decodeResult[0][1][5]).to.equal(VESTING_STATUS);
      delta = Math.abs(parseFloat(amount)/2 - parseFloat(ethers.formatEther(decodeResult[0][1][6].toString())));
      expect(delta).to.lt(1e-5);

      // 3rd vesting - pass over all schedules
      console.log(`3rd vesting - all over`);
      await time.increaseTo(startTimestamp + 65 * 24 * 60 * 60); // shift time to next 65 days, it will pass over all schedules
      await expect(voucher.connect(account2).redeem(tokenId, MAX_INT)).to.not.be.reverted;

      // assertions proper received amount
      delta = Math.abs(
        (parseFloat(amount) * 2) -
          parseFloat(
            ethers.formatEther(await erc20Token.balanceOf(account2.address))
          )
      );
      expect(delta).to.lt(1e-5);

      // assertions voucher data: balance, schedules
      balanceValue = await dataRegistry.read(
        nftCollection.target,
        tokenId,
        balanceKey
      );
      decodeResult = abiCoder.decode(["uint256"], balanceValue);
      // console.log(`Decode BALANCE result ${decodeResult}`);
      delta = parseFloat(ethers.formatEther(decodeResult.toString()));
      expect(delta).to.lt(1e-5);

      scheduleValue = await dataRegistry.read(
        nftCollection.target,
        tokenId,
        scheduleKey
      );
      decodeResult = abiCoder.decode(
        ["tuple(uint256,uint8,uint8,uint32,uint32,uint8,uint256)[]"],
        scheduleValue
      );

      // console.log(`Decode SCHEDULE result ${decodeResult}`);
            
      // schedule 1 - staged
      expect(decodeResult[0][0][5]).to.equal(VESTED_STATUS);
      delta = parseFloat(ethers.formatEther(decodeResult[0][0][6].toString()));
      expect(delta).to.lt(1e-5);

      // schedule 2 - linear
      expect(decodeResult[0][1][5]).to.equal(VESTED_STATUS);
      delta = parseFloat(ethers.formatEther(decodeResult[0][1][6].toString()));
      expect(delta).to.lt(1e-5);
    });

  });

  describe("Redeem partial", function(){
    // it("Should redeem partial fail due redeem more than claimable amount", async function(){
    //   const {
    //     voucher,
    //     erc20Token,
    //     nftCollection,
    //     dataRegistry,
    //     owner,
    //     account1,
    //     account2,
    //   } = await loadFixture(createVoucherFixture);

    //   const tokenId = 3;

    //   await expect(
    //     voucher.connect(account1).redeem(tokenId, ethers.parseEther("9999"))
    //   ).to.be.revertedWith("Want amount must be less than or equal claimable amount of voucher");
    // });

    it("Should redeem partial fail due redeem 0", async function(){
      const {
        voucher,
        erc20Token,
        nftCollection,
        dataRegistry,
        owner,
        account1,
        account2,
      } = await loadFixture(createVoucherFixture);

      const tokenId = 3;

      await expect(
        voucher.connect(account1).redeem(tokenId, 0)
      ).to.be.revertedWith("Want amount must be greater than zero");
    });
  
    it("Should redeem partial success", async function(){
      const {
        voucher,
        erc20Token,
        nftCollection,
        dataRegistry,
        owner,
        account1,
        account2,
      } = await loadFixture(createVoucherFixture);

      const tokenId = 3;

      let balance = await erc20Token.balanceOf(account1.address);

      let amountWant = "100";
      const amount = "1000";
      
      // expect redeem partial suceess
      await expect(
        voucher.connect(account1).redeem(tokenId, ethers.parseEther(amountWant))
      ).to.not.be.reverted;

      balance += ethers.parseEther(amountWant);
      
      // assertions balance after redeem partial
      expect(await erc20Token.balanceOf(account1.address)).to.equal(balance);

      // check voucher detail after redeem partial
      let voucherDetail = await voucher.getVoucher(tokenId);
      
      expect(voucherDetail[2][0][5]).to.equal(VESTING_STATUS);
      expect(voucherDetail[2][1][5]).to.equal(UNVESTED_STATUS);

      // assertions voucher amount and remain after redeem partial
      expect(voucherDetail[2][0][0]).to.equal(ethers.parseEther(amount));
      expect(voucherDetail[2][0][6]).to.equal(ethers.parseEther(amount) - ethers.parseEther(amountWant));

      // redeem partial rest
      const startTimestamp = Math.round(Date.now() / 1000);
      await time.increaseTo(startTimestamp + 45*24*3600);
      
      voucherDetail = await voucher.getVoucher(tokenId);

      amountWant = "1900";
      
      await expect(
        voucher.connect(account1).redeem(tokenId, ethers.parseEther(amountWant))
      ).to.not.be.reverted;

      balance += ethers.parseEther(amountWant);
      
      // assertions balance after redeem partial
      expect(await erc20Token.balanceOf(account1.address)).to.equal(balance);

      // check voucher detail after redeem partial
      voucherDetail = await voucher.getVoucher(tokenId);
      
      // assertions voucher status
      expect(voucherDetail[2][0][5]).to.equal(VESTED_STATUS);
      expect(voucherDetail[2][1][5]).to.equal(VESTED_STATUS);

      // assertions voucher amount and remain after redeem partial rest
      expect(voucherDetail[2][0][0]).to.equal(ethers.parseEther(amount));

      // assertions voucher remain amount after redeem partial rest
      expect(voucherDetail[2][0][6]).to.equal(0);

      expect(voucherDetail[2][1][0]).to.equal(ethers.parseEther(amount));

      // assertions voucher remain amount after redeem partial rest
      expect(voucherDetail[2][1][6]).to.equal(0);

    });

  });

});